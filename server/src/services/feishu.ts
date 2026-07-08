import crypto from 'crypto';
import * as Lark from '@larksuiteoapi/node-sdk';
import { config } from '../config/index.js';
import { runAgent, AgentStreamEvent } from './agent/loop.js';
import { createMemory } from './memory-parser.js';

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
      content?: string;
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

let wsClient: InstanceType<typeof Lark.WSClient> | null = null;
let activeFeishuChats = new Set<string>();

export function verifyToken(token: string | undefined): boolean {
  if (!config.feishu.verificationToken) {
    return true;
  }
  return token === config.feishu.verificationToken;
}

export function parseMessage(payload: FeishuEventPayload): FeishuParsedMessage | null {
  if (!payload?.event?.message) return null;
  const m = payload.event.message;
  let text = '';
  try {
    const content = m.content ? JSON.parse(m.content) : {};
    if (m.message_type === 'text' && typeof content.text === 'string') {
      text = content.text;
    } else if (m.message_type === 'post' && content.content) {
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

export function signWebhookPayload(
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000)
): string {
  const stringToSign = `${timestamp}\n${secret}`;
  const hmac = crypto.createHmac('sha256', stringToSign);
  return hmac.digest('base64');
}

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

export async function sendTextToChat(chatId: string, text: string): Promise<boolean> {
  if (!config.feishu.appId || !config.feishu.appSecret) {
    console.error('[Feishu] App ID or App Secret not configured');
    return false;
  }
  try {
    const client = new Lark.Client({
      appId: config.feishu.appId,
      appSecret: config.feishu.appSecret,
    });
    const res = await client.im.v1.message.create({
      params: {
        receive_id_type: 'chat_id',
      },
      data: {
        receive_id: chatId,
        content: JSON.stringify({ text }),
        msg_type: 'text',
      },
    });
    return res.code === 0;
  } catch (err) {
    console.error('[Feishu] Send message failed:', (err as Error).message);
    return false;
  }
}

export async function handleFeishuMessage(parsed: FeishuParsedMessage): Promise<void> {
  const { chatId, text, chatType } = parsed;

  console.log(`[Feishu] Received message from ${chatType} chat ${chatId}: ${text}`);

  if (chatType === 'group' && !text.includes('@')) {
    console.log('[Feishu] Group message without @, ignoring');
    return;
  }

  if (activeFeishuChats.has(chatId)) {
    console.log(`[Feishu] Chat ${chatId} already has active session`);
    await sendTextToChat(chatId, '请等待上一条消息处理完成');
    return;
  }

  activeFeishuChats.add(chatId);
  let fullResponse = '';

  try {
    await createMemory({
      content: text,
      source: 'feishu',
      type: 'text',
    });

    const emit = (event: AgentStreamEvent) => {
      if (event.type === 'thought') return;
      if (event.type === 'tool_result') return;
      if (event.type === 'error') {
        fullResponse += `\n错误: ${event.data}`;
      } else if (typeof event.data === 'string') {
        fullResponse += event.data;
      }
    };

    await runAgent(text.trim(), [], emit);

    if (fullResponse.length > 0) {
      await sendTextToChat(chatId, fullResponse);
    } else {
      await sendTextToChat(chatId, '抱歉，我暂时无法回答这个问题');
    }
  } catch (err) {
    console.error('[Feishu] Agent processing failed:', (err as Error).message);
    await sendTextToChat(chatId, `处理失败: ${(err as Error).message}`);
  } finally {
    activeFeishuChats.delete(chatId);
  }
}

export function startFeishuLongConnection(): void {
  if (!config.feishu.appId || !config.feishu.appSecret) {
    console.warn('[Feishu] App ID or App Secret not configured, skipping long connection');
    return;
  }

  try {
    wsClient = new Lark.WSClient({
      appId: config.feishu.appId,
      appSecret: config.feishu.appSecret,
    });

    const eventDispatcher = new Lark.EventDispatcher({}).register({
      'im.message.receive_v1': async (data: any) => {
        const eventData = data?.event || data;
        const msg = eventData.message || {};
        const payload: FeishuEventPayload = {
          type: 'event_callback',
          event: {
            type: 'message',
            sender: {
              sender_id: {
                open_id: eventData.sender?.sender_id?.open_id,
                user_id: eventData.sender?.sender_id?.user_id,
              },
              sender_type: eventData.sender?.sender_type,
            },
            message: {
              message_id: msg.message_id,
              chat_id: msg.chat_id,
              chat_type: msg.chat_type === 'group' ? 'group' : 'p2p',
              message_type: msg.message_type,
              content: msg.content,
              mentions: msg.mentions?.map((m: any) => ({
                key: m.key,
                id: { open_id: m.id?.open_id },
              })),
            },
          },
        };
        const parsed = parseMessage(payload);
        if (parsed) {
          handleFeishuMessage(parsed).catch(console.error);
        }
      },
    });

    wsClient.start({ eventDispatcher });
    console.log('[Feishu] Long connection started successfully');
  } catch (err) {
    console.error('[Feishu] Failed to start long connection:', (err as Error).message);
  }
}

export function isNotifyEnabled(): boolean {
  return !!config.feishu.webhookUrl || !!config.feishu.appId;
}
