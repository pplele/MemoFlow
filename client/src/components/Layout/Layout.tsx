import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import GlobalDropZone from '../GlobalDropZone';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen w-full bg-bg-primary text-text-primary">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} currentPath={location.pathname} />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <GlobalDropZone />
    </div>
  );
}
