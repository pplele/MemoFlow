import type { AgentStreamEvent } from '@/types';

interface AgentChatOptions {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  onEvent: (event: AgentStreamEvent) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export async function agentChat(options: AgentChatOptions): Promise<void> {
  const { message, history, onEvent, onDone, onError } = options;

  try {
    const response = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: history || [] }),
    });

    if (!response.ok) {
      throw new Error(`Agent API 错误: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法获取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const jsonStr = trimmed.slice(6);
        try {
          const event: AgentStreamEvent = JSON.parse(jsonStr);
          onEvent(event);
          if (event.type === 'done') {
            onDone();
            return;
          }
        } catch {
          // 忽略解析错误
        }
      }
    }

    onDone();
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}
