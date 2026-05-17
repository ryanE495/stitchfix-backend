import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarContext } from '../lib/sidebarContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Sidebar } from './Sidebar';

export function Layout() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useLocalStorage<boolean>(
    'stitchworks.sidebar.collapsed',
    false,
  );

  return (
    <SidebarContext.Provider value={{ open, setOpen, collapsed, setCollapsed }}>
      <div className="flex h-full">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
