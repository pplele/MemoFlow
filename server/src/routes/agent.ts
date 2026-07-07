import { Router, Request, Response } from 'express';
import { runAgent, AgentStreamEvent } from '../services/agent/loop.js';

const router = Router();

// ==================== POST /api/agent/chat ====================

router.post('/chat', async (req: Request, res: Response) => {
  const { message, history } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // SSE 发射函数
  const emit = (event: AgentStreamEvent) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      // 客户端已断开
    }
  };

  // 客户端断开时清理
  req.on('close', () => {
    // 流已结束，无需额外处理
  });

  try {
    const chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = Array.isArray(history)
      ? history.filter((h: any) => h.role && h.content)
      : [];

    await runAgent(message.trim(), chatHistory, emit);
  } catch (err: any) {
    // 如果 headers 已发送，通过 SSE 发送错误
    emit({ type: 'error', data: `服务端错误: ${err.message}` });
    emit({ type: 'done', data: null });
  }

  res.end();
});

export default router;
