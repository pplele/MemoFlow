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
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',

  doubao: {
    apiKey: process.env.DOUBAO_API_KEY || '',
    baseUrl: process.env.DOUBAO_API_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
    model: process.env.DOUBAO_MODEL || 'doubao-1-5-pro-32k',
    embeddingModel: process.env.DOUBAO_EMBEDDING_MODEL || 'doubao-embedding',
  },

  vault: {
    path: resolveFromRoot(process.env.VAULT_PATH || './vault'),
    watchEnabled: process.env.VAULT_WATCH_ENABLED !== 'false',
    watchDebounceMs: parseInt(process.env.VAULT_WATCH_DEBOUNCE_MS || '500', 10),
  },

  db: {
    path: resolveFromRoot(process.env.DB_PATH || './server/data/memoflow.db'),
  },

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10),
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'pdf,docx,xlsx,pptx,jpg,jpeg,png,gif,txt,zip,rar,7z').split(',').map((t) => t.trim()),
  },

  feishu: {
    webhookUrl: process.env.FEISHU_WEBHOOK_URL || '',
    appId: process.env.FEISHU_APP_ID || '',
    appSecret: process.env.FEISHU_APP_SECRET || '',
    verificationToken: process.env.FEISHU_VERIFICATION_TOKEN || '',
    notifyChatId: process.env.FEISHU_NOTIFY_CHAT_ID || '',
  },
};
