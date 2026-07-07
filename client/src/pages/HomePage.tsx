import { useEffect, useState } from 'react';
import { useMemoryStore } from '@/stores/memoryStore';
import EnhancedInput from '@/components/EnhancedInput';
import MemoryTimeline from '@/components/MemoryTimeline';
import MemoryDetail from '@/components/MemoryDetail';
import { Loader2 } from 'lucide-react';
import type { Memory } from '@/types';

export default function HomePage() {
  const { memories, loading, error, total, page, pageSize, typeGroup, fetchMemories, createMemory, uploadFiles, deleteMemory, setPage, setTypeGroup } = useMemoryStore();
  const [selected, setSelected] = useState<Memory | null>(null);

  useEffect(() => {
    // 主页默认只显示文字记忆
    setTypeGroup('text');
    fetchMemories({ page: 1, type_group: 'text' });
  }, [fetchMemories, setTypeGroup]);

  const handleSubmit = async (content: string) => {
    await createMemory({ content });
  };

  const handleFileUpload = async (files: File[], note: string) => {
    await uploadFiles(files, note);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条记忆吗？')) return;
    await deleteMemory(id);
    if (selected?.id === id) setSelected(null);
  };

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">我的记忆</h1>
        <p className="text-text-secondary mb-8">记录每一个重要的瞬间 · 共 {total} 条</p>

        <EnhancedInput
          onSubmit={handleSubmit}
          onFileUpload={handleFileUpload}
          loading={loading}
          error={error}
        />

        {loading && memories.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        ) : (
          <MemoryTimeline
            memories={memories}
            onDelete={handleDelete}
            onSelect={setSelected}
          />
        )}

        {total > pageSize && !loading && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              onClick={() => { setPage(page - 1); fetchMemories({ page: page - 1, type_group: typeGroup }); }}
              disabled={page <= 1}
              className="rounded-md border border-border-primary px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-tertiary disabled:opacity-40"
            >
              上一页
            </button>
            <span className="text-sm text-text-secondary">
              {page} / {Math.ceil(total / pageSize)}
            </span>
            <button
              onClick={() => { setPage(page + 1); fetchMemories({ page: page + 1, type_group: typeGroup }); }}
              disabled={page >= Math.ceil(total / pageSize)}
              className="rounded-md border border-border-primary px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-tertiary disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        )}
      </div>

      {selected && (
        <MemoryDetail
          memory={selected}
          onClose={() => setSelected(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
