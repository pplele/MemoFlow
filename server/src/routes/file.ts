import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { createMemory, CreateMemoryResult } from '../services/memory-parser.js';
import { isAllowedFileType } from '../services/document-parser.js';
import { decodeFileName } from '../services/encoding.js';

const router = Router();

function getFileHash(filePath: string): string {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

function findDuplicateFile(uploadsDir: string, newFile: Express.Multer.File): string | null {
  const newHash = getFileHash(newFile.path);
  
  const categories = ['images', 'word', 'excel', 'ppt', 'pdf', 'archives', 'others'];
  for (const cat of categories) {
    const catDir = path.join(uploadsDir, cat);
    if (!fs.existsSync(catDir)) continue;
    
    const files = fs.readdirSync(catDir);
    for (const file of files) {
      const filePath = path.join(catDir, file);
      if (!fs.statSync(filePath).isFile()) continue;
      
      const existingHash = getFileHash(filePath);
      if (existingHash === newHash) {
        return filePath;
      }
    }
  }
  
  // 也检查根目录（兼容旧文件）
  const rootFiles = fs.readdirSync(uploadsDir);
  for (const file of rootFiles) {
    const filePath = path.join(uploadsDir, file);
    if (!fs.statSync(filePath).isFile()) continue;
    
    const existingHash = getFileHash(filePath);
    if (existingHash === newHash) {
      return filePath;
    }
  }
  
  return null;
}

function extractSimpleTags(text: string): string[] {
  const tags: string[] = [];

  const now = new Date();
  tags.push(now.toISOString().slice(0, 10));

  const categoryKeywords: Record<string, string> = {
    '生日': '生日',
    '火锅': '美食',
    '吃饭': '美食',
    '旅行': '旅行',
    '旅游': '旅行',
    '照片': '照片',
    '图片': '图片',
    '证件': '证件',
    '身份证': '证件',
    '工作': '工作',
    '学习': '学习',
    '会议': '工作',
    '朋友': '社交',
    '家人': '家庭',
    '女朋友': '恋爱',
    '男友': '恋爱',
    '老婆': '家庭',
    '老公': '家庭',
    '女儿': '家庭',
    '儿子': '家庭',
    '父母': '家庭',
    '爸爸': '家庭',
    '妈妈': '家庭',
    '毕业': '教育',
    '考试': '学习',
    '证书': '证件',
    '合同': '工作',
    '发票': '财务',
    '医院': '健康',
    '体检': '健康',
    '运动': '运动',
    '健身': '运动',
    '游戏': '娱乐',
    '电影': '娱乐',
    '音乐': '娱乐',
    '演唱会': '娱乐',
    '购物': '购物',
    '礼物': '礼物',
    '纪念日': '纪念日',
    '结婚': '纪念日',
    '婚礼': '纪念日',
    '开学': '教育',
    '放假': '假期',
    '春节': '节日',
    '端午': '节日',
    '中秋': '节日',
    '国庆': '节日',
    '圣诞': '节日',
    '元旦': '节日',
    '新年': '节日',
    '文件': '文件',
    '文档': '文档',
    '资料': '资料',
    '报告': '工作',
    '简历': '工作',
    '课件': '学习',
    '作业': '学习',
    '论文': '学习',
    '笔记': '学习',
  };

  for (const [keyword, tag] of Object.entries(categoryKeywords)) {
    if (text.includes(keyword)) {
      tags.push(tag);
    }
  }

  const chineseWords = text.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  for (const word of chineseWords.slice(0, 3)) {
    if (!tags.includes(word)) {
      tags.push(word);
    }
  }

  return [...new Set(tags)];
}

const uploadsDir = path.join(config.vault.path, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function getFileCategory(filename: string, mimetype: string): string {
  const ext = path.extname(filename).toLowerCase().slice(1);
  
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext) || mimetype.startsWith('image/')) {
    return 'images';
  }
  if (['doc', 'docx'].includes(ext)) {
    return 'word';
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return 'excel';
  }
  if (['ppt', 'pptx'].includes(ext)) {
    return 'ppt';
  }
  if (['pdf'].includes(ext)) {
    return 'pdf';
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
    return 'archives';
  }
  return 'others';
}

function ensureCategoryDir(category: string): string {
  const dir = path.join(uploadsDir, category);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// 初始化所有分类目录
['images', 'word', 'excel', 'ppt', 'pdf', 'archives', 'others'].forEach(cat => ensureCategoryDir(cat));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const decodedName = decodeFileName(file.originalname);
    const category = getFileCategory(decodedName, file.mimetype);
    const dir = ensureCategoryDir(category);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const decodedName = decodeFileName(file.originalname);
    const safeName = decodedName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    cb(null, `${timestamp}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
  fileFilter: (req, file, cb) => {
    const decodedName = decodeFileName(file.originalname);
    if (isAllowedFileType(decodedName, config.upload.allowedTypes, file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${decodedName}`));
    }
  },
});

/**
 * 统一文件上传接口
 * - 支持所有文件类型（图片、PDF、Word、Excel、PPT、ZIP 等）
 * - 不解析文件内容，直接保存
 * - 文件名作为内容，备注用于分类标签
 * - 支持多文件上传（最多 20 个）
 */
router.post('/upload', upload.array('files', 20), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as Express.Multer.File[];
    const note = (req.body as { note?: string }).note || '';

    if (!files || files.length === 0) {
      return res.status(400).json({ error: '请选择文件' });
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);

    const decodedFiles = files.map(f => ({
      ...f,
      decodedName: decodeFileName(f.originalname),
    }));

    const processedFiles: Array<{
      name: string;
      path: string;
      size: number;
      mimetype: string;
    }> = [];

    for (const file of decodedFiles) {
      console.log('[File] Uploaded:', file.decodedName, 'size:', file.size, 'type:', file.mimetype);
      
      const duplicatePath = findDuplicateFile(uploadsDir, file);
      if (duplicatePath) {
        console.log('[File] Duplicate found, removing:', file.path);
        fs.unlinkSync(file.path);
        
        processedFiles.push({
          name: file.decodedName,
          path: duplicatePath,
          size: file.size,
          mimetype: file.mimetype,
        });
      } else {
        processedFiles.push({
          name: file.decodedName,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype,
        });
      }
    }

    const fileNames = decodedFiles.map(f => f.decodedName).join(', ');
    const content = note || fileNames;
    const summary = note ? note.slice(0, 100) : `${files.length} 个文件，上传于 ${dateStr}`;

    const tags = note ? extractSimpleTags(note) : ['文件', dateStr];

    const hasImage = files.some(f => f.mimetype.startsWith('image/'));
    const type = hasImage ? 'image' : 'file';

    const memoryResult: CreateMemoryResult = await createMemory({
      content,
      source: 'file-upload',
      type,
      skipAi: true,
      tags,
      files: processedFiles,
    });

    res.status(201).json({
      ...memoryResult,
      file_count: processedFiles.length,
      files: processedFiles,
    });
  } catch (error) {
    const files = req.files as Express.Multer.File[];
    files?.forEach(f => {
      if (f.path && fs.existsSync(f.path)) {
        fs.unlinkSync(f.path);
      }
    });
    next(error);
  }
});

export default router;
