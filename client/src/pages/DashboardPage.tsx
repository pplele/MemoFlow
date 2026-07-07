import { useEffect } from 'react';
import { useStatsStore } from '@/stores/statsStore';
import {
  Loader2,
  Brain,
  TrendingUp,
  Users,
  Link2,
  BookOpen,
  Tag as TagIcon,
  Calendar,
  Database,
  RefreshCw,
  Activity,
} from 'lucide-react';

const CATEGORY_COLORS: Record<string, string> = {
  家庭: '#fb923c',
  工作: '#60a5fa',
  生活: '#4ade80',
  学习: '#a78bfa',
  购物: '#fb7185',
  健康: '#22d3ee',
};

const SOURCE_COLORS: Record<string, string> = {
  text: '#5e6ad2',
  feishu: '#10b981',
  'feishu-simulated': '#10b981',
  obsidian: '#f59e0b',
  upload: '#ec4899',
  obsidian_test: '#f59e0b',
};

function colorFor(key: string, palette: string[]): string {
  if (CATEGORY_COLORS[key]) return CATEGORY_COLORS[key];
  if (SOURCE_COLORS[key]) return SOURCE_COLORS[key];
  return palette[Math.abs(hashCode(key)) % palette.length];
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

const FALLBACK_PALETTE = [
  '#5e6ad2', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#84cc16',
];

export default function DashboardPage() {
  const { stats, loading, error, fetchStats } = useStatsStore();

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }
  if (error) {
    return <p className="p-8 text-sm text-red-400">{error}</p>;
  }
  if (!stats) return null;

  const cards = [
    { label: '总记忆数', value: stats.total_memories, icon: Brain, color: 'text-accent' },
    { label: '本周新增', value: stats.week_new, icon: TrendingUp, color: 'text-green-400' },
    { label: '事实数量', value: stats.total_facts, icon: BookOpen, color: 'text-orange-400' },
    { label: '实体数量', value: stats.total_entities, icon: Users, color: 'text-blue-400' },
    { label: '关系数量', value: stats.total_relations, icon: Link2, color: 'text-purple-400' },
  ];

  return (
    <div className="p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">记忆仪表盘</h1>
          <button
            onClick={fetchStats}
            className="flex items-center gap-1.5 rounded-md border border-border-primary px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </button>
        </div>
        <p className="text-text-secondary mb-8 text-sm">你的知识网络成长记录</p>

        {/* 核心指标 */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 mb-8">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="rounded-xl border border-border-primary bg-bg-secondary p-4 hover:border-accent/30 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${card.color}`} />
                  <span className="text-xs text-text-tertiary">{card.label}</span>
                </div>
                <p className="text-2xl font-bold text-text-primary">{card.value}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* 分类分布：饼图 */}
          <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
            <h3 className="text-sm font-medium text-text-secondary mb-4 flex items-center gap-2">
              <Database className="h-3.5 w-3.5" />
              分类分布
            </h3>
            {Object.keys(stats.category_distribution).length === 0 ? (
              <p className="text-text-tertiary text-sm">暂无数据</p>
            ) : (
              <DonutChart data={stats.category_distribution} />
            )}
          </div>

          {/* 来源分布：横向条形图 */}
          <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
            <h3 className="text-sm font-medium text-text-secondary mb-4 flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" />
              来源分布
            </h3>
            {Object.keys(stats.source_distribution).length === 0 ? (
              <p className="text-text-tertiary text-sm">暂无数据</p>
            ) : (
              <HorizontalBarChart data={stats.source_distribution} total={stats.total_memories} />
            )}
          </div>

          {/* 7 天趋势 */}
          <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
            <h3 className="text-sm font-medium text-text-secondary mb-4 flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              最近 7 天
            </h3>
            <MiniBarChart data={stats.recent_7_days} />
            <div className="mt-3 pt-3 border-t border-border-primary text-center">
              <span className="text-2xl font-bold text-accent">{stats.week_new}</span>
              <span className="text-xs text-text-tertiary ml-2">条新增</span>
            </div>
          </div>
        </div>

        {/* 30 天趋势 */}
        {stats.daily_activity.length > 0 && (
          <div className="rounded-xl border border-border-primary bg-bg-secondary p-5 mb-6">
            <h3 className="text-sm font-medium text-text-secondary mb-4 flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5" />
              最近活跃度（{stats.daily_activity.length} 天）
            </h3>
            <DailyActivityChart data={stats.daily_activity} />
          </div>
        )}

        {/* 标签云 */}
        {stats.top_tags.length > 0 && (
          <div className="rounded-xl border border-border-primary bg-bg-secondary p-5">
            <h3 className="text-sm font-medium text-text-secondary mb-4 flex items-center gap-2">
              <TagIcon className="h-3.5 w-3.5" />
              高频标签 TOP 20
            </h3>
            <TagCloud tags={stats.top_tags} />
          </div>
        )}
      </div>
    </div>
  );
}

/** 环形图：使用 conic-gradient */
function DonutChart({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);

  let cumulative = 0;
  const segments = entries.map(([key, value]) => {
    const start = (cumulative / total) * 360;
    cumulative += value;
    const end = (cumulative / total) * 360;
    const color = colorFor(key, FALLBACK_PALETTE);
    return { key, value, start, end, color };
  });

  const gradientStops = segments
    .map((s) => `${s.color} ${s.start}deg ${s.end}deg`)
    .join(', ');

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative h-32 w-32 rounded-full"
        style={{
          background: `conic-gradient(${gradientStops})`,
        }}
      >
        <div className="absolute inset-3 rounded-full bg-bg-secondary flex items-center justify-center">
          <div className="text-center">
            <div className="text-xl font-bold text-text-primary">{total}</div>
            <div className="text-[10px] text-text-tertiary">总计</div>
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-1.5">
        {segments.slice(0, 5).map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
              style={{ background: s.color }}
            />
            <span className="text-text-secondary truncate flex-1">{s.key}</span>
            <span className="text-text-primary font-medium">{s.value}</span>
            <span className="text-text-tertiary text-[10px] w-10 text-right">
              {((s.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 横向条形图：来源分布 */
function HorizontalBarChart({
  data,
  total,
}: {
  data: Record<string, number>;
  total: number;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map((e) => e[1]), 1);

  return (
    <div className="space-y-2.5">
      {entries.map(([key, value]) => {
        const color = colorFor(key, FALLBACK_PALETTE);
        const widthPct = (value / max) * 100;
        return (
          <div key={key}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-text-secondary truncate">{key}</span>
              <span className="text-text-primary font-medium">
                {value} <span className="text-text-tertiary">({((value / total) * 100).toFixed(0)}%)</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-bg-tertiary overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${widthPct}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 小型柱状图：最近 7 天 */
function MiniBarChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="flex items-end gap-1.5 h-20">
      {data.map((d) => {
        const height = (d.count / max) * 100;
        const isToday = d.date === today;
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="text-[10px] text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity">
              {d.count}
            </div>
            <div
              className={`w-full rounded-t-sm transition-all ${
                isToday ? 'bg-accent' : 'bg-accent/50 group-hover:bg-accent'
              }`}
              style={{ height: `${Math.max(height, 4)}%` }}
            />
            <span className="text-[9px] text-text-tertiary">
              {d.date.slice(8)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** 30 天柱状图 */
function DailyActivityChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d) => {
        const height = (d.count / max) * 100;
        return (
          <div
            key={d.date}
            className="flex-1 flex flex-col items-center gap-1 group"
            title={`${d.date}: ${d.count} 条`}
          >
            <div
              className="w-full rounded-t-sm bg-accent/60 group-hover:bg-accent transition-colors"
              style={{ height: `${Math.max(height, 4)}%` }}
            />
            <span className="text-[9px] text-text-tertiary">{d.date.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** 标签云：字号按 count */
function TagCloud({ tags }: { tags: Array<{ tag: string; count: number }> }) {
  const max = Math.max(...tags.map((t) => t.count), 1);
  const min = Math.min(...tags.map((t) => t.count), 1);

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => {
        // 字号 12px ~ 24px
        const ratio = (t.count - min) / Math.max(max - min, 1);
        const size = 12 + Math.round(ratio * 12);
        const opacity = 0.5 + ratio * 0.5;
        return (
          <span
            key={t.tag}
            className="rounded-md bg-bg-tertiary px-2 py-1 text-text-primary hover:bg-accent/20 hover:text-accent transition-colors cursor-default"
            style={{ fontSize: `${size}px`, opacity }}
            title={`出现 ${t.count} 次`}
          >
            #{t.tag}
          </span>
        );
      })}
    </div>
  );
}
