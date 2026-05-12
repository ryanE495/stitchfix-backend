import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

interface TopNavProps {
  onNewJob?: () => void;
  onNewCustomer?: () => void;
  view: 'kanban' | 'customers';
  /** Optional content rendered between the view toggle and the action button. */
  extras?: ReactNode;
}

export function TopNav({ onNewJob, onNewCustomer, view, extras }: TopNavProps) {
  const otherLabel = view === 'kanban' ? 'Customers' : 'Jobs';
  const otherHref = view === 'kanban' ? '/customers' : '/';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-5">
        <h1 className="mr-auto text-lg font-semibold tracking-tight text-slate-900">
          Stitchworks
        </h1>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <NavLink
            to={otherHref}
            className="min-h-[40px] rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            {otherLabel}
          </NavLink>

          {extras}

          {view === 'kanban' && onNewJob && (
            <button
              type="button"
              onClick={onNewJob}
              className="min-h-[40px] rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 active:scale-[0.99]"
            >
              + New Job
            </button>
          )}

          {view === 'customers' && onNewCustomer && (
            <button
              type="button"
              onClick={onNewCustomer}
              className="min-h-[40px] rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800 active:scale-[0.99]"
            >
              + New Customer
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
