import { NavLink } from 'react-router-dom';
import {
  Home,
  Search,
  MessageCircle,
  Database,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Brain,
  Bot,
  Settings,
  FolderOpen,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  currentPath: string;
}

const navItems = [
  { path: '/', label: '记忆', icon: Home },
  { path: '/files', label: '文件库', icon: FolderOpen },
  { path: '/agent', label: '智能助手', icon: Bot },
  { path: '/search', label: '搜索', icon: Search },
  { path: '/qa', label: '问答', icon: MessageCircle },
  { path: '/facts', label: '事实库', icon: Database },
  { path: '/dashboard', label: '仪表盘', icon: BarChart3 },
  { path: '/settings', label: '设置', icon: Settings },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={`flex h-full flex-col border-r border-border-primary bg-bg-secondary transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      <div className="flex h-16 items-center justify-between px-4 border-b border-border-primary">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="MemoFlow" className="h-8 w-8" />
          {!collapsed && (
            <span className="font-semibold text-text-primary">MemoFlow</span>
          )}
        </div>
        <button
          onClick={onToggle}
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
                }`
              }
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="border-t border-border-primary p-4">
          <div className="text-xs text-text-secondary">
            <p>本地优先 · 数字记忆中枢</p>
            <p className="mt-1 opacity-60">v1.0.0</p>
          </div>
        </div>
      )}
    </aside>
  );
}
