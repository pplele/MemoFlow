import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '../../..');

function findEnvFile(): string | null {
  const candidates = [
    path.join(projectRoot, '.env'),
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '../', '.env'),
    path.join(process.cwd(), '../../', '.env'),
  ];

  for (const candidate of candidates) {
    if (candidate && path.isAbsolute(candidate)) {
      try {
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

const envPath = findEnvFile();
if (envPath) {
  dotenv.config({ path: envPath });
}

function resolveFromRoot(p: string): string {
  return path.isAbsolute(p) ? p : path.join(projectRoot, p);
}

export const config = {
  get port(): number {
    return parseInt(process.env.PORT || '3001', 10);
  },
  get nodeEnv(): string {
    return process.env.NODE_ENV || 'development';
  },
  get clientUrl(): string {
    return process.env.CLIENT_URL || 'http://localhost:3000';
  },

  get llm() {
    return {
      provider: process.env.LLM_PROVIDER || 'doubao',
      apiKey: process.env.LLM_API_KEY || process.env.DOUBAO_API_KEY || '',
      baseUrl: process.env.LLM_BASE_URL || process.env.DOUBAO_API_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
      model: process.env.LLM_MODEL || process.env.DOUBAO_MODEL || 'doubao-1-5-pro-32k',
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.3'),
    };
  },

  get embedding() {
    return {
      provider: process.env.EMBEDDING_PROVIDER || '',
      apiKey: process.env.EMBEDDING_API_KEY || '',
      baseUrl: process.env.EMBEDDING_BASE_URL || '',
      model: process.env.EMBEDDING_MODEL || '',
    };
  },

  get ollama() {
    return {
      enabled: process.env.OLLAMA_ENABLED === 'true',
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'qwen2.5:14b',
    };
  },

  get vault() {
    return {
      path: resolveFromRoot(process.env.VAULT_PATH || './vault'),
      watchEnabled: process.env.VAULT_WATCH_ENABLED !== 'false',
      watchDebounceMs: parseInt(process.env.VAULT_WATCH_DEBOUNCE_MS || '500', 10),
    };
  },

  get db() {
    return {
      path: resolveFromRoot(process.env.DB_PATH || './server/data/memoflow.db'),
    };
  },

  get upload() {
    return {
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10),
      allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'pdf,docx,xlsx,pptx,jpg,jpeg,png,gif,txt,zip,rar,7z').split(',').map((t) => t.trim()),
    };
  },

  get feishu() {
    return {
      webhookUrl: process.env.FEISHU_WEBHOOK_URL || '',
      appId: process.env.FEISHU_APP_ID || '',
      appSecret: process.env.FEISHU_APP_SECRET || '',
      verificationToken: process.env.FEISHU_VERIFICATION_TOKEN || '',
      notifyChatId: process.env.FEISHU_NOTIFY_CHAT_ID || '',
    };
  },
};
