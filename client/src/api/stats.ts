import { api } from './index';
import type { DashboardStats } from '@/types';

export const statsApi = {
  getDashboard(): Promise<DashboardStats> {
    return api.request<DashboardStats>('/stats/dashboard');
  },
};
