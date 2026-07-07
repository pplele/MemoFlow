import { api } from './index';
import type {
  Memory,
  MemoryListResponse,
  CreateMemoryRequest,
  CreateMemoryResponse,
  DeleteResponse,
} from '@/types';

export const memoryApi = {
  create(data: CreateMemoryRequest): Promise<CreateMemoryResponse> {
    return api.request<CreateMemoryResponse>('/memories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  list(params?: {
    page?: number;
    limit?: number;
    category?: string;
    date_from?: string;
    date_to?: string;
    tier?: 'hot' | 'warm' | 'cold';
    type_group?: 'text' | 'files';
  }): Promise<MemoryListResponse> {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.category) search.set('category', params.category);
    if (params?.date_from) search.set('date_from', params.date_from);
    if (params?.date_to) search.set('date_to', params.date_to);
    if (params?.tier) search.set('tier', params.tier);
    if (params?.type_group) search.set('type_group', params.type_group);
    return api.request<MemoryListResponse>(`/memories?${search.toString()}`);
  },

  get(id: string): Promise<Memory> {
    return api.request<Memory>(`/memories/${id}`);
  },

  update(id: string, data: { content: string }): Promise<Memory> {
    return api.request<Memory>(`/memories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  remove(id: string): Promise<DeleteResponse> {
    return api.request<DeleteResponse>(`/memories/${id}`, { method: 'DELETE' });
  },
};
