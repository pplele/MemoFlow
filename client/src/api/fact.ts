import { api } from './index';
import type {
  Fact,
  FactListResponse,
  FactByEntityResponse,
  DeleteResponse,
} from '@/types';

export const factApi = {
  list(): Promise<FactListResponse> {
    return api.request<FactListResponse>('/facts');
  },

  getByEntity(entity: string): Promise<FactByEntityResponse> {
    return api.request<FactByEntityResponse>(`/facts/${encodeURIComponent(entity)}`);
  },

  update(id: string, data: Partial<Fact>): Promise<Fact> {
    return api.request<Fact>(`/facts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  remove(id: string): Promise<DeleteResponse> {
    return api.request<DeleteResponse>(`/facts/${id}`, { method: 'DELETE' });
  },

  extract(): Promise<{ extracted_count: number; facts: any[]; success?: boolean; error?: string }> {
    return api.request<{ extracted_count: number; facts: any[]; success?: boolean; error?: string }>(
      '/facts/extract',
      { method: 'POST' }
    );
  },
};
