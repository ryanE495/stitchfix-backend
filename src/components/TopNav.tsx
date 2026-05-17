import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

type View = 'kanban' | 'customers' | 'numbers';

interface TopNavProps {
  view: View;
  onNewJob?: () => void;
  onNewCustomer?: () => void;
  /** Optional content rendered between the view links and the action button. */
  extras?: ReactNode;
}

const NAV_LINKS: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Jobs', end: true },
  { to: '/customers', label: 'Customers' },
  { to: '/numbers', label: 'Numbers' },
];

export function TopNav({ view, onNewJob, onNewCustomer, extras }: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-5">
        <h1 className="mr-auto text-lg font-semibold tracking-tight text-slate-900">
          Stitchworks
        </h1>

        <nav className="flex flex-wrap items-center justify-end gap-1.5">
          {NAV_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `inline-flex min-h-[44px] items-center rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-100 text-brand-800'
                    : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}

          {extras}

          {view === 'kanban' && onNewJob && (
            <button
              type="button"
              onClick={onNewJob}
              className="min-h-[44px] rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 active:scale-[0.99]"
            >
              + New Job
            </button>
          )}

          {view === 'customers' && onNewCustomer && (
            <button
              type="button"
              onClick={onNewCustomer}
              className="min-h-[44px] rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 active:scale-[0.99]"
            >
              + New Customer
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
