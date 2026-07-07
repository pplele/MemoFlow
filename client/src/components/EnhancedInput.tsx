import { useState, useCallback, useRef } from 'react';
import { Plus, Upload, Loader2, Check, AlertCircle, X, Image as ImageIcon, Folder, FileArchive, FileText, FileSpreadsheet, File } from 'lucide-react';

interface EnhancedInputProps {
  onSubmit: (content: string) => void;
  onFileUpload: (files: File[], note: string) => void;
  loading: boolean;
  error: string | null;
}

function getFileIcon(file: File) {
  const name = file.name.toLowerCase();
  if (file.type.startsWith('image/')) return ImageIcon;
  if (name.endsWith('.pdf')) return FileText;
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) return FileSpreadsheet;
  if (name.endsWith('.docx') || name.endsWith('.doc')) return FileText;
  if (name.endsWith('.pptx') || name.endsWith('.ppt')) return FileText;
  if (name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z')) return FileArchive;
  return File;
}

function getFileIconColor(file: File) {
  if (file.type.startsWith('image/')) return 'text-purple-400';
  if (file.name.toLowerCase().endsWith('.pdf')) return 'text-red-400';
  if (file.name.toLowerCase().match(/\.(xlsx|xls|csv)$/)) return 'text-green-400';
  if (file.name.toLowerCase().match(/\.(docx|doc)$/)) return 'text-blue-400';
  if (file.name.toLowerCase().match(/\.(zip|rar|7z)$/)) return 'text-orange-400';
  return 'text-gray-400';
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function isImageFile(file: File) {
  return file.type.startsWith('image/');
}

export default function EnhancedInput({ onSubmit, onFileUpload, loading, error }: EnhancedInputProps) {
  const [input, setInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileNote, setFileNote] = useState('');
  const [isFileUploading, setIsFileUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || loading) return;
      onSubmit(input.trim());
      setInput('');
    },
    [input, loading, onSubmit]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        setSelectedFiles(prev => [...prev, ...files].slice(0, 20));
      }
      // 重置 input 以便重复选择同一文件
      e.target.value = '';
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length > 0) {
        setSelectedFiles(prev => [...prev, ...files].slice(0, 20));
      }
    },
    []
  );

  const removeFile = useCallback(
    (index: number) => {
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    },
    []
  );

  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0 || isFileUploading) return;

    setIsFileUploading(true);
    try {
      await onFileUpload(selectedFiles, fileNote);
      setSelectedFiles([]);
      setFileNote('');
    } finally {
      setIsFileUploading(false);
    }
  }, [selectedFiles, fileNote, onFileUpload, isFileUploading]);

  // 生成图片预览 URL
  const getImagePreview = (file: File) => {
    return URL.createObjectURL(file);
  };

  return (
    <div className="mb-8">
      {/* 文件上传区域 */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Upload className="h-4 w-4 text-text-tertiary" />
          <span className="text-sm text-text-secondary">文件上传（图片/PDF/Word/Excel/PPT/ZIP，最多20个）</span>
        </div>

        <div
          className={`relative rounded-xl border-2 border-dashed px-6 py-4 transition-all duration-300 ${
            isDragging
              ? 'border-accent bg-accent/10'
              : selectedFiles.length > 0
                ? 'border-accent/50 bg-accent/5'
                : 'border-border-primary hover:border-accent/50'
          } ${isFileUploading ? 'pointer-events-none' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {selectedFiles.length === 0 ? (
            <div className="flex flex-col items-center gap-3 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="flex items-center gap-3">
                <Upload className="h-5 w-5 text-text-tertiary" />
                <span className="text-sm text-text-secondary">
                  拖拽文件或文件夹到此处，或点击选择
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-text-tertiary">
                <div className="flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" />
                  <span>图片</span>
                </div>
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <span>PDF/Word/TXT</span>
                </div>
                <div className="flex items-center gap-1">
                  <FileSpreadsheet className="h-3 w-3" />
                  <span>Excel</span>
                </div>
                <div className="flex items-center gap-1">
                  <FileArchive className="h-3 w-3" />
                  <span>ZIP/RAR/7Z</span>
                </div>
                <div className="flex items-center gap-1">
                  <Folder className="h-3 w-3" />
                  <span>文件夹</span>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.pptx,.ppt,.txt,.zip,.rar,.7z,.tar,.gz,.bz2,.7zip,image/jpeg,image/jpg,image/png,image/gif,image/webp,image/svg+xml"
                multiple
              />
            </div>
          ) : (
            <div className="space-y-3">
              {/* 已选文件列表 */}
              <div className="flex flex-wrap gap-2">
                {selectedFiles.map((file, index) => {
                  const Icon = getFileIcon(file);
                  const color = getFileIconColor(file);
                  return (
                    <div
                      key={index}
                      className="relative group flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-tertiary border border-border-primary"
                    >
                      {isImageFile(file) ? (
                        <div className="h-10 w-10 overflow-hidden rounded">
                          <img
                            src={getImagePreview(file)}
                            alt={file.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <Icon className={`h-5 w-5 ${color}`} />
                      )}
                      <div className="flex flex-col">
                        <span className="text-xs text-text-secondary truncate max-w-[150px]">{file.name}</span>
                        <span className="text-[10px] text-text-tertiary">{formatFileSize(file.size)}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                        className="p-1 hover:bg-red-500/20 rounded transition-colors"
                      >
                        <X className="h-3 w-3 text-red-400" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* 备注和上传按钮 */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-tertiary shrink-0">{selectedFiles.length}/20</span>
                {selectedFiles.length < 20 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors shrink-0"
                  >
                    <Upload className="h-3 w-3" />
                    <span>添加更多</span>
                  </button>
                )}
                <input
                  type="text"
                  value={fileNote}
                  onChange={(e) => setFileNote(e.target.value)}
                  placeholder="添加备注（用于分类标签，如：工作合同、身份证照片）..."
                  className="flex-1 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <button
                  onClick={handleUpload}
                  disabled={isFileUploading}
                  className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0"
                >
                  {isFileUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>保存中...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      <span>保存</span>
                    </>
                  )}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.pptx,.ppt,.txt,.zip,.rar,.7z,.tar,.gz,.bz2,.7zip,image/jpeg,image/jpg,image/png,image/gif,image/webp,image/svg+xml"
                multiple
              />
            </div>
          )}

          {isFileUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg-primary/50 rounded-xl">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
                <span className="text-sm text-text-secondary">正在保存文件...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 文本输入框 */}
      <form onSubmit={handleSubmit}>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="记录一段记忆..."
            disabled={loading}
            className="flex-1 rounded-lg border border-border-primary bg-bg-secondary px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all animate-fadeIn"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="animate-pulse">AI 解析中...</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                <span>记录</span>
              </>
            )}
          </button>
        </div>
        {error && (
          <div className="mt-2 flex items-center gap-2 text-sm text-red-400 animate-fadeIn">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
      </form>
    </div>
  );
}
