import { useEffect, useMemo, useState } from 'react';
import { useFactStore } from '@/stores/factStore';
import {
  Database,
  Loader2,
  Trash2,
  Search,
  Sparkles,
  Edit3,
  Check,
  X,
  Users,
} from 'lucide-react';
import type { Fact } from '@/types';

export default function FactPage() {
  const {
    facts,
    loading,
    extracting,
    error,
    total,
    searchQuery,
    fetchFacts,
    updateFact,
    deleteFact,
    extractFromMemories,
    setSearchQuery,
  } = useFactStore();

  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  useEffect(() => {
    fetchFacts();
  }, [fetchFacts]);

  // 按 entity 分组 + 过滤
  const groupedFacts = useMemo(() => {
    const filtered = searchQuery
      ? facts.filter(
          (f) =>
            f.entity.toLowerCase().includes(searchQuery.toLowerCase()) ||
            f.attribute.toLowerCase().includes(searchQuery.toLowerCase()) ||
            f.value.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : facts;
    const map = new Map<string, Fact[]>();
    for (const f of filtered) {
      if (!map.has(f.entity)) map.set(f.entity, []);
      map.get(f.entity)!.push(f);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [facts, searchQuery]);

  // 默认选中第一个 entity
  useEffect(() => {
    if (!selectedEntity && groupedFacts.length > 0) {
      setSelectedEntity(groupedFacts[0][0]);
    }
  }, [groupedFacts, selectedEntity]);

  const currentEntityFacts = useMemo(() => {
    if (!selectedEntity) return [];
    return groupedFacts.find(([e]) => e === selectedEntity)?.[1] || [];
  }, [groupedFacts, selectedEntity]);

  const handleStartEdit = (fact: Fact) => {
    setEditingId(fact.id);
    setEditingValue(fact.value);
  };

  const handleSaveEdit = async () => {
    if (editingId && editingValue.trim()) {
      await updateFact(editingId, { value: editingValue.trim() });
    }
    setEditingId(null);
    setEditingValue('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingValue('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这条事实？')) return;
    await deleteFact(id);
  };

  const handleExtract = async () => {
    const n = await extractFromMemories();
    const currentError = useFactStore.getState().error;
    if (currentError) {
      alert(currentError);
    } else if (n > 0) {
      alert(`已提取 ${n} 条事实`);
    } else {
      alert('暂无新事实可提取（可能是已有事实已覆盖，或 AI 未返回候选）');
    }
  };

  return (
    <div className="p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Database className="h-7 w-7 text-accent" />
            个人事实库
          </h1>
          <button
            onClick={handleExtract}
            disabled={extracting || facts.length === 0}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
            title={facts.length === 0 ? '需要先有记忆才能提取事实' : '从所有记忆中提取新事实'}
          >
            {extracting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {extracting ? '提取中...' : '提取事实'}
          </button>
        </div>
        <p className="text-text-secondary mb-6 text-sm">
          从记忆中提取的长期事实 · 共 {total} 条 · {groupedFacts.length} 个实体
        </p>

        {/* 搜索框 */}
        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索实体、属性或值..."
            className="w-full rounded-lg border border-border-primary bg-bg-secondary pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        ) : facts.length === 0 ? (
          <div className="rounded-xl border border-border-primary bg-bg-secondary p-12 text-center">
            <Database className="mx-auto h-12 w-12 text-text-tertiary mb-4" />
            <p className="text-text-secondary">事实库为空</p>
            <p className="text-text-tertiary text-sm mt-1">
              添加记忆后点击"提取事实"按钮可让 AI 帮你整理长期事实
            </p>
          </div>
        ) : groupedFacts.length === 0 ? (
          <div className="rounded-xl border border-border-primary bg-bg-secondary p-12 text-center">
            <Search className="mx-auto h-12 w-12 text-text-tertiary mb-4" />
            <p className="text-text-secondary">没有匹配的事实</p>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            {/* 左侧：实体列表 */}
            <div className="col-span-4">
              <div className="rounded-lg border border-border-primary bg-bg-secondary">
                <div className="flex items-center gap-2 border-b border-border-primary px-3 py-2 text-xs text-text-tertiary">
                  <Users className="h-3.5 w-3.5" />
                  <span>实体列表</span>
                </div>
                <div className="max-h-[60vh] overflow-y-auto p-1">
                  {groupedFacts.map(([entity, list]) => (
                    <button
                      key={entity}
                      onClick={() => setSelectedEntity(entity)}
                      className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors text-left ${
                        selectedEntity === entity
                          ? 'bg-accent/15 text-accent'
                          : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                      }`}
                    >
                      <span className="truncate">{entity}</span>
                      <span className="ml-2 rounded-full bg-bg-tertiary px-2 py-0.5 text-xs text-text-tertiary">
                        {list.length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 右侧：选中实体的事实 */}
            <div className="col-span-8">
              {selectedEntity && (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-sm text-text-tertiary">当前实体:</span>
                    <h2 className="text-lg font-semibold text-accent">{selectedEntity}</h2>
                    <span className="text-xs text-text-tertiary">· {currentEntityFacts.length} 条事实</span>
                  </div>
                  <div className="space-y-2">
                    {currentEntityFacts.map((f) => (
                      <div
                        key={f.id}
                        className="group rounded-lg border border-border-primary bg-bg-secondary p-4 hover:border-accent/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
                                {f.attribute}
                              </span>
                              {f.confidence !== undefined && (
                                <span className="rounded bg-accent/10 px-1.5 py-0.5 text-xs text-accent">
                                  置信度 {(f.confidence * 100).toFixed(0)}%
                                </span>
                              )}
                              {f.source_count !== undefined && f.source_count > 0 && (
                                <span className="text-xs text-text-tertiary">
                                  {f.source_count} 来源
                                </span>
                              )}
                            </div>
                            {editingId === f.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEdit();
                                    if (e.key === 'Escape') handleCancelEdit();
                                  }}
                                  autoFocus
                                  className="flex-1 rounded border border-accent bg-bg-tertiary px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50"
                                />
                                <button
                                  onClick={handleSaveEdit}
                                  className="rounded p-1 text-green-400 hover:bg-green-500/10"
                                  title="保存"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="rounded p-1 text-text-tertiary hover:bg-bg-tertiary"
                                  title="取消"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <p className="text-sm text-text-primary">{f.value}</p>
                            )}
                            {f.sources && f.sources.length > 0 && editingId !== f.id && (
                              <p className="mt-1.5 text-xs text-text-tertiary">
                                来源 ID: {f.sources.slice(0, 2).join(', ')}
                                {f.sources.length > 2 && ` 等 ${f.sources.length} 条`}
                              </p>
                            )}
                          </div>
                          {editingId !== f.id && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleStartEdit(f)}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary hover:bg-accent/10 hover:text-accent transition-colors"
                                title="编辑"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(f.id)}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                title="删除"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
