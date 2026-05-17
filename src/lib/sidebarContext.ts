import { createContext, useContext } from 'react';

export interface SidebarContextValue {
  /** Mobile drawer open/closed */
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Desktop collapsed-to-icons */
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used inside <Layout>');
  return ctx;
}
