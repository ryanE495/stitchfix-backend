import { useState } from 'react';
import { Modal } from './Modal';
import {
  useBlockedDays,
  useDeleteBlockedDay,
  useDeleteRecurringTask,
  useRecurringTasks,
  useUpsertBlockedDay,
  useUpsertRecurringTask,
} from '../hooks/usePlanner';
import {
  TASK_TYPES,
  TASK_TYPE_LABELS,
  WEEKDAY_LONG,
  type TaskType,
} from '../lib/types';

/** Board display order: Monday first, Sunday last. Values stay 0=Sun. */
const DISPLAY_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

const LABEL = 'text-xs font-semibold uppercase tracking-wide text-slate-500';
const FIELD =
  'mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

export function PlannerSettings({ onClose }: { onClose: () => void }) {
  const { data: recurring = [] } = useRecurringTasks();
  const { data: blocked = [] } = useBlockedDays();
  const upsertRecurring = useUpsertRecurringTask();
  const deleteRecurring = useDeleteRecurringTask();
  const upsertBlocked = useUpsertBlockedDay();
  const deleteBlocked = useDeleteBlockedDay();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('business');
  const [weekday, setWeekday] = useState(1);
  const [minutes, setMinutes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const blockedByWeekday = new Map(
    blocked.filter((b) => b.weekday != null).map((b) => [b.weekday as number, b]),
  );

  const addRecurring = async () => {
    setError(null);
    if (!title.trim()) return setError('Give the recurring task a title.');
    try {
      await upsertRecurring.mutateAsync({
        title: title.trim(),
        type,
        weekday,
        estimated_minutes: minutes.trim() ? Number(minutes.replace(/[^0-9]/g, '')) : null,
        active: true,
      });
      setTitle('');
      setMinutes('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  };

  const toggleBlocked = async (wd: number) => {
    const existing = blockedByWeekday.get(wd);
    try {
      if (existing) {
        await deleteBlocked.mutateAsync(existing.id);
      } else {
        await upsertBlocked.mutateAsync({ weekday: wd, label: 'Day job' });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update.');
    }
  };

  const renameBlocked = async (id: string, label: string) => {
    try {
      await upsertBlocked.mutateAsync({ id, label });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not rename.');
    }
  };

  return (
    <Modal open onClose={onClose} title="Planner settings" size="lg">
      <div className="space-y-6">
        {/* ── Blocked days ─────────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-semibold text-slate-900">Blocked days</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Greyed on the board and skipped when auto tasks pick a day. They still
            accept tasks you place yourself.
          </p>

          <ul className="mt-3 space-y-2">
            {DISPLAY_WEEKDAYS.map((wd) => {
              const b = blockedByWeekday.get(wd);
              return (
                <li key={wd} className="flex items-center gap-2">
                  <label className="flex min-h-[44px] flex-1 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(b)}
                      onChange={() => toggleBlocked(wd)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-700">{WEEKDAY_LONG[wd]}</span>
                  </label>
                  {b && (
                    <input
                      type="text"
                      defaultValue={b.label}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== b.label) renameBlocked(b.id, v);
                      }}
                      aria-label={`Label for ${WEEKDAY_LONG[wd]}`}
                      className="min-h-[40px] w-40 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── Recurring tasks ──────────────────────────────────────── */}
        <section className="border-t border-slate-200 pt-5">
          <h3 className="text-sm font-semibold text-slate-900">Recurring tasks</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            One instance is generated per matching day of whatever week you open.
          </p>

          {recurring.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
              {recurring.map((r) => (
                <li key={r.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{r.title}</p>
                    <p className="text-[11px] text-slate-500">
                      {WEEKDAY_LONG[r.weekday]} · {TASK_TYPE_LABELS[r.type]}
                      {r.estimated_minutes ? ` · ${r.estimated_minutes}m` : ''}
                      {!r.active && ' · paused'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => upsertRecurring.mutate({ ...r, active: !r.active })}
                    className="min-h-[36px] rounded-lg border border-slate-300 px-2 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    {r.active ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete recurring task "${r.title}"?`))
                        deleteRecurring.mutate(r.id);
                    }}
                    aria-label={`Delete ${r.title}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-rust-50 hover:text-rust-700"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 rounded-lg border border-dashed border-slate-300 p-3">
            <label className="block">
              <span className={LABEL}>New recurring task</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Post a project photo"
                className={FIELD}
              />
            </label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <label className="block">
                <span className={LABEL}>Day</span>
                <select
                  value={weekday}
                  onChange={(e) => setWeekday(Number(e.target.value))}
                  className={FIELD}
                >
                  {DISPLAY_WEEKDAYS.map((wd) => (
                    <option key={wd} value={wd}>
                      {WEEKDAY_LONG[wd]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={LABEL}>Type</span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as TaskType)}
                  className={FIELD}
                >
                  {TASK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TASK_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={LABEL}>Minutes</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="20"
                  className={FIELD}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={addRecurring}
              disabled={upsertRecurring.isPending}
              className="mt-3 min-h-[44px] w-full rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
            >
              Add recurring task
            </button>
          </div>
        </section>

        {error && (
          <p className="rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</p>
        )}
      </div>
    </Modal>
  );
}
