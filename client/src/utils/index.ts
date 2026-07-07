export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(date: string | Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function relativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return formatDate(d);
}

export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    '家庭': 'bg-cat-family',
    '工作': 'bg-cat-work',
    '生活': 'bg-cat-life',
    '学习': 'bg-cat-study',
    '视觉记忆': 'bg-cat-visual',
    '购物': 'bg-cat-shopping',
    '健康': 'bg-cat-health',
  };
  return colors[category] || 'bg-gray-500';
}

export function getCategoryTextColor(category: string): string {
  const colors: Record<string, string> = {
    '家庭': 'text-orange-400',
    '工作': 'text-blue-400',
    '生活': 'text-green-400',
    '学习': 'text-purple-400',
    '视觉记忆': 'text-pink-400',
    '购物': 'text-rose-400',
    '健康': 'text-cyan-400',
  };
  return colors[category] || 'text-gray-400';
}

export function getCategoryBorderColor(category: string): string {
  const colors: Record<string, string> = {
    '家庭': 'border-orange-500/30',
    '工作': 'border-blue-500/30',
    '生活': 'border-green-500/30',
    '学习': 'border-purple-500/30',
    '视觉记忆': 'border-pink-500/30',
    '购物': 'border-rose-500/30',
    '健康': 'border-cyan-500/30',
  };
  return colors[category] || 'border-gray-500/30';
}

export function getCategoryBgColor(category: string): string {
  const colors: Record<string, string> = {
    '家庭': 'bg-orange-500/10',
    '工作': 'bg-blue-500/10',
    '生活': 'bg-green-500/10',
    '学习': 'bg-purple-500/10',
    '视觉记忆': 'bg-pink-500/10',
    '购物': 'bg-rose-500/10',
    '健康': 'bg-cyan-500/10',
  };
  return colors[category] || 'bg-gray-500/10';
}
