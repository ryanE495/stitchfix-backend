import { useState } from 'react';
import { TopNav } from '../components/TopNav';
import { PortfolioItemEditor } from '../components/PortfolioItemEditor';
import {
  useDeletePortfolioItem,
  usePortfolioItems,
} from '../hooks/usePortfolioItems';
import {
  JOB_CATEGORY_LABELS,
  PORTFOLIO_STATUS_LABELS,
  type PortfolioItem,
} from '../lib/types';

export function PortfolioListPage() {
  const { data: items = [], isLoading, error } = usePortfolioItems();
  const del = useDeletePortfolioItem();
  const [editing, setEditing] = useState<PortfolioItem | null>(null);
  const [creating, setCreating] = useState(false);

  const onDelete = async (item: PortfolioItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${item.title}"? This can't be undone.`)) return;
    try {
      await del.mutateAsync(item);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <TopNav
        title="Portfolio"
        action={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="min-h-[44px] rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 active:scale-[0.99]"
          >
            + New Portfolio Item
          </button>
        }
      />

      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        <div className="mb-4">
          <p className="text-sm text-slate-500">Manage your portfolio items.</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Portfolio Items ({items.length})
          </p>
        </div>

        {error ? (
          <p className="text-sm text-rust-700">
            Couldn't load portfolio: {(error as Error).message}
          </p>
        ) : isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-medium text-slate-700">No portfolio items yet.</p>
            <p className="mt-1 text-xs text-slate-500">
              Click "+ New Portfolio Item" to add your first.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setEditing(item)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-slate-50 sm:px-4"
                >
                  {/* Thumbnail */}
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {item.before_image_url || item.after_image_url ? (
                      <img
                        src={(item.after_image_url || item.before_image_url) as string}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="9" cy="9" r="2" />
                          <path d="m21 15-5-5L5 21" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Title + meta */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {item.category ? JOB_CATEGORY_LABELS[item.category] : 'no category'}
                      <span className="mx-1.5 text-slate-300">·</span>
                      Order {item.display_order}
                    </p>
                  </div>

                  {/* Status badge */}
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      item.status === 'published'
                        ? 'bg-brand-100 text-brand-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {PORTFOLIO_STATUS_LABELS[item.status]}
                  </span>

                  {/* Delete */}
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Delete portfolio item"
                    onClick={(e) => onDelete(item, e)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onDelete(item, e as unknown as React.MouseEvent);
                      }
                    }}
                    className="ml-1 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-rust-50 hover:text-rust-700"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                    </svg>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {creating && <PortfolioItemEditor item={null} onClose={() => setCreating(false)} />}
      {editing && (
        <PortfolioItemEditor item={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
