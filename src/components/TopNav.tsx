import type { ReactNode } from 'react';
import { useSidebar } from '../lib/sidebarContext';

interface TopNavProps {
  /** Page title shown in the header. */
  title: string;
  /** Optional content between title and action (e.g. a filter dropdown). */
  extras?: ReactNode;
  /** Optional primary action button (or button group) on the right. */
  action?: ReactNode;
}

export function TopNav({ title, extras, action }: TopNavProps) {
  const { setOpen } = useSidebar();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-5">
        {/* Hamburger — mobile only */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 md:hidden"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <h1 className="mr-auto truncate text-lg font-semibold tracking-tight text-slate-900">
          {title}
        </h1>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {extras}
          {action}
        </div>
      </div>
    </header>
  );
}
