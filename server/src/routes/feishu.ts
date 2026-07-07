import { Router, Request, Response, NextFunction } from 'express';
import { parseMessage, verifyToken, sendTextToWebhook, isNotifyEnabled, FeishuEventPayload } from '../services/feishu.js';
import { createMemory } from '../services/memory-parser.js';
import { memoryDb } from '../db/index.js';
import { config } from '../config/index.js';

const router = Router();

/**
 * POST /feishu/webhook
 * 接收飞书事件订阅回调
 *
 * 支持两种模式：
 * 1. URL 验证（飞书首次配置时发送 challenge）
 * 2. 消息事件回调
 */
router.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = req.body as FeishuEventPayload;

    // 1. URL verification
    if (payload?.type === 'url_verification' && payload.challenge) {
      return res.json({ challenge: payload.challenge });
    }

    // 2. event callback
    if (payload?.type === 'event_callback') {
      if (!verifyToken(payload.token)) {
        return res.status(401).json({ error: 'Invalid verification token' });
      }

      const parsed = parseMessage(payload);
      if (!parsed) {
        // 不支持的消息类型，静默 ack（避免飞书重试）
        return res.json({ ok: true, ignored: 'unsupported_message_type' });
      }

      // 异步创建记忆（不阻塞飞书响应）
      createMemory({
        content: parsed.text,
        source: 'feishu',
        type: 'text',
      })
        .then((mem) => {
          console.log(`[Feishu] Created memory from ${parsed.chatType} chat: ${mem.id}`);
        })
        .catch((err) => {
          console.error('[Feishu] Failed to create memory from message:', err);
        });

      return res.json({ ok: true });
    }

    return res.json({ ok: true, ignored: 'unknown_payload' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /feishu/status
 * 查看飞书集成状态
 */
router.get('/status', async (_req: Request, res: Response) => {
  res.json({
    enabled: isNotifyEnabled(),
    configured: {
      webhook_url: !!config.feishu.webhookUrl,
      app_id: !!config.feishu.appId,
      app_secret: !!config.feishu.appSecret,
      verification_token: !!config.feishu.verificationToken,
      notify_chat_id: config.feishu.notifyChatId || null,
    },
    memory_count: memoryDb.all().length,
  });
});

/**
 * POST /feishu/test
 * 主动发送一条测试消息到 webhook（用于验证配置）
 */
router.post('/test', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const text = `🧠 MemoFlow 测试消息\n\n收到此消息表示飞书推送配置成功！\n时间：${new Date().toLocaleString('zh-CN')}`;
    const ok = await sendTextToWebhook(text);
    if (!ok) {
      return res.status(400).json({
        success: false,
        error: 'FEISHU_WEBHOOK_URL 未配置或发送失败',
      });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /feishu/simulate
 * 本地模拟一条飞书事件（无需真实飞书账号，仅用于开发调试）
 * body: { text: string, chat_id?: string }
 */
router.post('/simulate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { text, chat_id } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }
    const mem = await createMemory({
      content: text,
      source: 'feishu-simulated',
      type: 'text',
    });
    res.json({
      success: true,
      memory: {
        id: mem.id,
        file_path: mem.file_path,
        category: mem.category,
      },
      chat_id: chat_id || 'simulated_chat',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
