import { create } from 'zustand';
import { factApi } from '@/api/fact';
import type { Fact } from '@/types';

interface FactState {
  facts: Fact[];
  loading: boolean;
  extracting: boolean;
  error: string | null;
  total: number;
  searchQuery: string;

  fetchFacts: () => Promise<void>;
  updateFact: (id: string, data: Partial<Fact>) => Promise<void>;
  deleteFact: (id: string) => Promise<void>;
  extractFromMemories: () => Promise<number>;
  setSearchQuery: (q: string) => void;
}

export const useFactStore = create<FactState>((set, get) => ({
  facts: [],
  loading: false,
  extracting: false,
  error: null,
  total: 0,
  searchQuery: '',

  fetchFacts: async () => {
    set({ loading: true, error: null });
    try {
      const res = await factApi.list();
      set({ facts: res.items, total: res.total, loading: false });
    } catch (err: any) {
      set({ error: err.message || '加载事实库失败', loading: false });
    }
  },

  updateFact: async (id, data) => {
    set({ error: null });
    try {
      const updated = await factApi.update(id, data);
      set((state) => ({
        facts: state.facts.map((f) => (f.id === id ? updated : f)),
      }));
    } catch (err: any) {
      set({ error: err.message || '更新失败' });
    }
  },

  deleteFact: async (id) => {
    try {
      await factApi.remove(id);
      set((state) => ({
        facts: state.facts.filter((f) => f.id !== id),
        total: Math.max(0, state.total - 1),
      }));
    } catch (err: any) {
      set({ error: err.message || '删除失败' });
    }
  },

  extractFromMemories: async () => {
    set({ extracting: true, error: null });
    try {
      const res = await factApi.extract();
      await get().fetchFacts();
      set({ extracting: false });
      if (res.success === false) {
        set({ error: res.error || '提取失败' });
        return 0;
      }
      return res.extracted_count;
    } catch (err: any) {
      set({ error: err.message || '提取失败', extracting: false });
      return 0;
    }
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
}));
