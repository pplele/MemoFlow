import { getAdapter } from '../ai.js';
import { getOpenAITools, executeTool } from './tools.js';
import { sanitizeError } from '../../utils/index.js';

// ==================== 类型定义 ====================

export interface AgentChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

export interface AgentStreamEvent {
  type: 'thought' | 'tool_call' | 'tool_result' | 'answer' | 'error' | 'done';
  data: unknown;
}

// ==================== System Prompt ====================

const SYSTEM_PROMPT = `你是 MemoFlow 智能记忆管家，用户的个人数字记忆助手。

你的工作方式：
1. 理解用户的问题或需求
2. 使用提供的工具来搜索、查询、创建或分析记忆
3. 基于工具返回的结果，给出有帮助的回答

工具使用指南：
- 搜索记忆：使用 search_memories 或 semantic_search
- 查看特定记忆：使用 get_memory
- 创建新记忆：使用 create_memory
- 浏览记忆列表：使用 list_memories
- 查询事实：使用 get_facts 或 get_facts_by_entity
- 分析关联：使用 get_knowledge_graph
- 统计概览：使用 get_stats
- 查找相似：使用 find_similar
- 搜索文件：使用 search_files 或 list_files
- 获取时间：使用 get_current_time（当用户询问时间、日期时）
- 数学计算：使用 calculator（当用户需要精确计算时）
- 网页搜索：使用 web_search（当用户询问实时信息、新闻时）
- 网页抓取：使用 web_fetch（当需要获取网页详细内容时）
- 获取天气：使用 get_weather（需要配置 OPENWEATHER_API_KEY）

回答规则：
1. 先搜索再回答，不要凭空编造
2. 没有相关信息时明确告知
3. 引用来源时标注记忆 ID
4. 回答简洁有条理，使用中文
5. 用户要记录新信息时使用 create_memory
6. 复杂问题可多次调用工具综合回答
7. 需要精确计算时必须使用 calculator，不要直接回答
8. 用户询问时间、日期时必须使用 get_current_time`;

// ==================== 豆包 API 调用 ====================

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason?: string;
  }>;
}

async function callLlm(
  messages: AgentChatMessage[],
  signal?: AbortSignal
): Promise<ChatCompletionResponse> {
  const adapter = getAdapter();
  const tools = getOpenAITools();
  
  let url: string;
  let headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  if (adapter.provider === 'ollama') {
    url = `${adapter.baseUrl}/api/chat`;
  } else {
    url = `${adapter.baseUrl}/chat/completions`;
    headers['Authorization'] = `Bearer ${adapter.apiKey}`;
  }
  
  const timeoutSignal = AbortSignal.timeout(60000);
  const combinedSignal = signal 
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: adapter.model,
      messages,
      tools,
      temperature: 0.3,
    }),
    signal: combinedSignal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    const sanitized = sanitizeError(errorText);
    throw new Error(`LLM API 错误: ${response.status} - ${sanitized}`);
  }

  return response.json() as Promise<ChatCompletionResponse>;
}

// ==================== Agent 核心循环 ====================

export async function runAgent(
  userMessage: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  emit: (event: AgentStreamEvent) => void,
  options?: { maxIterations?: number; timeoutMs?: number }
): Promise<void> {
  const maxIterations = options?.maxIterations ?? 10;
  const timeoutMs = options?.timeoutMs ?? 60000;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const messages: AgentChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  const recentHistory = history.slice(-20);
  for (const h of recentHistory) {
    messages.push({ role: h.role, content: h.content });
  }

  messages.push({ role: 'user', content: userMessage });

  try {
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const data = await callLlm(messages, controller.signal);
      const choice = data.choices?.[0];
      const assistantMessage = choice?.message;

      if (!assistantMessage) {
        emit({ type: 'error', data: 'LLM 返回空响应' });
        break;
      }

      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        messages.push({
          role: 'assistant',
          content: assistantMessage.content || '',
          tool_calls: assistantMessage.tool_calls,
        });

        if (assistantMessage.content && assistantMessage.content.trim()) {
          emit({ type: 'thought', data: assistantMessage.content.trim() });
        }

        for (const tc of assistantMessage.tool_calls) {
          const toolName = tc.function.name;
          let toolArgs: Record<string, unknown> = {};
          try {
            toolArgs = JSON.parse(tc.function.arguments);
          } catch {
            toolArgs = {};
          }

          emit({
            type: 'tool_call',
            data: { id: tc.id, name: toolName, arguments: toolArgs },
          });

          const result = await executeTool(toolName, toolArgs);

          emit({
            type: 'tool_result',
            data: { id: tc.id, name: toolName, result },
          });

          messages.push({
            role: 'tool',
            content: result,
            tool_call_id: tc.id,
            name: toolName,
          });
        }

        continue;
      }

      const answer = assistantMessage.content || '';
      if (answer) {
        emit({ type: 'answer', data: answer });
      }
      break;
    }

    if (messages.length > 2 && messages[messages.length - 1].role !== 'assistant') {
      emit({ type: 'answer', data: '抱歉，我进行了多轮工具调用但未能得到最终答案，请尝试简化你的问题。' });
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      emit({ type: 'error', data: '请求超时，请稍后重试' });
    } else {
      emit({ type: 'error', data: `Agent 执行出错: ${err.message}` });
    }
  } finally {
    clearTimeout(timeout);
    emit({ type: 'done', data: null });
  }
}
