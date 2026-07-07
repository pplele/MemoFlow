import { useState, useEffect, useMemo } from 'react';
import { useSearchStore } from '@/stores/searchStore';
import { Search, Loader2, FileText, X, Filter, FileImage, FileSpreadsheet, File, Download, FileArchive } from 'lucide-react';
import type { UploadedFile } from '@/types';

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

const CATEGORIES = ['家庭', '工作', '生活', '学习', '购物', '健康'];
const SORTS = [
  { value: 'relevance', label: '相关度' },
  { value: 'date_desc', label: '最新优先' },
  { value: 'date_asc', label: '最早优先' },
] as const;

type SortType = (typeof SORTS)[number]['value'];

export default function SearchPage() {
  const [input, setInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortType>('relevance');
  const { memories, facts, loading, error, searchMeta, search, clear } = useSearchStore();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(input), 300);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    if (debouncedQuery.trim()) {
      search(debouncedQuery);
    }
  }, [debouncedQuery, search]);

  const filteredMemories = useMemo(() => {
    let result = memories;
    if (selectedCategory) {
      result = result.filter((m) => m.category === selectedCategory);
    }
    if (sortBy === 'date_desc') {
      result = [...result].sort((a, b) => b.created_at.localeCompare(a.created_at));
    } else if (sortBy === 'date_asc') {
      result = [...result].sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    return result;
  }, [memories, selectedCategory, sortBy]);

  const highlightText = (text: string, keyword: string) => {
    if (!keyword.trim()) return text;
    const parts = text.split(new RegExp(`(${keyword})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === keyword.toLowerCase() ? (
        <mark
          key={i}
          className="bg-accent/30 text-accent font-medium px-0.5 rounded"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">语义搜索</h1>
        <p className="text-text-secondary mb-8">关键词 + 向量混合召回</p>

        <div className="mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="搜索你的记忆和知识..."
                className="w-full rounded-lg border border-border-primary bg-bg-secondary pl-10 pr-10 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              {input && (
                <button
                  onClick={() => { setInput(''); clear(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </div>

        {/* 筛选器 */}
        {memories.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-border-primary bg-bg-secondary p-3">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Filter className="h-4 w-4" />
              <span>分类:</span>
            </div>
            <button
              onClick={() => setSelectedCategory('')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                !selectedCategory
                  ? 'bg-accent text-white'
                  : 'bg-bg-tertiary text-text-secondary hover:bg-bg-primary'
              }`}
            >
              全部
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-accent text-white'
                    : 'bg-bg-tertiary text-text-secondary hover:bg-bg-primary'
                }`}
              >
                {cat}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2 text-sm">
              <span className="text-text-tertiary">排序:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortType)}
                className="rounded border border-border-primary bg-bg-tertiary px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* 搜索结果统计 */}
        {memories.length > 0 && (
          <div className="mb-4 flex items-center gap-4 text-xs text-text-tertiary">
            <span>关键词命中: {searchMeta?.keyword_count ?? 0}</span>
            <span>向量召回: {searchMeta?.vector_count ?? 0}</span>
            <span>显示: {filteredMemories.length} 条</span>
          </div>
        )}

        {/* 搜索结果 */}
        {loading && memories.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        ) : memories.length === 0 && !loading ? (
          <div className="rounded-xl border border-border-primary bg-bg-secondary p-12 text-center">
            <Search className="mx-auto h-12 w-12 text-text-tertiary mb-4" />
            <p className="text-text-secondary">输入关键词开始搜索</p>
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="rounded-xl border border-border-primary bg-bg-secondary p-12 text-center">
            <Filter className="mx-auto h-12 w-12 text-text-tertiary mb-4" />
            <p className="text-text-secondary">该分类下没有结果</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMemories.map((m) => {
              const files = (m as any).files as UploadedFile[] || [];
              const imageFiles = files.filter(f => f.mimetype.includes('image')) || [];
              const otherFiles = files.filter(f => !f.mimetype.includes('image')) || [];
              return (
                <div
                  key={m.id}
                  className="rounded-xl border border-border-primary bg-bg-secondary p-4 hover:border-accent/30 transition-all"
                >
                  {(imageFiles.length > 0 || otherFiles.length > 0) && (
                    <div className="mb-3">
                      {imageFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {imageFiles.map((file, index) => (
                            <a
                              key={index}
                              href={fileUrl(file.path)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-20 w-20 cursor-pointer overflow-hidden rounded-lg border border-border-primary bg-bg-tertiary hover:border-accent/50 hover:shadow-md transition-all"
                            >
                              <img
                                src={fileUrl(file.path)}
                                alt={`${m.id}-${index}`}
                                className="h-full w-full object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                      {otherFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2">
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
                                <span className="max-w-[120px] truncate">{file.name}</span>
                                <Download className="h-3 w-3 opacity-50" />
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded bg-accent/10 px-1.5 py-0.5 text-xs font-medium text-accent">
                      相似度 {m.score.toFixed(2)}
                    </span>
                    {m.category && (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                        {m.category}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-primary leading-relaxed">
                    {highlightText(m.raw_content, debouncedQuery)}
                  </p>
                  <p className="mt-2 text-xs text-text-tertiary">
                    {new Date(m.created_at).toLocaleString('zh-CN')}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* 事实结果 */}
        {facts.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-medium text-text-secondary mb-3">相关事实</h3>
            <div className="space-y-2">
              {facts.map((f) => (
                <div key={f.id} className="rounded-lg border border-border-primary bg-bg-secondary p-3 text-sm">
                  <span className="font-medium text-accent">{f.entity}</span>
                  <span className="text-text-tertiary mx-1">的</span>
                  <span className="font-medium">{f.attribute}</span>
                  <span className="text-text-tertiary mx-1">：</span>
                  <span className="text-text-primary">
                    {highlightText(f.value, debouncedQuery)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
