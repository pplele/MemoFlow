import type { AgentChatMessage, AgentToolResult } from '@/types';
import ToolCallCard from './ToolCallCard';

interface AgentMessageProps {
  message: AgentChatMessage;
  toolResults?: AgentToolResult[];
}

export default function AgentMessage({ message, toolResults }: AgentMessageProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end animate-bubbleIn">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent px-4 py-3 text-sm text-white shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  // 助手消息
  return (
    <div className="flex justify-start animate-bubbleIn">
      <div className="max-w-[85%] space-y-2">
        {/* 工具调用卡片 */}
        {message.toolCalls?.map((tc) => {
          const result = toolResults?.find((r) => r.id === tc.id);
          return <ToolCallCard key={tc.id} toolCall={tc} result={result} />;
        })}
        {/* 回答文本 */}
        {message.content && (
          <div className="rounded-2xl rounded-bl-md border border-border-primary bg-bg-secondary px-4 py-3 text-sm text-text-primary leading-relaxed">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        )}
      </div>
    </div>
  );
}
