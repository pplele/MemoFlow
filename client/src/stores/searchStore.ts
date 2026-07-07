import { create } from 'zustand';
import { searchApi } from '@/api/search';
import type { Memory, Fact, SearchResult } from '@/types';

interface SearchState {
  query: string;
  memories: Array<Memory & { score: number }>;
  facts: Fact[];
  loading: boolean;
  error: string | null;
  searchMeta: SearchResult['search_meta'] | null;

  search: (query: string) => Promise<void>;
  clear: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  memories: [],
  facts: [],
  loading: false,
  error: null,
  searchMeta: null,

  search: async (query) => {
    if (!query.trim()) return;
    set({ loading: true, error: null, query });
    try {
      const res = await searchApi.search(query.trim());
      set({
        memories: res.memories,
        facts: res.facts,
        searchMeta: res.search_meta ?? null,
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message || '搜索失败', loading: false });
    }
  },

  clear: () =>
    set({ query: '', memories: [], facts: [], error: null, searchMeta: null }),
}));
