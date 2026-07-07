import { create } from 'zustand';
import { statsApi } from '@/api/stats';
import type { DashboardStats } from '@/types';

interface StatsState {
  stats: DashboardStats | null;
  loading: boolean;
  error: string | null;

  fetchStats: () => Promise<void>;
}

export const useStatsStore = create<StatsState>((set) => ({
  stats: null,
  loading: false,
  error: null,

  fetchStats: async () => {
    set({ loading: true, error: null });
    try {
      const res = await statsApi.getDashboard();
      set({ stats: res, loading: false });
    } catch (err: any) {
      set({ error: err.message || '加载统计数据失败', loading: false });
    }
  },
}));
