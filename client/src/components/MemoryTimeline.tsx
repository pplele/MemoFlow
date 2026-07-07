import { useState } from 'react';
import type { Memory } from '@/types';
import { Trash2, Tag, FileText, FileSpreadsheet, FileImage, File, Download } from 'lucide-react';
import ImagePreview from './ImagePreview';

interface MemoryTimelineProps {
  memories: Memory[];
  onDelete: (id: string) => void;
  onSelect?: (memory: Memory) => void;
}

export default function MemoryTimeline({ memories, onDelete, onSelect }: MemoryTimelineProps) {
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  if (memories.length === 0) {
    return (
      <div className="rounded-xl border border-border-primary bg-bg-secondary p-12 text-center">
        <div className="text-4xl mb-4">🌱</div>
        <p className="text-text-secondary">还没有记忆，输入上方框中开始记录</p>
      </div>
    );
  }

  const grouped = groupByDate(memories);

  const handleImageClick = (images: string[], index: number) => {
    setPreviewImages(images);
    setPreviewIndex(index);
  };

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, dayMemories]) => (
        <div key={date} className="animate-slideIn">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-border-primary" />
            <span className="text-sm font-medium text-text-secondary">{formatDateHeader(date)}</span>
            <div className="h-px flex-1 bg-border-primary" />
          </div>
          <div className="space-y-3 ml-2">
            {dayMemories.map((m) => (
              <MemoryCard
                key={m.id}
                memory={m}
                onDelete={onDelete}
                onSelect={onSelect}
                onImageClick={handleImageClick}
              />
            ))}
          </div>
        </div>
      ))}
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

function getFileIcon(mimetype: string) {
  if (mimetype.includes('image')) return FileImage;
  if (mimetype.includes('pdf')) return FileText;
  if (mimetype.includes('spreadsheet') || mimetype.includes('excel') || mimetype.includes('csv')) return FileSpreadsheet;
  if (mimetype.includes('word') || mimetype.includes('document')) return FileText;
  return File;
}

function getFileIconColor(mimetype: string) {
  if (mimetype.includes('image')) return 'text-purple-500';
  if (mimetype.includes('pdf')) return 'text-red-500';
  if (mimetype.includes('spreadsheet') || mimetype.includes('excel')) return 'text-green-500';
  if (mimetype.includes('word')) return 'text-blue-500';
  return 'text-gray-500';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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

function MemoryCard({
  memory,
  onDelete,
  onSelect,
  onImageClick,
}: {
  memory: Memory;
  onDelete: (id: string) => void;
  onSelect?: (memory: Memory) => void;
  onImageClick: (images: string[], index: number) => void;
}) {
  const isClickable = !!onSelect;
  
  const imageFiles = memory.files?.filter(f => f.mimetype.includes('image')) || [];
  const otherFiles = memory.files?.filter(f => !f.mimetype.includes('image')) || [];
  const imageUrls = imageFiles.map(f => fileUrl(f.path));

  return (
    <div
      onClick={isClickable ? () => onSelect!(memory) : undefined}
      className={`group rounded-xl border border-border-primary bg-bg-secondary p-4 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300 animate-fadeIn ${
        isClickable ? 'cursor-pointer' : ''
      }`}
      style={{ animationDelay: `${Math.random() * 0.2}s` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {(imageFiles.length > 0 || otherFiles.length > 0) && (
            <div className="mb-3">
              {imageFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {imageUrls.map((url, index) => (
                    <div
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation();
                        onImageClick(imageUrls, index);
                      }}
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
              {otherFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {otherFiles.map((file, index) => {
                    const Icon = getFileIcon(file.mimetype);
                    const color = getFileIconColor(file.mimetype);
                    return (
                      <a
                        key={index}
                        href={fileUrl(file.path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2 rounded-lg border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-secondary hover:border-accent/50 hover:bg-accent/5 transition-all"
                      >
                        <Icon className={`h-4 w-4 ${color}`} />
                        <span className="max-w-[120px] truncate">{file.name}</span>
                        <Download className="h-3 w-3 opacity-50" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
            {memory.raw_content}
          </p>
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
            <span>{formatTime(memory.created_at)}</span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(memory.id);
          }}
          className="opacity-0 group-hover:opacity-100 flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary hover:bg-red-500/10 hover:text-red-400 transition-all"
          title="删除"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function groupByDate(memories: Memory[]): Record<string, Memory[]> {
  const groups: Record<string, Memory[]> = {};
  memories.forEach((m) => {
    const date = m.created_at.split('T')[0];
    if (!groups[date]) groups[date] = [];
    groups[date].push(m);
  });
  return groups;
}

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateStr === today.toISOString().split('T')[0]) {
    return '今天';
  }
  if (dateStr === yesterday.toISOString().split('T')[0]) {
    return '昨天';
  }
  return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}
