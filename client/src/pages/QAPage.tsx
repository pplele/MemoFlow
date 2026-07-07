import { useState, useRef, useEffect } from 'react';
import { useQAStore } from '@/stores/qaStore';
import {
  Send,
  Loader2,
  MessageCircle,
  Trash2,
  Sparkles,
  BookOpen,
  ExternalLink,
  FileImage,
  FileSpreadsheet,
  File,
  FileText,
  Download,
  FileArchive,
} from 'lucide-react';
import type { QASource, UploadedFile } from '@/types';

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

export default function QAPage() {
  const [input, setInput] = useState('');
  const { answer, sources, loading, error, history, ask, clear } = useQAStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    await ask(input);
    setInput('');
  };

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col">
      <div className="mx-auto w-full max-w-3xl flex flex-col h-full p-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-accent" />
            智能问答
          </h1>
          {history.length > 0 && (
            <button
              onClick={clear}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
              title="清空对话"
            >
              <Trash2 className="h-3.5 w-3.5" />
              清空
            </button>
          )}
        </div>
        <p className="text-text-secondary mb-6 text-sm">
          基于你的记忆库和事实库回答问题 · 关键词 + 向量混合召回
        </p>

        {/* 对话历史 */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto space-y-5 mb-4 pr-2 -mr-2"
        >
          {history.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-20 text-text-tertiary animate-fadeIn">
              <MessageCircle className="h-12 w-12 mb-4" />
              <p className="text-sm">输入问题，AI 将基于你的记忆回答</p>
              <div className="mt-8 grid grid-cols-1 gap-2 w-full max-w-md text-xs">
                {['我最近学了什么？', '我喜欢吃什么？', '我下周有什么任务？'].map(
                  (q) => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
                      className="rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 text-left text-text-secondary hover:border-accent/50 hover:text-text-primary transition-colors"
                    >
                      {q}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {history.map((item, idx) => (
            <div key={idx} className="space-y-3 animate-bubbleIn">
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent px-4 py-3 text-sm text-white shadow-sm">
                  {item.question}
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-border-primary bg-bg-secondary px-4 py-3 text-sm text-text-primary leading-relaxed">
                  <p className="whitespace-pre-wrap">{item.answer}</p>
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-text-tertiary animate-fadeIn">
              <div className="rounded-2xl rounded-bl-md border border-border-primary bg-bg-secondary px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
              <span className="text-sm">思考中...</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* 来源记忆（仅显示当前最新一轮） */}
        {sources && sources.length > 0 && !loading && (
          <div className="mb-4 rounded-lg border border-border-primary bg-bg-secondary/50 p-3 animate-fadeIn">
            <div className="flex items-center gap-2 mb-2 text-xs text-text-secondary">
              <BookOpen className="h-3.5 w-3.5" />
              <span>引用了 {sources.length} 条相关记忆</span>
            </div>
            <div className="space-y-1.5">
              {sources.map((s, idx) => (
                <SourceItem key={s.id} source={s} index={idx + 1} />
              ))}
            </div>
          </div>
        )}

        {/* 输入区 */}
        <div className="border-t border-border-primary pt-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="问一个问题..."
              disabled={loading}
              className="flex-1 rounded-lg border border-border-primary bg-bg-secondary px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-60 transition-all"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>发送</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function SourceItem({ source, index }: { source: QASource; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const text = source.summary || source.content;
  const truncated = text.length > 100 ? text.slice(0, 100) + '...' : text;

  const files = source.files as UploadedFile[] || [];
  const imageFiles = files.filter(f => f.mimetype.includes('image')) || [];
  const otherFiles = files.filter(f => !f.mimetype.includes('image')) || [];

  return (
    <div className="rounded-md border border-border-primary bg-bg-tertiary px-3 py-2 text-xs">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent/20 text-accent font-mono text-[10px]">
          {index}
        </span>
        <div className="flex-1 min-w-0">
          {(imageFiles.length > 0 || otherFiles.length > 0) && (
            <div className="mb-2">
              {imageFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {imageFiles.map((file, idx) => (
                    <a
                      key={idx}
                      href={fileUrl(file.path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-16 w-16 cursor-pointer overflow-hidden rounded-md border border-border-primary bg-bg-secondary hover:border-accent/50 hover:shadow-md transition-all"
                    >
                      <img
                        src={fileUrl(file.path)}
                        alt={`${source.id}-${idx}`}
                        className="h-full w-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
              {otherFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {otherFiles.map((file, idx) => {
                    const Icon = getFileIcon(file.mimetype, file.name);
                    const color = getFileIconColor(file.mimetype, file.name);
                    return (
                      <a
                        key={idx}
                        href={fileUrl(file.path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-md border border-border-primary bg-bg-secondary px-2 py-1.5 text-[11px] text-text-secondary hover:border-accent/50 hover:bg-accent/5 transition-all"
                      >
                        <Icon className={`h-3.5 w-3.5 ${color}`} />
                        <span className="max-w-[100px] truncate">{file.name}</span>
                        <Download className="h-2.5 w-2.5 opacity-50" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-1.5 mb-1">
            {source.category && (
              <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                {source.category}
              </span>
            )}
            <span className="text-text-tertiary">
              相似度 {source.score.toFixed(2)}
            </span>
            {source.file_path && (
              <a
                href={`file:///${source.file_path}`}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-0.5 text-text-tertiary hover:text-accent"
                title="在 Obsidian 中打开"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <p
            className="text-text-secondary cursor-pointer"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? text : truncated}
          </p>
        </div>
      </div>
    </div>
  );
}
