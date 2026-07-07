import { create } from 'zustand';
import { agentChat } from '@/api/agent';
import type { AgentChatMessage, AgentStreamEvent, AgentToolCall, AgentToolResult } from '@/types';

interface AgentState {
  messages: AgentChatMessage[];
  isStreaming: boolean;
  currentContent: string;
  currentThought: string;
  currentToolCalls: AgentToolCall[];
  currentToolResults: AgentToolResult[];
  error: string | null;

  sendMessage: (message: string) => Promise<void>;
  clearHistory: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  messages: [],
  isStreaming: false,
  currentContent: '',
  currentThought: '',
  currentToolCalls: [],
  currentToolResults: [],
  error: null,

  sendMessage: async (message: string) => {
    const userMsg: AgentChatMessage = { role: 'user', content: message };
    set((state) => ({
      messages: [...state.messages, userMsg],
      isStreaming: true,
      currentContent: '',
      currentThought: '',
      currentToolCalls: [],
      currentToolResults: [],
      error: null,
    }));

    const history = get().messages
      .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content))
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }));

    await agentChat({
      message,
      history,
      onEvent: (event: AgentStreamEvent) => {
        switch (event.type) {
          case 'thought':
            set({ currentThought: event.data as string });
            break;
          case 'tool_call':
            set((state) => ({
              currentToolCalls: [...state.currentToolCalls, event.data as AgentToolCall],
            }));
            break;
          case 'tool_result':
            set((state) => ({
              currentToolResults: [...state.currentToolResults, event.data as AgentToolResult],
            }));
            break;
          case 'answer':
            set((state) => ({ currentContent: state.currentContent + (event.data as string) }));
            break;
          case 'error':
            set({ error: event.data as string });
            break;
        }
      },
      onDone: () => {
        const { currentContent, currentToolCalls, currentToolResults } = get();
        const assistantMsg: AgentChatMessage = {
          role: 'assistant',
          content: currentContent,
          toolCalls: currentToolCalls.length > 0 ? currentToolCalls : undefined,
          toolResults: currentToolResults.length > 0 ? currentToolResults : undefined,
        };
        set((state) => ({
          messages: [...state.messages, assistantMsg],
          isStreaming: false,
          currentContent: '',
          currentToolCalls: [],
          currentToolResults: [],
        }));
      },
      onError: (error: Error) => {
        set({ error: error.message, isStreaming: false });
      },
    });
  },

  clearHistory: () => {
    set({
      messages: [],
      isStreaming: false,
      currentContent: '',
      currentThought: '',
      currentToolCalls: [],
      currentToolResults: [],
      error: null,
    });
  },
}));
