import { Router, Request, Response } from 'express';
import { config } from '../config/index.js';
import { resetAdapter } from '../services/ai.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = Router();

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface AIConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  ollamaEnabled: boolean;
  ollamaBaseUrl: string;
  ollamaModel: string;
  embeddingProvider: string;
  embeddingApiKey: string;
  embeddingBaseUrl: string;
  embeddingModel: string;
}

const DEFAULT_CONFIGS: Record<string, { baseUrl: string; model: string }> = {
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3-8b-chat' },
  mimo: { baseUrl: 'https://api.xiaomimimo.com/v1', model: 'mimo-v2.5-pro' },
  doubao: { baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-seed-1-6-251015' },
  ollama: { baseUrl: 'http://localhost:11434', model: 'qwen2.5:14b' },
};

function getProviderConfigs(): Record<string, ProviderConfig> {
  const encodedStr = process.env.PROVIDER_CONFIGS || '';
  if (!encodedStr) {
    return {};
  }
  try {
    const jsonStr = Buffer.from(encodedStr, 'base64').toString('utf-8');
    return JSON.parse(jsonStr);
  } catch {
    try {
      return JSON.parse(encodedStr);
    } catch {
      return {};
    }
  }
}

function saveProviderConfigs(configs: Record<string, ProviderConfig>): string {
  const jsonStr = JSON.stringify(configs);
  const encodedStr = Buffer.from(jsonStr, 'utf-8').toString('base64');
  process.env.PROVIDER_CONFIGS = encodedStr;
  return encodedStr;
}

function updateEnvFile(key: string, value: string) {
  const projectRoot = path.resolve(__dirname, '../../../');
  const envPath = path.join(projectRoot, '.env');
  
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }
  
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `${key}=${value}`);
  } else {
    envContent += `\n${key}=${value}`;
  }
  
  fs.writeFileSync(envPath, envContent, 'utf-8');
}

router.get('/ai-config', (req: Request, res: Response) => {
  const providerConfigs = getProviderConfigs();
  const currentProvider = config.llm.provider;
  const currentConfig = providerConfigs[currentProvider] || {};
  
  const providersWithConfig: Record<string, boolean> = {};
  Object.keys(DEFAULT_CONFIGS).forEach(key => {
    providersWithConfig[key] = !!providerConfigs[key]?.apiKey;
  });
  
  res.json({
    provider: currentProvider,
    apiKey: currentConfig.apiKey ? '***' : '',
    baseUrl: config.llm.baseUrl,
    model: config.llm.model,
    temperature: config.llm.temperature,
    ollamaEnabled: config.ollama.enabled,
    ollamaBaseUrl: config.ollama.baseUrl,
    ollamaModel: config.ollama.model,
    embeddingProvider: config.embedding.provider,
    embeddingApiKey: config.embedding.apiKey ? '***' : '',
    embeddingBaseUrl: config.embedding.baseUrl,
    embeddingModel: config.embedding.model,
    providersWithConfig,
  });
});

router.post('/ai-config', async (req: Request, res: Response) => {
  try {
    const body = req.body as AIConfig;
    const providerConfigs = getProviderConfigs();
    
    const provider = body.provider;
    
    const existingConfig = providerConfigs[provider] || {};
    
    if (body.apiKey && body.apiKey !== '***') {
      providerConfigs[provider] = {
        apiKey: body.apiKey,
        baseUrl: body.baseUrl || DEFAULT_CONFIGS[provider]?.baseUrl || '',
        model: body.model || DEFAULT_CONFIGS[provider]?.model || '',
      };
    } else if (existingConfig.apiKey) {
      providerConfigs[provider] = {
        apiKey: existingConfig.apiKey,
        baseUrl: body.baseUrl || DEFAULT_CONFIGS[provider]?.baseUrl || '',
        model: body.model || DEFAULT_CONFIGS[provider]?.model || '',
      };
    }
    
    const configsStr = saveProviderConfigs(providerConfigs);
    updateEnvFile('PROVIDER_CONFIGS', configsStr);
    
    const activeConfig = providerConfigs[provider] || {};
    
    process.env.LLM_PROVIDER = provider;
    process.env.LLM_API_KEY = activeConfig.apiKey || '';
    process.env.LLM_BASE_URL = body.baseUrl || activeConfig.baseUrl || DEFAULT_CONFIGS[provider]?.baseUrl || '';
    process.env.LLM_MODEL = body.model || activeConfig.model || DEFAULT_CONFIGS[provider]?.model || '';
    process.env.LLM_TEMPERATURE = String(body.temperature);
    process.env.OLLAMA_ENABLED = String(body.ollamaEnabled);
    process.env.OLLAMA_BASE_URL = body.ollamaBaseUrl;
    process.env.OLLAMA_MODEL = body.ollamaModel;
    process.env.EMBEDDING_PROVIDER = body.embeddingProvider;
    process.env.EMBEDDING_API_KEY = body.embeddingApiKey;
    process.env.EMBEDDING_BASE_URL = body.embeddingBaseUrl;
    process.env.EMBEDDING_MODEL = body.embeddingModel;
    
    updateEnvFile('LLM_PROVIDER', provider);
    updateEnvFile('LLM_API_KEY', activeConfig.apiKey || '');
    updateEnvFile('LLM_BASE_URL', body.baseUrl || activeConfig.baseUrl || DEFAULT_CONFIGS[provider]?.baseUrl || '');
    updateEnvFile('LLM_MODEL', body.model || activeConfig.model || DEFAULT_CONFIGS[provider]?.model || '');
    updateEnvFile('LLM_TEMPERATURE', String(body.temperature));
    updateEnvFile('OLLAMA_ENABLED', String(body.ollamaEnabled));
    updateEnvFile('OLLAMA_BASE_URL', body.ollamaBaseUrl);
    updateEnvFile('OLLAMA_MODEL', body.ollamaModel);
    updateEnvFile('EMBEDDING_PROVIDER', body.embeddingProvider);
    updateEnvFile('EMBEDDING_API_KEY', body.embeddingApiKey);
    updateEnvFile('EMBEDDING_BASE_URL', body.embeddingBaseUrl);
    updateEnvFile('EMBEDDING_MODEL', body.embeddingModel);
    
    resetAdapter();
    
    const providersWithConfig: Record<string, boolean> = {};
    Object.keys(DEFAULT_CONFIGS).forEach(key => {
      providersWithConfig[key] = !!providerConfigs[key]?.apiKey;
    });
    
    res.json({
      success: true,
      message: '配置已保存并立即生效',
      providersWithConfig,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '保存失败',
    });
  }
});

