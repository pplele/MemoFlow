import { useState } from 'react';
import { ChevronDown, ChevronRight, Check, X, Loader2 } from 'lucide-react';
import type { AgentToolCall, AgentToolResult } from '@/types';

const TOOL_LABELS: Record<string, string> = {
  search_memories: '搜索记忆',
  get_memory: '获取记忆',
  create_memory: '创建记忆',
  list_memories: '列出记忆',
  get_facts: '查询事实',
  get_facts_by_entity: '查询实体事实',
  get_knowledge_graph: '知识图谱',
  get_stats: '统计概览',
  semantic_search: '语义搜索',
  find_similar: '查找相似',
};

interface ToolCallCardProps {
  toolCall: AgentToolCall;
  result?: AgentToolResult;
}

export default function ToolCallCard({ toolCall, result }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const label = TOOL_LABELS[toolCall.name] || toolCall.name;
  const isComplete = !!result;
  const isError = result?.error;

  const statusIcon = isComplete ? (
    isError ? <X className="h-3.5 w-3.5 text-red-400" /> : <Check className="h-3.5 w-3.5 text-green-400" />
  ) : (
    <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
  );

  const truncateStr = (str: string, max = 200) =>
    str.length > max ? str.slice(0, max) + '...' : str;

  return (
    <div className="rounded-lg border border-border-primary bg-bg-tertiary text-xs overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-bg-secondary transition-colors"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span className="text-accent font-medium">{label}</span>
        <span className="text-text-tertiary">{toolCall.name}</span>
        <span className="ml-auto">{statusIcon}</span>
      </button>
      {expanded && (
        <div className="border-t border-border-primary px-3 py-2 space-y-1.5">
          <div>
            <span className="text-text-tertiary">参数：</span>
            <code className="text-text-secondary break-all">
              {truncateStr(JSON.stringify(toolCall.arguments))}
            </code>
          </div>
          {result && (
            <div>
              <span className="text-text-tertiary">结果：</span>
              <code className="text-text-secondary break-all">
                {truncateStr(result.result)}
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
