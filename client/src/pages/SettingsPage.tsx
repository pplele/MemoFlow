import { useEffect, useState } from 'react';
import { Bot, CheckCircle2, XCircle, Send, Settings as SettingsIcon, MessageSquare } from 'lucide-react';

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

export default function SettingsPage() {
  const [status, setStatus] = useState<FeishuStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);
  const [testing, setTesting] = useState(false);
  const [simulateText, setSimulateText] = useState('');
  const [simulateResult, setSimulateResult] = useState<string>('');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/feishu/status');
      if (r.ok) {
        setStatus(await r.json());
      }
    } finally {
      setLoading(false);
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

  const handleSimulate = async () => {
    if (!simulateText.trim()) return;
    setSimulateResult('发送中...');
    try {
      const r = await fetch('/api/feishu/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: simulateText }),
      });
      const data = await r.json();
      if (r.ok) {
        setSimulateResult(`✓ 已创建记忆 ${data.memory.id}`);
        setSimulateText('');
      } else {
        setSimulateResult(`✗ 失败: ${data.error || '未知错误'}`);
      }
    } catch (err: any) {
      setSimulateResult(`✗ 异常: ${err.message}`);
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

        {/* 飞书集成 */}
        <div className="rounded-xl border border-border-primary bg-bg-secondary p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold">飞书机器人集成</h2>
          </div>

          {loading ? (
            <div className="text-text-tertiary text-sm">加载中...</div>
          ) : status ? (
            <>
              {/* 配置状态 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                <ConfigItem
                  label="Webhook URL"
                  configured={status.configured.webhook_url}
                />
                <ConfigItem
                  label="App ID"
                  configured={status.configured.app_id}
                />
                <ConfigItem
                  label="App Secret"
                  configured={status.configured.app_secret}
                />
                <ConfigItem
                  label="Verification Token"
                  configured={status.configured.verification_token}
                />
                <div className="rounded-md border border-border-primary bg-bg-tertiary px-3 py-2 text-xs">
                  <div className="text-text-tertiary mb-1">通知群 ID</div>
                  <div className="font-mono text-text-primary">
                    {status.configured.notify_chat_id || '(未配置)'}
                  </div>
                </div>
                <div className="rounded-md border border-border-primary bg-bg-tertiary px-3 py-2 text-xs">
                  <div className="text-text-tertiary mb-1">已入库记忆</div>
                  <div className="font-mono text-text-primary">{status.memory_count} 条</div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <button
                  onClick={handleTest}
                  disabled={testing || !status.configured.webhook_url}
                  className="flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs text-accent hover:bg-accent/20 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {testing ? '发送中...' : '发送测试消息'}
                </button>
                {testResult === 'success' && (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> 发送成功
                  </span>
                )}
                {testResult === 'failed' && (
                  <span className="flex items-center gap-1 text-xs text-red-400">
                    <XCircle className="h-3.5 w-3.5" /> 发送失败（检查 Webhook URL）
                  </span>
                )}
              </div>

              {/* 模拟器（开发用） */}
              <div className="border-t border-border-primary pt-4">
                <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-text-tertiary">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>本地模拟器（无需真实飞书账号）</span>
                </div>
                <p className="text-xs text-text-tertiary mb-3">
                  模拟一条飞书消息，验证消息→记忆的端到端流程
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={simulateText}
                    onChange={(e) => setSimulateText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSimulate()}
                    placeholder="输入要模拟的消息内容..."
                    className="flex-1 rounded-md border border-border-primary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent/50"
                  />
                  <button
                    onClick={handleSimulate}
                    disabled={!simulateText.trim()}
                    className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
                  >
                    模拟
                  </button>
                </div>
                {simulateResult && (
                  <p className="mt-2 text-xs font-mono text-text-secondary">{simulateResult}</p>
                )}
              </div>
            </>
          ) : (
            <div className="text-red-400 text-sm">加载状态失败</div>
          )}
        </div>

        {/* 配置说明 */}
        <div className="mt-6 rounded-xl border border-border-primary bg-bg-secondary p-6">
          <h3 className="text-sm font-semibold mb-3 text-text-primary">如何启用飞书推送？</h3>
          <ol className="space-y-2 text-xs text-text-secondary">
            <li>
              <span className="font-mono text-accent">1.</span> 在
              <a
                href="https://open.feishu.cn/app"
                target="_blank"
                rel="noreferrer"
                className="mx-1 underline hover:text-accent"
              >
                飞书开放平台
              </a>
              创建企业自建应用
            </li>
            <li>
              <span className="font-mono text-accent">2.</span> 在「权限管理」中开启
              <code className="mx-1 rounded bg-bg-tertiary px-1 py-0.5 font-mono">
                im:message
              </code>
              等消息权限
            </li>
            <li>
              <span className="font-mono text-accent">3.</span> 在「事件订阅」中配置请求 URL：
              <code className="mx-1 rounded bg-bg-tertiary px-1 py-0.5 font-mono text-[10px]">
                {`{your-domain}/api/feishu/webhook`}
              </code>
            </li>
            <li>
              <span className="font-mono text-accent">4.</span> 将 App ID / Secret / Token 写入项目根目录的
              <code className="mx-1 rounded bg-bg-tertiary px-1 py-0.5 font-mono">
                .env
              </code>
              文件后重启服务
            </li>
          </ol>
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