router.post('/ai-config/switch', (req: Request, res: Response) => {
  const { provider } = req.body as { provider: string };
  
  if (!DEFAULT_CONFIGS[provider]) {
    return res.status(400).json({ success: false, message: '不支持的提供商' });
  }
  
  const providerConfigs = getProviderConfigs();
  const providerConfig = providerConfigs[provider];
  
  if (!providerConfig?.apiKey) {
    return res.status(400).json({ 
      success: false, 
      message: `请先为 ${provider} 配置 API Key`,
      needApiKey: true 
    });
  }
  
  process.env.LLM_PROVIDER = provider;
  process.env.LLM_API_KEY = providerConfig.apiKey;
  process.env.LLM_BASE_URL = providerConfig.baseUrl || DEFAULT_CONFIGS[provider].baseUrl;
  process.env.LLM_MODEL = providerConfig.model || DEFAULT_CONFIGS[provider].model;
  
  updateEnvFile('LLM_PROVIDER', provider);
  updateEnvFile('LLM_API_KEY', providerConfig.apiKey);
  updateEnvFile('LLM_BASE_URL', providerConfig.baseUrl || DEFAULT_CONFIGS[provider].baseUrl);
  updateEnvFile('LLM_MODEL', providerConfig.model || DEFAULT_CONFIGS[provider].model);
  
  resetAdapter();
  
  const providersWithConfig: Record<string, boolean> = {};
  Object.keys(DEFAULT_CONFIGS).forEach(key => {
    providersWithConfig[key] = !!providerConfigs[key]?.apiKey;
  });
  
  res.json({
    success: true,
    message: `已切换到 ${provider}`,
    provider,
    baseUrl: providerConfig.baseUrl || DEFAULT_CONFIGS[provider].baseUrl,
    model: providerConfig.model || DEFAULT_CONFIGS[provider].model,
    providersWithConfig,
  });
});

router.post('/ai-config/test', async (req: Request, res: Response) => {
  const body = req.body as AIConfig;
  
  try {
    let testUrl: string;
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let bodyData: any;
    
    let apiKey = body.apiKey;
    if (apiKey === '***') {
      const providerConfigs = getProviderConfigs();
      apiKey = providerConfigs[body.provider]?.apiKey || '';
    }
    
    if (body.provider === 'ollama') {
      testUrl = `${body.ollamaBaseUrl}/api/chat`;
      bodyData = {
        model: body.ollamaModel,
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      };
    } else if (body.baseUrl.includes('anthropic')) {
      testUrl = `${body.baseUrl}/v1/messages`;
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      bodyData = {
        model: body.model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
      };
    } else if (body.baseUrl.includes('googleapis')) {
      testUrl = `${body.baseUrl}/v1/models/${body.model}:generateContent?key=${apiKey}`;
      bodyData = {
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
      };
    } else {
      testUrl = `${body.baseUrl}/chat/completions`;
      headers['Authorization'] = `Bearer ${apiKey}`;
      bodyData = {
        model: body.model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100,
      };
    }
    
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('请求超时')), 10000)
    );
    
    const response = await Promise.race([
      fetch(testUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyData),
      }),
      timeout,
    ]) as unknown as globalThis.Response;
    
    if (!response.ok) {
      const result = await response.json();
      throw new Error((result as any).error?.message || `HTTP ${response.status}`);
    }
    
    res.json({
      success: true,
      message: '连接成功',
      provider: body.provider,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '测试失败',
    });
  }
});

export default router;
