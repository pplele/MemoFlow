import { api } from './index';
import type { QARequest, QAResponse } from '@/types';

export const qaApi = {
  ask(data: QARequest): Promise<QAResponse> {
    return api.request<QAResponse>('/qa', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
