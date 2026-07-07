import { useEffect, useState } from 'react';
import { useMemoryStore } from '@/stores/memoryStore';
import { Loader2, Trash2, Tag, FileText, FileImage, FileSpreadsheet, File, FileArchive, Download, Folder } from 'lucide-react';
import type { Memory, UploadedFile } from '@/types';
import ImagePreview from '@/components/ImagePreview';

function getFileIcon(mimetype: string, fileName?: string) {
  if (mimetype.includes('image')) return FileImage;
  if (mimetype.includes('pdf')) return FileText;
  if (mimetype.includes('spreadsheet') || mimetype.includes('excel') || mimetype.includes('csv')) return FileSpreadsheet;
  if (mimetype.includes('word') || mimetype.includes('document')) return FileText;
  if (mimetype.includes('zip') || mimetype.includes('rar') || mimetype.includes('7z') ||
      fileName?.toLowerCase().endsWith('.zip') || fileName?.toLowerCase().endsWith('.rar') || fileName?.toLowerCase().endsWith('.7z')) {
    return FileArchive;
  }
  return File;
}

function getFileIconColor(mimetype: string, fileName?: string) {
  if (mimetype.includes('image')) return 'text-purple-500';
  if (mimetype.includes('pdf')) return 'text-red-500';
  if (mimetype.includes('spreadsheet') || mimetype.includes('excel')) return 'text-green-500';
  if (mimetype.includes('word')) return 'text-blue-500';
  if (mimetype.includes('zip') || mimetype.includes('rar') || mimetype.includes('7z') ||
      fileName?.toLowerCase().endsWith('.zip') || fileName?.toLowerCase().endsWith('.rar') || fileName?.toLowerCase().endsWith('.7z')) {
    return 'text-orange-500';
  }
  return 'text-gray-500';
}

function fileUrl(path: string): string {
  if (!path) return '';
  const uploadsIndex = path.indexOf('uploads');
  if (uploadsIndex !== -1) {
    const relativePath = path.substring(uploadsIndex + 'uploads'.length);
    return `/uploads/${relativePath.replace(/\\+/g, '/').replace(/^\/+/, '')}`;
  }
  return path;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function FileLibraryPage() {
  const { memories, loading, error, total, page, pageSize, fetchMemories, deleteMemory, setPage } = useMemoryStore();
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  useEffect(() => {
    fetchMemories({ page: 1, type_group: 'files' });
  }, [fetchMemories]);

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个文件记忆吗？')) return;
    await deleteMemory(id);
  };

  const handleImageClick = (images: string[], index: number) => {
    setPreviewImages(images);
    setPreviewIndex(index);
  };

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Folder className="h-7 w-7 text-accent" />
          文件库
        </h1>
        <p className="text-text-secondary mb-8">所有文件类记忆 · 共 {total} 条</p>

        {loading && memories.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        ) : memories.length === 0 && !loading ? (
          <div className="rounded-xl border border-border-primary bg-bg-secondary p-12 text-center">
            <Folder className="mx-auto h-12 w-12 text-text-tertiary mb-4" />
            <p className="text-text-secondary">还没有文件，在主页上传文件后会显示在这里</p>
          </div>
        ) : (
          <div className="space-y-3">
            {memories.map((m) => (
              <FileCard
                key={m.id}
                memory={m}
                onDelete={handleDelete}
                onImageClick={handleImageClick}
              />
            ))}
          </div>
        )}

        {total > pageSize && !loading && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              onClick={() => { setPage(page - 1); fetchMemories({ page: page - 1, type_group: 'files' }); }}
              disabled={page <= 1}
              className="rounded-md border border-border-primary px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-tertiary disabled:opacity-40"
            >
              上一页
            </button>
            <span className="text-sm text-text-secondary">
              {page} / {Math.ceil(total / pageSize)}
            </span>
            <button
              onClick={() => { setPage(page + 1); fetchMemories({ page: page + 1, type_group: 'files' }); }}
              disabled={page >= Math.ceil(total / pageSize)}
              className="rounded-md border border-border-primary px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-tertiary disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        )}
      </div>

      {previewImages.length > 0 && (
        <ImagePreview
          images={previewImages}
          currentIndex={previewIndex}
          onClose={() => setPreviewImages([])}
        />
      )}
    </div>
  );
}

function FileCard({
  memory,
  onDelete,
  onImageClick,
}: {
  memory: Memory;
  onDelete: (id: string) => void;
  onImageClick: (images: string[], index: number) => void;
}) {
  const files = memory.files || [];
  const imageFiles = files.filter(f => f.mimetype.includes('image'));
  const otherFiles = files.filter(f => !f.mimetype.includes('image'));
  const imageUrls = imageFiles.map(f => fileUrl(f.path));

  return (
    <div className="group rounded-xl border border-border-primary bg-bg-secondary p-4 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300 animate-fadeIn">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* 图片缩略图 */}
          {imageFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {imageUrls.map((url, index) => (
                <div
                  key={index}
                  onClick={() => onImageClick(imageUrls, index)}
                  className="h-20 w-20 cursor-pointer overflow-hidden rounded-lg border border-border-primary bg-bg-tertiary hover:border-accent/50 hover:shadow-md transition-all"
                >
                  <img
                    src={url}
                    alt={`${memory.id}-${index}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          {/* 其他文件 */}
          {otherFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {otherFiles.map((file, index) => {
                const Icon = getFileIcon(file.mimetype, file.name);
                const color = getFileIconColor(file.mimetype, file.name);
                return (
                  <a
                    key={index}
                    href={fileUrl(file.path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-secondary hover:border-accent/50 hover:bg-accent/5 transition-all"
                  >
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className="max-w-[150px] truncate">{file.name}</span>
                    {file.size && (
                      <span className="text-xs text-text-tertiary">{formatFileSize(file.size)}</span>
                    )}
                    <Download className="h-3 w-3 opacity-50" />
                  </a>
                );
              })}
            </div>
          )}

          {/* 内容 */}
          <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
            {memory.raw_content}
          </p>

          {/* 标签和时间 */}
          <div className="mt-3 flex items-center gap-3 text-xs text-text-tertiary">
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {memory.category || '未分类'}
            </span>
            {memory.tags && memory.tags.length > 0 && (
              <span className="flex flex-wrap gap-1">
                {memory.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-bg-tertiary px-2 py-0.5 text-text-secondary"
                  >
                    #{tag}
                  </span>
                ))}
              </span>
            )}
            <span>{new Date(memory.created_at).toLocaleString('zh-CN')}</span>
          </div>
        </div>

        <button
          onClick={() => onDelete(memory.id)}
          className="opacity-0 group-hover:opacity-100 flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary hover:bg-red-500/10 hover:text-red-400 transition-all"
          title="删除"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
