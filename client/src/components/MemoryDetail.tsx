import { useEffect, useState } from 'react';
import { X, ExternalLink, FileText, Link2, ArrowRight } from 'lucide-react';
import type { Memory } from '@/types';

interface MemoryDetailProps {
  memory: Memory;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

interface OutgoingLink {
  target: string;
  type: 'wikilink' | 'entity' | 'category';
}

export default function MemoryDetail({ memory, onClose, onDelete }: MemoryDetailProps) {
  const [outgoing, setOutgoing] = useState<OutgoingLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/links/outgoing/${encodeURIComponent(memory.id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setOutgoing(data.outgoing || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [memory.id]);

  // 关闭 ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const obsidianUri = memory.file_path
    ? `obsidian://open?path=${encodeURIComponent(memory.file_path)}`
    : null;
  const fileUri = memory.file_path ? `file:///${memory.file_path.replace(/\\/g, '/')}` : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border-primary bg-bg-primary shadow-2xl animate-bubbleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary z-10"
          title="关闭 (Esc)"
        >
          <X className="h-4 w-4" />
        </button>

        {/* 标题区 */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center gap-2 text-xs text-text-tertiary mb-3">
            <span className="font-mono">{memory.id}</span>
            <span>·</span>
            <span>{new Date(memory.created_at).toLocaleString('zh-CN')}</span>
            {memory.updated_at && memory.updated_at !== memory.created_at && (
              <>
                <span>·</span>
                <span>已编辑 {new Date(memory.updated_at).toLocaleString('zh-CN')}</span>
              </>
            )}
          </div>
          {memory.category && (
            <span className="inline-block rounded-md bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent mb-3">
              {memory.category}
            </span>
          )}
        </div>

        {/* 正文 */}
        <div className="px-8 pb-4">
          <p className="text-base text-text-primary leading-relaxed whitespace-pre-wrap">
            {memory.raw_content}
          </p>
          {memory.summary && memory.summary !== memory.raw_content.slice(0, 100) && (
            <div className="mt-4 rounded-lg border border-border-primary bg-bg-secondary p-3">
              <div className="text-xs font-medium text-text-tertiary mb-1">AI 摘要</div>
              <p className="text-sm text-text-secondary">{memory.summary}</p>
            </div>
          )}
        </div>

        {/* 标签 */}
        {memory.tags && memory.tags.length > 0 && (
          <div className="px-8 pb-4">
            <div className="text-xs font-medium text-text-tertiary mb-2">标签</div>
            <div className="flex flex-wrap gap-1.5">
              {memory.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-bg-tertiary px-2.5 py-1 text-xs text-text-secondary"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 实体 */}
        {memory.entities && memory.entities.length > 0 && (
          <div className="px-8 pb-4">
            <div className="text-xs font-medium text-text-tertiary mb-2">实体</div>
            <div className="flex flex-wrap gap-1.5">
              {memory.entities.map((e, idx) => (
                <span
                  key={`${e.name}-${idx}`}
                  className="rounded-md border border-border-primary bg-bg-secondary px-2.5 py-1 text-xs"
                  title={e.type}
                >
                  <span className="text-accent">{e.name}</span>
                  <span className="text-text-tertiary ml-1">({e.type})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 外链 */}
        {!loading && outgoing.length > 0 && (
          <div className="px-8 pb-4">
            <div className="flex items-center gap-1.5 text-xs font-medium text-text-tertiary mb-2">
              <Link2 className="h-3.5 w-3.5" />
              <span>指向 {outgoing.length} 个关联</span>
            </div>
            <div className="space-y-1">
              {outgoing.map((o, idx) => (
                <div
                  key={`${o.target}-${idx}`}
                  className="flex items-center gap-2 rounded-md bg-bg-secondary px-3 py-1.5 text-xs"
                >
                  <ArrowRight className="h-3 w-3 text-text-tertiary" />
                  <span className="text-text-primary">{o.target}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      o.type === 'category'
                        ? 'bg-accent/10 text-accent'
                        : 'bg-bg-tertiary text-text-tertiary'
                    }`}
                  >
                    {o.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 操作栏 */}
        <div className="border-t border-border-primary bg-bg-secondary px-8 py-4 flex items-center justify-between rounded-b-2xl">
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <FileText className="h-3.5 w-3.5" />
            <span className="font-mono truncate max-w-md" title={memory.file_path}>
              {memory.file_path}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                onClick={() => {
                  if (confirm('确定删除？')) {
                    onDelete(memory.id);
                    onClose();
                  }
                }}
                className="rounded-md border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
              >
                删除
              </button>
            )}
            {fileUri && (
              <a
                href={fileUri}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-md border border-border-primary px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                title="在系统编辑器中打开"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                打开文件
              </a>
            )}
            {obsidianUri && (
              <a
                href={obsidianUri}
                className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
                title="用 Obsidian 打开（需安装 Obsidian）"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                在 Obsidian 中打开
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
