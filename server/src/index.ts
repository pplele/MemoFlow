import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import { initDb } from './db/index.js';
import memoryRoutes from './routes/memory.js';
import searchRoutes from './routes/search.js';
import qaRoutes from './routes/qa.js';
import factRoutes from './routes/fact.js';
import fileRoutes from './routes/file.js';
import statsRoutes from './routes/stats.js';
import linkRoutes from './routes/links.js';
import feishuRoutes from './routes/feishu.js';
import agentRoutes from './routes/agent.js';
import aiConfigRoutes from './routes/ai-config.js';
import { startVaultWatcher } from './services/vault-watcher.js';
import { startFeishuLongConnection } from './services/feishu.js';
import { generateApiToken, getApiToken, requireAuth } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('charset', 'utf-8');
  next();
});

app.use('/api/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    apiToken: getApiToken() || null,
  });
});

app.use('/api', requireAuth);

app.use('/api/memories', memoryRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/qa', qaRoutes);
app.use('/api/facts', factRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/links', linkRoutes);
app.use('/api/feishu', feishuRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api', aiConfigRoutes);

app.use('/assets', express.static(path.join(config.vault.path, 'assets')));
app.use('/uploads', express.static(path.join(config.vault.path, 'uploads')));

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

async function start() {
  try {
    await initDb();
    console.log('[DB] Database initialized');

    if (config.vault.watchEnabled) {
      startVaultWatcher();
      console.log('[Vault] File watcher started');
    }

    startFeishuLongConnection();

    const token = generateApiToken();

    app.listen(config.port, () => {
      console.log(`[Server] MemoFlow server running on http://localhost:${config.port}`);
      console.log(`[Server] Environment: ${config.nodeEnv}`);
      console.log(`[Vault] Path: ${config.vault.path}`);
      console.log(`[Security] API Token: ${token}`);
      console.log(`[Security] Add this token to your frontend requests as: Authorization: Bearer ${token}`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

start();
