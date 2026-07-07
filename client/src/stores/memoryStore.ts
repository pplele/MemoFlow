import { create } from 'zustand';
import { memoryApi } from '@/api/memory';
import { fileApi } from '@/api/file';
import type { Memory, CreateMemoryRequest } from '@/types';

interface MemoryState {
  memories: Memory[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  pageSize: number;
  typeGroup: 'text' | 'files' | undefined;

  fetchMemories: (params?: { page?: number; limit?: number; type_group?: 'text' | 'files' }) => Promise<void>;
  createMemory: (data: CreateMemoryRequest) => Promise<void>;
  uploadFiles: (files: File[], note?: string) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  setPage: (page: number) => void;
  setTypeGroup: (group: 'text' | 'files' | undefined) => void;
}

export const useMemoryStore = create<MemoryState>((set, get) => ({
  memories: [],
  loading: false,
  error: null,
  total: 0,
  page: 1,
  pageSize: 20,
  typeGroup: undefined,

  fetchMemories: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const { page, pageSize, typeGroup } = get();
      const res = await memoryApi.list({
        page: params.page ?? page,
        limit: params.limit ?? pageSize,
        type_group: params.type_group ?? typeGroup,
      });
      set({
        memories: res.items,
        total: res.total,
        page: res.page,
        pageSize: res.pageSize,
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message || '加载记忆失败', loading: false });
    }
  },

  createMemory: async (data) => {
    set({ loading: true, error: null });
    try {
      await memoryApi.create(data);
      await get().fetchMemories({ page: 1 });
    } catch (err: any) {
      set({ error: err.message || '创建记忆失败', loading: false });
    }
  },

  uploadFiles: async (files, note) => {
    set({ loading: true, error: null });
    try {
      await fileApi.upload(files, note);
      await get().fetchMemories({ page: 1 });
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.message || '文件上传失败', loading: false });
    }
  },

  deleteMemory: async (id) => {
    set({ loading: true, error: null });
    try {
      await memoryApi.remove(id);
      await get().fetchMemories({ page: get().page });
    } catch (err: any) {
      set({ error: err.message || '删除记忆失败', loading: false });
    }
  },

  setPage: (page) => set({ page }),
  setTypeGroup: (group) => set({ typeGroup: group, page: 1 }),
}));
