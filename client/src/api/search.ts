import { api } from './index';
import type { SearchResult } from '@/types';

export const searchApi = {
  search(query: string): Promise<SearchResult> {
    return api.request<SearchResult>(`/search?q=${encodeURIComponent(query)}`);
  },
};
