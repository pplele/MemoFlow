import { useEffect, useState } from 'react';
import { Bot, CheckCircle2, XCircle, Send, Settings as SettingsIcon, MessageSquare, Cloud, Server, ChevronRight } from 'lucide-react';

interface FeishuStatus {
  enabled: boolean;
  configured: {
    webhook_url: boolean;
    app_id: boolean;
    app_secret: boolean;
    verification_token: boolean;
    notify_chat_id: string | null;
  };
  memory_count: number;
}

interface FeishuConfig {
  webhookUrl: string;
  appId: string;
  appSecret: string;
  verificationToken: string;
  notifyChatId: string;
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
  providersWithConfig: Record<string, boolean>;
}

const PROVIDERS = [
  { value: 'deepseek', label: 'DeepSeek', description: '深度求索 DeepSeek API', examples: ['https://api.deepseek.com'] },
  { value: 'qwen', label: '千问 Qwen', description: '阿里云通义千问 API', examples: ['https://dashscope.aliyuncs.com/compatible-mode/v1'] },
  { value: 'mimo', label: 'Mimo', description: '小米 MiMo AI API', examples: ['https://api.xiaomimimo.com/v1'] },
  { value: 'doubao', label: '豆包', description: '火山引擎豆包 API', examples: ['https://ark.cn-beijing.volces.com/api/v3'] },
  { value: 'ollama', label: 'Ollama (本地)', description: '本地 Ollama 部署', examples: ['http://localhost:11434'] },
];

