import crypto from 'crypto';
import { config } from '../config/index.js';

/**
 * 飞书事件订阅的消息体结构
 */
export interface FeishuEventPayload {
  challenge?: string;
  token?: string;
  type?: 'url_verification' | 'event_callback';
  ts?: string;
  uuid?: string;
  event?: {
    type?: string;
    sender?: {
      sender_id?: { open_id?: string; user_id?: string };
      sender_type?: string;
    };
    message?: {
      message_id?: string;
      chat_id?: string;
      chat_type?: 'p2p' | 'group';
      message_type?: 'text' | 'post' | 'image' | 'file';
      content?: string; // JSON string
      mentions?: Array<{ key: string; id?: { open_id?: string } }>;
    };
  };
}

export interface FeishuParsedMessage {
  chatId: string;
  chatType: 'p2p' | 'group' | 'unknown';
  text: string;
  senderId?: string;
  messageType: string;
  raw: FeishuEventPayload;
}

/** 验证事件 token 是否匹配（首次验证时跳过） */
export function verifyToken(token: string | undefined): boolean {
  if (!config.feishu.verificationToken) {
    // 未配置 token 时跳过验证（开发模式）
    return true;
  }
  return token === config.feishu.verificationToken;
}

/** 解析事件回调，提取可用的消息文本 */
export function parseMessage(payload: FeishuEventPayload): FeishuParsedMessage | null {
  if (!payload?.event?.message) return null;
  const m = payload.event.message;
  let text = '';
  try {
    const content = m.content ? JSON.parse(m.content) : {};
    if (m.message_type === 'text' && typeof content.text === 'string') {
      text = content.text;
    } else if (m.message_type === 'post' && content.content) {
      // post 消息：content.content 是 [[{tag, text}], ...] 结构
      const parts: string[] = [];
      for (const para of content.content || []) {
        for (const node of para || []) {
          if (node?.tag === 'text' && typeof node.text === 'string') {
            parts.push(node.text);
          }
        }
      }
      text = parts.join('\n');
    } else if (m.message_type === 'image' && content.image_key) {
      text = `[图片] image_key=${content.image_key}`;
    } else if (m.message_type === 'file' && content.file_key) {
      text = `[文件] file_key=${content.file_name || content.file_key}`;
    } else {
      return null;
    }
  } catch {
    return null;
  }

  // 去掉 @ 机器人 的提及标记
  if (m.mentions) {
    for (const mention of m.mentions) {
      text = text.split(mention.key).join('');
    }
  }
  text = text.trim();

  if (!text) return null;

  return {
    chatId: m.chat_id || '',
    chatType: m.chat_type || 'unknown',
    text,
    senderId: payload.event.sender?.sender_id?.open_id,
    messageType: m.message_type || 'text',
    raw: payload,
  };
}

/** 飞书自定义机器人 webhook 签名（用于主动发消息） */
export function signWebhookPayload(
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000)
): string {
  const stringToSign = `${timestamp}\n${secret}`;
  const hmac = crypto.createHmac('sha256', stringToSign);
  return hmac.digest('base64');
}

/**
 * 主动发送文本消息到飞书群（通过 incoming webhook）
 * 如果未配置 webhookUrl 则直接返回 false，不抛错
 */
export async function sendTextToWebhook(text: string): Promise<boolean> {
  if (!config.feishu.webhookUrl) {
    console.warn('[Feishu] FEISHU_WEBHOOK_URL not configured, skipping');
    return false;
  }
  try {
    const ts = Math.floor(Date.now() / 1000);
    const sign = signWebhookPayload(config.feishu.appSecret, ts);
    const res = await fetch(config.feishu.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: String(ts),
        sign,
        msg_type: 'text',
        content: { text },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[Feishu] Webhook send failed: ${res.status} ${body}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Feishu] Webhook send error:', (err as Error).message);
    return false;
  }
}

/** 通知配置：当前是否启用了主动推送 */
export function isNotifyEnabled(): boolean {
  return !!config.feishu.webhookUrl || !!config.feishu.appId;
}
