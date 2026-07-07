import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import officeParser from 'officeparser';
import JSZip from 'jszip';

export interface DocumentParseResult {
  text: string;
  title?: string;
  docType: string;
  pageCount?: number;
}

export async function parseDocument(filePath: string, fileName: string): Promise<DocumentParseResult> {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    case 'pdf':
      return parsePdf(filePath);
    case 'docx':
      return parseDocx(filePath);
    case 'xlsx':
      return parseXlsx(filePath);
    case 'xls':
      return parseXlsx(filePath);
    case 'pptx':
      return parsePptx(filePath);
    case 'txt':
      return parseTxt(filePath);
    case 'zip':
      return parseZip(filePath, fileName);
    case 'rar':
    case '7z':
      return parseArchiveFallback(fileName);
    default:
      return parseBinaryFallback(filePath, fileName);
  }
}

async function parsePdf(filePath: string): Promise<DocumentParseResult> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return {
      text: data.text,
      title: '',
      docType: 'pdf',
      pageCount: data.numpages,
    };
  } catch (error) {
    console.error('[Document] PDF parsing failed:', error);
    return parseBinaryFallback(filePath, 'unknown.pdf');
  }
}

async function parseDocx(filePath: string): Promise<DocumentParseResult> {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return {
      text: result.value,
      title: '',
      docType: 'docx',
    };
  } catch (error) {
    console.error('[Document] DOCX parsing failed:', error);
    return parseBinaryFallback(filePath, 'unknown.docx');
  }
}

async function parseXlsx(filePath: string): Promise<DocumentParseResult> {
  try {
    const workbook = XLSX.readFile(filePath);
    let text = '';
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (worksheet) {
        const sheetText = XLSX.utils.sheet_to_csv(worksheet, { FS: '\t' });
        text += `【${sheetName}】\n${sheetText}\n\n`;
      }
    }
    return {
      text: text.trim(),
      title: '',
      docType: 'xlsx',
    };
  } catch (error) {
    console.error('[Document] XLSX parsing failed:', error);
    return parseBinaryFallback(filePath, 'unknown.xlsx');
  }
}

async function parsePptx(filePath: string): Promise<DocumentParseResult> {
  try {
    const text = await (officeParser.parseOffice as any)(filePath);
    return {
      text: text || '',
      title: '',
      docType: 'pptx',
    };
  } catch (error) {
    console.error('[Document] PPTX parsing failed:', error);
    return parseBinaryFallback(filePath, 'unknown.pptx');
  }
}

function parseTxt(filePath: string): Promise<DocumentParseResult> {
  try {
    const text = fs.readFileSync(filePath, 'utf-8');
    return Promise.resolve({
      text,
      title: '',
      docType: 'txt',
    });
  } catch (error) {
    console.error('[Document] TXT parsing failed:', error);
    return Promise.resolve({
      text: '',
      docType: 'txt',
    });
  }
}

async function parseZip(filePath: string, fileName: string): Promise<DocumentParseResult> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(dataBuffer);
    
    let text = `ZIP 压缩包: ${fileName}\n\n`;
    const fileList: string[] = [];
    const textContent: string[] = [];
    
    await Promise.all(Object.keys(zip.files).map(async (name) => {
      const entry = zip.files[name];
      if (!entry.dir) {
        const ext = path.extname(name).toLowerCase();
        fileList.push(`- ${name}`);
        
        if (['.txt', '.md', '.json', '.csv'].includes(ext)) {
          try {
            const content = await entry.async('string');
            textContent.push(`【${name}】\n${content}\n`);
          } catch {}
        }
      }
    }));
    
    text += `文件列表:\n${fileList.join('\n')}\n\n`;
    if (textContent.length > 0) {
      text += '文本内容:\n' + textContent.join('\n');
    }
    
    return {
      text: text.trim() || `ZIP 压缩包: ${fileName}，包含 ${fileList.length} 个文件`,
      title: fileName,
      docType: 'zip',
    };
  } catch (error) {
    console.error('[Document] ZIP parsing failed:', error);
    return parseArchiveFallback(fileName);
  }
}

function parseArchiveFallback(fileName: string): Promise<DocumentParseResult> {
  return Promise.resolve({
    text: `[压缩包] ${fileName}，暂不支持解析该格式，已保存文件供下载`,
    title: fileName,
    docType: 'archive',
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function parseBinaryFallback(filePath: string, fileName: string): Promise<DocumentParseResult> {
  try {
    const stats = fs.statSync(filePath);
    return Promise.resolve({
      text: `[无法解析的文件] ${fileName}，大小：${formatFileSize(stats.size)}`,
      title: fileName,
      docType: 'unknown',
    });
  } catch (error) {
    return Promise.resolve({
      text: `[文件解析失败] ${fileName}`,
      docType: 'unknown',
    });
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

export function isAllowedFileType(fileName: string, allowedTypes: string[], mimeType?: string): boolean {
  const ext = getFileExtension(fileName);
  if (allowedTypes.includes(ext)) {
    return true;
  }
  
  if (mimeType) {
    const mt = mimeType.toLowerCase();
    const allowedMimeTypes = [
      'image/', 'pdf', 'word', 'excel', 'spreadsheet', 'presentation',
      'zip', 'rar', '7z', 'text/'
    ];
    return allowedMimeTypes.some(type => mt.includes(type));
  }
  
  return false;
}
