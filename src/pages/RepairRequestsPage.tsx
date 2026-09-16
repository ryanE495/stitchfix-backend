import { useMemo, useState } from 'react';
import { TopNav } from '../components/TopNav';
import { RepairRequestEditor } from '../components/RepairRequestEditor';
import {
  useDeleteRepairRequest,
  useRepairRequests,
} from '../hooks/useRepairRequests';
import { formatShortDate } from '../lib/dates';
import { formatCurrency } from '../lib/format';
import {
  REPAIR_CATEGORY_LABELS,
  REPAIR_STATUS_LABELS,
  REPAIR_STATUS_ORDER,
  REPAIR_STATUS_TONES,
  type RepairRequest,
  type RepairStatus,
} from '../lib/types';

type StatusFilter = RepairStatus | 'all' | 'open';

/** Anything not yet finished — the default view, so closed work stays out. */
const OPEN_STATUSES: RepairStatus[] = [
  'new',
  'contacted',
  'quoted',
  'approved',
  'in_shop',
  'shipped_back',
];

function estimateRange(r: RepairRequest): string {
  if (r.repair_estimate_low == null && r.repair_estimate_high == null) return '—';
  if (r.repair_estimate_low != null && r.repair_estimate_high != null) {
    if (r.repair_estimate_low === r.repair_estimate_high)
      return formatCurrency(r.repair_estimate_low);
    return `${formatCurrency(r.repair_estimate_low)}–${formatCurrency(r.repair_estimate_high)}`;
  }
  return formatCurrency(r.repair_estimate_low ?? r.repair_estimate_high);
}

export function RepairRequestsPage() {
  const { data: requests = [], isLoading, error } = useRepairRequests();
  const del = useDeleteRepairRequest();

  const [editing, setEditing] = useState<RepairRequest | null>(null);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<StatusFilter>('open');
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (status === 'open' && !OPEN_STATUSES.includes(r.status)) return false;
      if (status !== 'all' && status !== 'open' && r.status !== status) return false;
      if (!q) return true;
      return (
        r.request_number.toLowerCase().includes(q) ||
        r.contact_name.toLowerCase().includes(q) ||
        r.contact_email.toLowerCase().includes(q) ||
        r.contact_phone.toLowerCase().includes(q) ||
        (r.damage_notes ?? '').toLowerCase().includes(q)
      );
    });
  }, [requests, status, search]);

  const counts = useMemo(() => {
    const map = new Map<RepairStatus, number>();
    requests.forEach((r) => map.set(r.status, (map.get(r.status) ?? 0) + 1));
    return map;
  }, [requests]);

  const onDelete = async (request: RepairRequest, e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `Delete request ${request.request_number} from ${request.contact_name}? This also deletes its photos and can't be undone.`,
      )
    )
      return;
    try {
      await del.mutateAsync(request);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <TopNav
        title="Repairs"
        extras={
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            aria-label="Filter by status"
            className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="open">Open ({requests.filter((r) => OPEN_STATUSES.includes(r.status)).length})</option>
            <option value="all">All ({requests.length})</option>
            {REPAIR_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {REPAIR_STATUS_LABELS[s]} ({counts.get(s) ?? 0})
              </option>
            ))}
          </select>
        }
        action={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="min-h-[44px] rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 active:scale-[0.99]"
          >
            + New Request
          </button>
        }
      />

      <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        <div className="mb-4">
          <p className="text-sm text-slate-500">
            Mail-in repair requests from the intake form.
          </p>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, request #…"
            className="mt-3 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:max-w-sm"
          />
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Showing {visible.length} of {requests.length}
          </p>
        </div>

        {error ? (
          <p className="text-sm text-rust-700">
            Couldn't load repair requests: {(error as Error).message}
          </p>
        ) : isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : visible.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              {requests.length === 0
                ? 'No repair requests yet.'
                : 'Nothing matches this filter.'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {requests.length === 0
                ? 'Submissions from the mail-in intake form land here.'
                : 'Try a different status or clear the search.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {visible.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setEditing(r)}
                  className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-slate-50 sm:px-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-sm font-semibold text-slate-900">
                        {r.contact_name}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {r.request_number}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {r.category ? REPAIR_CATEGORY_LABELS[r.category] : 'no category'}
                      <span className="mx-1.5 text-slate-300">·</span>
                      {formatShortDate(r.created_at)}
                      <span className="mx-1.5 text-slate-300">·</span>
                      {estimateRange(r)}
                    </p>
                    {r.damage_notes && (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {r.damage_notes}
                      </p>
                    )}
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${REPAIR_STATUS_TONES[r.status]}`}
                  >
                    {REPAIR_STATUS_LABELS[r.status]}
                  </span>

                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Delete repair request"
                    onClick={(e) => onDelete(r, e)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onDelete(r, e as unknown as React.MouseEvent);
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

      {creating && (
        <RepairRequestEditor key="new" request={null} onClose={() => setCreating(false)} />
      )}
      {editing && (
        <RepairRequestEditor key={editing.id} request={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
