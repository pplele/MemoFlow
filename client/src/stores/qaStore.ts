import { create } from 'zustand';
import { qaApi } from '@/api/qa';
import type { QARequest, QAResponse } from '@/types';

interface QAState {
  question: string;
  answer: string;
  sources: QAResponse['sources'];
  loading: boolean;
  error: string | null;
  history: Array<{ question: string; answer: string }>;

  ask: (question: string) => Promise<void>;
  clear: () => void;
}

export const useQAStore = create<QAState>((set) => ({
  question: '',
  answer: '',
  sources: [],
  loading: false,
  error: null,
  history: [],

  ask: async (question) => {
    if (!question.trim()) return;
    set({ loading: true, error: null, question });
    try {
      const res = await qaApi.ask({ question: question.trim() });
      set((state) => ({
        answer: res.answer,
        sources: res.sources,
        history: [...state.history, { question, answer: res.answer }],
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message || '问答请求失败', loading: false });
    }
  },

  clear: () =>
    set({ question: '', answer: '', sources: [], error: null, history: [] }),
}));
