import { Router, Request, Response, NextFunction } from 'express';
import { parseMessage, verifyToken, sendTextToWebhook, isNotifyEnabled, FeishuEventPayload, startFeishuLongConnection } from '../services/feishu.js';
import { createMemory } from '../services/memory-parser.js';
import { memoryDb } from '../db/index.js';
import { config } from '../config/index.js';
import { updateEnvFile } from '../utils/env-writer.js';

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
    config: {
      webhookUrl: config.feishu.webhookUrl || '',
      appId: config.feishu.appId || '',
      appSecret: config.feishu.appSecret ? '***' : '',
      verificationToken: config.feishu.verificationToken || '',
      notifyChatId: config.feishu.notifyChatId || '',
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

/**
 * POST /feishu/config
 * 保存飞书配置
 * body: { webhookUrl?: string, appId?: string, appSecret?: string, verificationToken?: string, notifyChatId?: string }
 */
router.post('/config', async (req: Request, res: Response) => {
  try {
    const { webhookUrl, appId, appSecret, verificationToken, notifyChatId } = req.body || {};

    if (webhookUrl !== undefined) {
      process.env.FEISHU_WEBHOOK_URL = webhookUrl;
      updateEnvFile('FEISHU_WEBHOOK_URL', webhookUrl);
    }
    if (appId !== undefined) {
      process.env.FEISHU_APP_ID = appId;
      updateEnvFile('FEISHU_APP_ID', appId);
    }
    if (appSecret !== undefined && appSecret !== '***') {
      process.env.FEISHU_APP_SECRET = appSecret;
      updateEnvFile('FEISHU_APP_SECRET', appSecret);
    }
    if (verificationToken !== undefined) {
      process.env.FEISHU_VERIFICATION_TOKEN = verificationToken;
      updateEnvFile('FEISHU_VERIFICATION_TOKEN', verificationToken);
    }
    if (notifyChatId !== undefined) {
      process.env.FEISHU_NOTIFY_CHAT_ID = notifyChatId;
      updateEnvFile('FEISHU_NOTIFY_CHAT_ID', notifyChatId);
    }

    if (process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET) {
      startFeishuLongConnection();
    }

    res.json({
      success: true,
      message: '飞书配置已保存',
      configured: {
        webhook_url: !!process.env.FEISHU_WEBHOOK_URL,
        app_id: !!process.env.FEISHU_APP_ID,
        app_secret: !!process.env.FEISHU_APP_SECRET,
        verification_token: !!process.env.FEISHU_VERIFICATION_TOKEN,
        notify_chat_id: process.env.FEISHU_NOTIFY_CHAT_ID || null,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '保存失败',
    });
  }
});

const FEISHU_ERROR_MAP: Record<number | string, string> = {
  10011: 'App ID 或 App Secret 错误，请检查凭证',
  90002: '服务暂时不可用，请稍后重试',
  40003: '权限不足，请在飞书后台开通相关权限',
  40001: '无效的请求参数',
  10000: '系统错误，请稍后重试',
};

function mapFeishuError(code: number | string | undefined): string {
  if (code === undefined) return '未知错误';
  return FEISHU_ERROR_MAP[code] || `错误码 ${code}，请查看飞书开发者文档`;
}

/**
 * POST /feishu/test-connection
 * 测试飞书长连接配置（使用 App ID 和 App Secret）
 */
router.post('/test-connection', async (req: Request, res: Response) => {
  try {
    const { appId, appSecret } = req.body || {};
    
    if (!appId || !appSecret) {
      return res.status(400).json({ success: false, message: 'App ID 和 App Secret 不能为空' });
    }

    try {
      const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
      });
      const result = (await response.json()) as Record<string, unknown>;
      
      const code = result.code as number;
      if (code === 0) {
        res.json({ 
          success: true, 
          message: '飞书连接测试成功',
        });
      } else {
        res.status(400).json({ 
          success: false, 
          message: mapFeishuError(code) 
        });
      }
    } catch (err: any) {
      const errorCode = err?.code || err?.response?.status;
      res.status(400).json({ 
        success: false, 
        message: mapFeishuError(errorCode) 
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '测试失败',
    });
  }
});

export default router;