const EMBEDDING_PRESETS: Record<string, { model: string; baseUrl: string; description?: string }[]> = {
  deepseek: [
    { model: 'deepseek-embedding', baseUrl: 'https://api.deepseek.com', description: 'DeepSeek 嵌入模型' },
  ],
  qwen: [
    { model: 'text-embedding-v3', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', description: '通义千问嵌入' },
  ],
  doubao: [
    { model: 'doubao-embedding-large-text-240915', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', description: '豆包嵌入模型' },
  ],
  ollama: [
    { model: 'all-minilm', baseUrl: 'http://localhost:11434', description: '轻量嵌入模型' },
    { model: 'nomic-embed-text', baseUrl: 'http://localhost:11434', description: '高质量嵌入模型' },
    { model: 'bge-small-en', baseUrl: 'http://localhost:11434', description: 'BGE 英文嵌入' },
    { model: 'bge-small-zh', baseUrl: 'http://localhost:11434', description: 'BGE 中文嵌入' },
  ],
};

const MODEL_PRESETS: Record<string, { model: string; baseUrl: string; description?: string }[]> = {
  deepseek: [
    { model: 'deepseek-v4-flash', baseUrl: 'https://api.deepseek.com', description: '高速低成本，推荐' },
    { model: 'deepseek-v4-pro', baseUrl: 'https://api.deepseek.com', description: '旗舰推理模型' },
    { model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com', description: '旧版（2026年7月停用）' },
    { model: 'deepseek-reasoner', baseUrl: 'https://api.deepseek.com', description: '旧版推理（2026年7月停用）' },
  ],
  qwen: [
    { model: 'qwen3-8b-chat', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', description: '8B 参数' },
    { model: 'qwen3-72b-chat', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', description: '72B 参数' },
    { model: 'qwen-turbo', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', description: '高速版' },
    { model: 'qwen3.7-plus', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', description: '3.7B 参数' },
    { model: 'qwen3.7-max', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', description: '3.7B 增强版' },
    { model: 'qwen3.6-flash', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', description: '3.6B 高速版' },
  ],
  mimo: [
    { model: 'mimo-v2.5-pro', baseUrl: 'https://api.xiaomimimo.com/v1', description: '旗舰模型，1T 参数' },
    { model: 'mimo-v2.5', baseUrl: 'https://api.xiaomimimo.com/v1', description: '标准版' },
    { model: 'mimo-v2-omni', baseUrl: 'https://api.xiaomimimo.com/v1', description: '多模态版' },
    { model: 'mimo-v2-pro', baseUrl: 'https://api.xiaomimimo.com/v1', description: '旧版旗舰' },
    { model: 'mimo-v2-flash', baseUrl: 'https://api.xiaomimimo.com/v1', description: '高速版' },
  ],
  doubao: [
    { model: 'doubao-seed-1-6-251015', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', description: 'Seed 1.6 (推荐)' },
    { model: 'doubao-seed-1-6-flash', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', description: 'Seed 1.6 Flash' },
    { model: 'doubao-seed-2-1-pro-260628', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', description: 'Seed 2.1 Pro' },
    { model: 'doubao-seed-2-1-turbo-260628', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', description: 'Seed 2.1 Turbo' },
    { model: 'doubao-seed-evolving', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', description: '持续进化版' },
    { model: 'doubao-1-5-pro-32k', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', description: '1.5 Pro 32K' },
    { model: 'doubao-1-5-pro-256k', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', description: '1.5 Pro 256K' },
    { model: 'doubao-1-5-lite-32k', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', description: '1.5 Lite 32K' },
    { model: 'doubao-pro-32k-241215', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', description: 'Pro 32K' },
    { model: 'doubao-pro-128k-240628', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', description: 'Pro 128K' },
    { model: 'doubao-pro-256k-241115', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', description: 'Pro 256K' },
    { model: 'doubao-lite-32k-241015', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', description: 'Lite 32K' },
  ],
  ollama: [
    { model: 'qwen2.5:14b', baseUrl: 'http://localhost:11434', description: '千问 2.5 14B' },
    { model: 'qwen2.5:7b', baseUrl: 'http://localhost:11434', description: '千问 2.5 7B' },
    { model: 'deepseek-chat:latest', baseUrl: 'http://localhost:11434', description: '深度求索' },
    { model: 'llama3.3:70b', baseUrl: 'http://localhost:11434', description: 'Llama 3.3 70B' },
    { model: 'llama3.3:8b', baseUrl: 'http://localhost:11434', description: 'Llama 3.3 8B' },
    { model: 'gemma2:9b', baseUrl: 'http://localhost:11434', description: 'Google Gemma 2' },
    { model: 'mistral:7b', baseUrl: 'http://localhost:11434', description: 'Mistral 7B' },
  ],
};

const DEFAULT_CONFIGS: Record<string, { baseUrl: string; model: string }> = {
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3-8b-chat' },
  mimo: { baseUrl: 'https://api.xiaomimimo.com/v1', model: 'mimo-v2.5-pro' },
  doubao: { baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-seed-1-6-251015' },
  ollama: { baseUrl: 'http://localhost:11434', model: 'qwen2.5:14b' },
};

export default function SettingsPage() {
  const [status, setStatus] = useState<FeishuStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);
  const [testing, setTesting] = useState(false);
  const [feishuConfig, setFeishuConfig] = useState<FeishuConfig>({
    webhookUrl: '',
    appId: '',
    appSecret: '',
    verificationToken: '',
    notifyChatId: '',
  });
  const [feishuSaving, setFeishuSaving] = useState(false);
  const [feishuSaveMessage, setFeishuSaveMessage] = useState('');
  const [feishuTesting, setFeishuTesting] = useState(false);
  const [feishuTestResult, setFeishuTestResult] = useState<'success' | 'failed' | null>(null);
  const [feishuTestMessage, setFeishuTestMessage] = useState('');

  const [aiConfig, setAiConfig] = useState<AIConfig>({
    provider: 'doubao',
    apiKey: '',
    baseUrl: '',
    model: '',
    temperature: 0.3,
    ollamaEnabled: false,
    ollamaBaseUrl: 'http://localhost:11434',
    ollamaModel: 'qwen2.5:14b',
    embeddingProvider: '',
    embeddingApiKey: '',
    embeddingBaseUrl: '',
    embeddingModel: '',
    providersWithConfig: {},
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<'success' | 'failed' | null>(null);
  const [aiTestMessage, setAiTestMessage] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'ai-cloud' | 'ai-local'>('ai-cloud');

  useEffect(() => {
    fetchStatus();
    fetchAIConfig();
  }, []);

  useEffect(() => {
    const presets = MODEL_PRESETS[aiConfig.provider];
    if (presets && presets.length > 0) {
      setAiConfig(prev => ({
        ...prev,
        model: presets[0].model,
        baseUrl: presets[0].baseUrl,
        apiKey: prev.providersWithConfig[prev.provider] ? '***' : '',
      }));
    }
  }, [aiConfig.provider]);

  useEffect(() => {
    if (aiConfig.embeddingProvider) {
      const presets = EMBEDDING_PRESETS[aiConfig.embeddingProvider];
      if (presets && presets.length > 0) {
        setAiConfig(prev => ({
          ...prev,
          embeddingModel: presets[0].model,
          embeddingBaseUrl: presets[0].baseUrl,
        }));
      }
    }
  }, [aiConfig.embeddingProvider]);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/feishu/status');
      if (r.ok) {
        const data = await r.json();
        setStatus(data);
        if (data.config) {
          setFeishuConfig({
            webhookUrl: data.config.webhookUrl || '',
            appId: data.config.appId || '',
            appSecret: data.config.appSecret || '',
            verificationToken: data.config.verificationToken || '',
            notifyChatId: data.config.notifyChatId || '',
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAIConfig = async () => {
    try {
      const r = await fetch('/api/ai-config');
      if (r.ok) {
        const config = await r.json();
        const providersWithConfig = config.providersWithConfig || {};
        setAiConfig({
          provider: config.provider,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
          temperature: config.temperature,
          ollamaEnabled: config.ollamaEnabled,
          ollamaBaseUrl: config.ollamaBaseUrl,
          ollamaModel: config.ollamaModel,
          embeddingProvider: config.embeddingProvider || '',
          embeddingApiKey: config.embeddingApiKey || '',
          embeddingBaseUrl: config.embeddingBaseUrl || '',
          embeddingModel: config.embeddingModel || '',
          providersWithConfig,
        });
        setActiveTab(config.provider === 'ollama' || config.ollamaEnabled ? 'ai-local' : 'ai-cloud');
      }
    } catch (err) {
      console.error('Failed to fetch AI config:', err);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch('/api/feishu/test', { method: 'POST' });
      setTestResult(r.ok ? 'success' : 'failed');
    } catch {
      setTestResult('failed');
    } finally {
      setTesting(false);
    }
  };

  const handleFeishuSave = async () => {
    setFeishuSaving(true);
    setFeishuSaveMessage('');
    try {
      const r = await fetch('/api/feishu/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feishuConfig),
      });
      const data = await r.json();
      if (r.ok) {
        setFeishuSaveMessage(data.message);
        if (feishuConfig.appSecret) {
          setFeishuConfig(prev => ({ ...prev, appSecret: '***' }));
        }
        fetchStatus();
      } else {
        setFeishuSaveMessage(`保存失败: ${data.message}`);
      }
    } catch (err: any) {
      setFeishuSaveMessage(`保存异常: ${err.message}`);
    } finally {
      setFeishuSaving(false);
    }
  };

  const handleFeishuTest = async () => {
    setFeishuTesting(true);
    setFeishuTestResult(null);
    setFeishuTestMessage('');
    try {
      const r = await fetch('/api/feishu/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: feishuConfig.appId,
          appSecret: feishuConfig.appSecret === '***' ? '' : feishuConfig.appSecret,
        }),
      });
      const data = await r.json();
      if (r.ok || data.success) {
        setFeishuTestResult('success');
        setFeishuTestMessage(data.message);
      } else {
        setFeishuTestResult('failed');
        setFeishuTestMessage(data.message || '连接失败');
      }
    } catch (err: any) {
      setFeishuTestResult('failed');
      setFeishuTestMessage(err.message || '网络异常');
    } finally {
      setFeishuTesting(false);
    }
  };

  const handleAiTest = async () => {
    setAiLoading(true);
    setAiTestResult(null);
    setAiTestMessage('');
    try {
      const configToTest = activeTab === 'ai-local' 
        ? { ...aiConfig, provider: 'ollama' }
        : { ...aiConfig, provider: aiConfig.provider };
      
      const r = await fetch('/api/ai-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configToTest),
      });
      const data = await r.json();
      if (r.ok) {
        setAiTestResult('success');
        setAiTestMessage(data.message);
      } else {
        setAiTestResult('failed');
        setAiTestMessage(data.message || '连接失败');
      }
    } catch (err: any) {
      setAiTestResult('failed');
      setAiTestMessage(err.message || '网络异常');
    } finally {
      setAiLoading(false);
    }
  };

  const handleProviderSwitch = async (provider: string) => {
    try {
      const r = await fetch('/api/ai-config/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      const data = await r.json();
      if (r.ok) {
        setAiConfig(prev => ({
          ...prev,
          provider: data.provider,
          baseUrl: data.baseUrl,
          model: data.model,
          apiKey: '***',
          providersWithConfig: data.providersWithConfig,
        }));
        setSaveMessage(data.message);
      } else {
        if (data.needApiKey) {
          setAiConfig(prev => ({ ...prev, provider }));
          setSaveMessage(data.message);
        } else {
          setSaveMessage(`切换失败: ${data.message}`);
        }
      }
    } catch (err: any) {
      setSaveMessage(`切换异常: ${err.message}`);
    }
  };

  const handleAiSave = async () => {
    setSaveMessage('');
    try {
      const configToSave = {
        ...aiConfig,
        provider: activeTab === 'ai-local' ? 'ollama' : aiConfig.provider,
        ollamaEnabled: activeTab === 'ai-local',
        updateApiKey: aiConfig.apiKey !== '***' && aiConfig.apiKey !== '',
        updateEmbeddingApiKey: aiConfig.embeddingApiKey !== '***' && aiConfig.embeddingApiKey !== '',
      };
      const r = await fetch('/api/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configToSave),
      });
      const data = await r.json();
      if (r.ok) {
        setSaveMessage(data.message);
        if (data.providersWithConfig) {
          setAiConfig(prev => ({ ...prev, providersWithConfig: data.providersWithConfig }));
        }
        if (configToSave.updateApiKey) {
          setAiConfig(prev => ({ ...prev, apiKey: '***' }));
        }
        if (configToSave.updateEmbeddingApiKey) {
          setAiConfig(prev => ({ ...prev, embeddingApiKey: '***' }));
        }
      } else {
        setSaveMessage(`保存失败: ${data.message}`);
      }
    } catch (err: any) {
      setSaveMessage(`保存异常: ${err.message}`);
    }
  };

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <SettingsIcon className="h-7 w-7 text-accent" />
          设置
        </h1>
        <p className="text-text-secondary mb-8 text-sm">管理外部集成与系统配置</p>

        <div className="rounded-xl border border-border-primary bg-bg-secondary p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold">大语言模型配置</h2>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('ai-cloud')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'ai-cloud'
                  ? 'bg-accent text-white'
                  : 'bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80'
              }`}
            >
              <Cloud className="h-4 w-4" />
              云端 API
            </button>
            <button
              onClick={() => setActiveTab('ai-local')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'ai-local'
                  ? 'bg-accent text-white'
                  : 'bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80'
              }`}
            >
              <Server className="h-4 w-4" />
              本地模型 (Ollama)
            </button>
          </div>

          {activeTab === 'ai-cloud' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-tertiary mb-1">API 提供商</label>
                <select
                  value={aiConfig.provider}
                  onChange={(e) => setAiConfig(prev => ({ ...prev, provider: e.target.value }))}
                  className="w-full rounded-md border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50"
                >
                  {PROVIDERS.filter(p => p.value !== 'ollama').map(p => (
                    <option key={p.value} value={p.value}>{p.label} - {p.description}</option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {PROVIDERS.filter(p => p.value !== 'ollama').map(p => {
                    const hasConfig = aiConfig.providersWithConfig[p.value];
                    const isActive = aiConfig.provider === p.value;
                    return (
                      <button
                        key={p.value}
                        onClick={() => handleProviderSwitch(p.value)}
                        disabled={!hasConfig && !isActive}
                        className={`px-3 py-1 text-xs rounded-full transition-colors ${
                          isActive
                            ? 'bg-accent text-white'
                            : hasConfig
                            ? 'bg-accent/10 text-accent hover:bg-accent/20'
                            : 'bg-bg-tertiary text-text-tertiary cursor-not-allowed'
                        }`}
                      >
                        {p.label} {hasConfig ? '✓' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-tertiary mb-1">API Key</label>
                <input
                  type="password"
                  value={aiConfig.apiKey}
                  onChange={(e) => setAiConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="sk-xxxxxxxxxxxxxxxx"
                  className="w-full rounded-md border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent/50 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-tertiary mb-1">API Base URL</label>
                <input
                  type="text"
                  value={aiConfig.baseUrl}
                  onChange={(e) => setAiConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                  placeholder="https://api.example.com/v1"
                  className="w-full rounded-md border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent/50 font-mono"
                />
                <p className="mt-1 text-xs text-text-tertiary">
                  示例: {MODEL_PRESETS[aiConfig.provider]?.[0]?.baseUrl}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-tertiary mb-1">模型名称</label>
                <select
                  value={aiConfig.model}
                  onChange={(e) => {
                    const selectedModel = MODEL_PRESETS[aiConfig.provider]?.find(p => p.model === e.target.value);
                    const baseUrl = selectedModel?.baseUrl || DEFAULT_CONFIGS[aiConfig.provider]?.baseUrl || '';
                    setAiConfig(prev => ({
                      ...prev,
                      model: e.target.value,
                      baseUrl: baseUrl,
                    }));
                  }}
                  className="w-full rounded-md border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50 font-mono"
                >
                  <option value="">请选择模型</option>
                  {MODEL_PRESETS[aiConfig.provider]?.map((preset, idx) => (
                    <option key={idx} value={preset.model}>
                      {preset.model} {preset.description && `- ${preset.description}`}
                    </option>
                  ))}
                  <option value="custom">-- 自定义模型 --</option>
                </select>
                
                {aiConfig.model === 'custom' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      placeholder="输入自定义模型 ID，如 doubao-seed-xxx"
                      onChange={(e) => setAiConfig(prev => ({ ...prev, model: e.target.value }))}
                      className="w-full rounded-md border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent/50 font-mono"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-text-tertiary mb-1">温度 (Temperature)</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={aiConfig.temperature}
                  onChange={(e) => setAiConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                  className="w-full"
                />
                <p className="text-xs text-text-tertiary mt-1">当前值: {aiConfig.temperature}</p>
              </div>

              <div className="mt-6 pt-6 border-t border-border-primary">
                <h3 className="text-sm font-medium mb-3">嵌入模型配置（用于事实检索）</h3>
                <div className="text-xs text-text-tertiary mb-3">
                  部分提供商（如 Mimo、Anthropic、Gemini）不支持嵌入模型，请选择其他提供商。
                  留空则使用对话模型相同的提供商。
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-text-tertiary mb-1">嵌入提供商</label>
                  <select
                    value={aiConfig.embeddingProvider}
                    onChange={(e) => {
                      setAiConfig(prev => ({ ...prev, embeddingProvider: e.target.value }));
                    }}
                    className="w-full rounded-md border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50"
                  >
                    <option value="">与对话模型相同</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="qwen">千问 Qwen</option>
                    <option value="doubao">豆包</option>
                    <option value="ollama">Ollama (本地)</option>
                  </select>
                </div>

                {aiConfig.embeddingProvider && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-text-tertiary mb-1">模型名称</label>
                      <select
                        value={aiConfig.embeddingModel}
                        onChange={(e) => {
                          const selectedModel = EMBEDDING_PRESETS[aiConfig.embeddingProvider]?.find(p => p.model === e.target.value);
                          setAiConfig(prev => ({
                            ...prev,
                            embeddingModel: e.target.value,
                            embeddingBaseUrl: selectedModel?.baseUrl || prev.embeddingBaseUrl,
                          }));
                        }}
                        className="w-full rounded-md border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50 font-mono"
                      >
                        <option value="">请选择嵌入模型</option>
                        {EMBEDDING_PRESETS[aiConfig.embeddingProvider]?.map((preset, idx) => (
                          <option key={idx} value={preset.model}>
                            {preset.model} {preset.description && `- ${preset.description}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-text-tertiary mb-1">
                        {aiConfig.embeddingProvider === 'ollama' ? 'Ollama 地址' : 'API Base URL'}
                      </label>
                      <input
                        type="text"
                        value={aiConfig.embeddingBaseUrl}
                        onChange={(e) => setAiConfig(prev => ({ ...prev, embeddingBaseUrl: e.target.value }))}
                        placeholder={aiConfig.embeddingProvider === 'ollama' ? 'http://localhost:11434' : 'https://api.openai.com/v1'}
                        className="w-full rounded-md border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent/50 font-mono"
                      />
                    </div>

                    {aiConfig.embeddingProvider !== 'ollama' && (
                      <div>
                        <label className="block text-xs font-medium text-text-tertiary mb-1">API Key</label>
                        <input
                          type="password"
                          value={aiConfig.embeddingApiKey}
                          onChange={(e) => setAiConfig(prev => ({ ...prev, embeddingApiKey: e.target.value }))}
                          placeholder="sk-..."
                          className="w-full rounded-md border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent/50 font-mono"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-700">
                <p>请确保已安装并启动 Ollama 服务。</p>
                <p className="mt-1">安装命令: <code className="bg-white px-1 py-0.5 rounded">curl -fsSL https://ollama.com/install.sh | sh</code></p>
                <p className="mt-1">启动模型: <code className="bg-white px-1 py-0.5 rounded">ollama pull qwen2.5:14b</code></p>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-tertiary mb-1">Ollama API 地址</label>
                <input
                  type="text"
                  value={aiConfig.ollamaBaseUrl}
                  onChange={(e) => setAiConfig(prev => ({ ...prev, ollamaBaseUrl: e.target.value }))}
                  placeholder="http://localhost:11434"
                  className="w-full rounded-md border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent/50 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-tertiary mb-1">模型名称</label>
                <select
                  value={aiConfig.ollamaModel}
                  onChange={(e) => {
                    const selectedModel = MODEL_PRESETS.ollama?.find(p => p.model === e.target.value);
                    setAiConfig(prev => ({
                      ...prev,
                      ollamaModel: e.target.value,
                      ollamaBaseUrl: selectedModel?.baseUrl || prev.ollamaBaseUrl,
                    }));
                  }}
                  className="w-full rounded-md border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50 font-mono"
                >
                  <option value="">请选择模型</option>
                  {MODEL_PRESETS.ollama?.map((preset, idx) => (
                    <option key={idx} value={preset.model}>
                      {preset.model} {preset.description && `- ${preset.description}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-tertiary mb-1">温度 (Temperature)</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={aiConfig.temperature}
                  onChange={(e) => setAiConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                  className="w-full"
                />
                <p className="text-xs text-text-tertiary mt-1">当前值: {aiConfig.temperature}</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-border-primary">
            <button
              onClick={handleAiTest}
              disabled={aiLoading}
              className="flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs text-accent hover:bg-accent/20 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {aiLoading ? '测试中...' : '测试连接'}
            </button>
            {aiTestResult === 'success' && (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> {aiTestMessage}
              </span>
            )}
            {aiTestResult === 'failed' && (
              <span className="flex items-center gap-1 text-xs text-red-400">
                <XCircle className="h-3.5 w-3.5" /> {aiTestMessage}
              </span>
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={handleAiSave}
              className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              保存配置
            </button>
            {saveMessage && (
              <p className="mt-2 text-xs text-text-secondary text-center">{saveMessage}</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border-primary bg-bg-secondary p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold">飞书机器人集成</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-tertiary mb-1">App ID</label>
                <input
                  type="text"
                  value={feishuConfig.appId}
                  onChange={(e) => setFeishuConfig(prev => ({ ...prev, appId: e.target.value }))}
                  placeholder="cli_xxx"
                  className="w-full rounded-md border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent/50 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-tertiary mb-1">App Secret</label>
                <input
                  type="password"
                  value={feishuConfig.appSecret}
                  onChange={(e) => setFeishuConfig(prev => ({ ...prev, appSecret: e.target.value }))}
                  placeholder="your-app-secret"
                  className="w-full rounded-md border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent/50 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-tertiary mb-1">Webhook URL（可选）</label>
                <input
                  type="text"
                  value={feishuConfig.webhookUrl}
                  onChange={(e) => setFeishuConfig(prev => ({ ...prev, webhookUrl: e.target.value }))}
                  placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
                  className="w-full rounded-md border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent/50 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-tertiary mb-1">Verification Token（可选）</label>
                <input
                  type="text"
                  value={feishuConfig.verificationToken}
                  onChange={(e) => setFeishuConfig(prev => ({ ...prev, verificationToken: e.target.value }))}
                  placeholder="用于 Webhook 验证"
                  className="w-full rounded-md border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent/50 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-tertiary mb-1">通知群 ID（可选）</label>
              <input
                type="text"
                value={feishuConfig.notifyChatId}
                onChange={(e) => setFeishuConfig(prev => ({ ...prev, notifyChatId: e.target.value }))}
                placeholder="oc_xxx"
                className="w-full rounded-md border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent/50 font-mono"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleFeishuTest}
                disabled={feishuTesting || !feishuConfig.appId || !feishuConfig.appSecret || feishuConfig.appSecret === '***'}
                className="flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs text-accent hover:bg-accent/20 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {feishuTesting ? '测试中...' : '测试连接'}
              </button>
              {feishuTestResult === 'success' && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {feishuTestMessage}
                </span>
              )}
              {feishuTestResult === 'failed' && (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <XCircle className="h-3.5 w-3.5" /> {feishuTestMessage}
                </span>
              )}
            </div>

            <button
              onClick={handleFeishuSave}
              disabled={feishuSaving}
              className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {feishuSaving ? '保存中...' : '保存配置'}
            </button>
            {feishuSaveMessage && (
              <p className="mt-2 text-xs text-text-secondary text-center">{feishuSaveMessage}</p>
            )}

            {loading ? (
              <div className="text-text-tertiary text-xs mt-2">加载状态...</div>
            ) : status ? (
              <div className="mt-4 pt-4 border-t border-border-primary">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    {status.configured.app_id ? (
                      <><CheckCircle2 className="h-3 w-3 text-green-400" /><span className="text-green-400">App ID 已配置</span></>
                    ) : (
                      <><XCircle className="h-3 w-3 text-text-tertiary" /><span className="text-text-tertiary">App ID 未配置</span></>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {status.configured.app_secret ? (
                      <><CheckCircle2 className="h-3 w-3 text-green-400" /><span className="text-green-400">App Secret 已配置</span></>
                    ) : (
                      <><XCircle className="h-3 w-3 text-text-tertiary" /><span className="text-text-tertiary">App Secret 未配置</span></>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-tertiary">已入库记忆: {status.memory_count} 条</span>
                  </div>
                </div>
              </div>
            ) : null}

            </div>
        </div>

        <div className="mt-6 rounded-xl border border-border-primary bg-bg-secondary p-6">
          <h3 className="text-sm font-semibold mb-3 text-text-primary">AI 配置说明</h3>
          <div className="space-y-3 text-xs text-text-secondary">
            <div className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
              <div>
                <strong>云端 API</strong>：支持 OpenAI 兼容接口（豆包、DeepSeek、智谱等），根据 Base URL 自动检测提供商
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
              <div>
                <strong>本地 Ollama</strong>：在本机运行大语言模型，无需联网，保护隐私
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
              <div>
                <strong>温度参数</strong>：值越高，输出越随机；值越低，输出越确定（建议 0.2-0.5）
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
              <div>
                <strong>嵌入模型</strong>：用于事实检索，部分提供商不支持时需单独配置
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ChevronRight className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
              <div>
                <strong>生效方式</strong>：保存配置后立即生效，无需重启服务
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigItem({ label, configured }: { label: string; configured: boolean }) {
  return (
    <div className="rounded-md border border-border-primary bg-bg-tertiary px-3 py-2 text-xs">
      <div className="text-text-tertiary mb-1">{label}</div>
      <div className="flex items-center gap-1.5">
        {configured ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
            <span className="text-green-400">已配置</span>
          </>
        ) : (
          <>
            <XCircle className="h-3.5 w-3.5 text-text-tertiary" />
            <span className="text-text-tertiary">未配置</span>
          </>
        )}
      </div>
    </div>
  );
}