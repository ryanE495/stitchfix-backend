import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import {
  useDeleteTask,
  useRecurringTasks,
  useSetRecurrence,
  useUpdateTask,
} from '../hooks/usePlanner';
import { formatShortDate, toIsoDate, weekdayOf } from '../lib/dates';
import { errorMessage } from '../lib/errors';
import { seriesKey } from '../lib/plannerRules';
import {
  TASK_TYPES,
  TASK_TYPE_LABELS,
  WEEKDAY_LABELS,
  WEEKDAY_LONG,
  type TaskType,
  type TaskWithJob,
} from '../lib/types';

/** Mon-first display order; values stay 0 = Sunday. */
const DISPLAY_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

interface Props {
  task: TaskWithJob;
  onClose: () => void;
}

const LABEL = 'text-xs font-semibold uppercase tracking-wide text-slate-500';
const FIELD =
  'mt-1 block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

export function TaskEditor({ task, onClose }: Props) {
  const update = useUpdateTask();
  const del = useDeleteTask();
  const setRecurrence = useSetRecurrence();
  const { data: templates = [] } = useRecurringTasks();

  const [title, setTitle] = useState(task.title);
  const [type, setType] = useState<TaskType>(task.type);
  const [date, setDate] = useState(task.scheduled_date);
  const [minutes, setMinutes] = useState(
    task.estimated_minutes == null ? '' : String(task.estimated_minutes),
  );
  const [notes, setNotes] = useState(task.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  // ── Repeat weekly ──────────────────────────────────────────────────────
  // Auto follow-ups are tied to one job's state, so repeating them is
  // meaningless; everything else can repeat.
  const canRepeat = task.source !== 'auto';
  const wasRepeating = task.recurring_task_id != null;

  // The series is known by its template's title (or this task's, if it isn't
  // repeating yet), read before any edits in this form.
  const seriesTitle =
    templates.find((t) => t.id === task.recurring_task_id)?.title ?? task.title;
  const savedDays = useMemo(
    () =>
      wasRepeating
        ? templates
            .filter((t) => t.active && seriesKey(t.title) === seriesKey(seriesTitle))
            .map((t) => t.weekday)
        : [],
    [templates, wasRepeating, seriesTitle],
  );

  // null = untouched; show what's saved (templates load after first render).
  const [repeatEdit, setRepeatEdit] = useState<{ on: boolean; days: number[] } | null>(null);
  const repeat = repeatEdit ?? { on: wasRepeating, days: savedDays };
  const setRepeat = (next: { on: boolean; days: number[] }) => setRepeatEdit(next);
  const toggleDay = (wd: number) =>
    setRepeat({
      on: true,
      days: repeat.days.includes(wd) ? repeat.days.filter((d) => d !== wd) : [...repeat.days, wd],
    });
  const ownDay = weekdayOf(date);

  const save = async () => {
    setError(null);
    if (!title.trim()) return setError('Title is required.');

    const parsed = minutes.trim() === '' ? null : Number(minutes.replace(/[^0-9]/g, ''));
    if (parsed != null && (!Number.isFinite(parsed) || parsed < 0)) {
      return setError('Estimated minutes must be a positive number.');
    }

    if (canRepeat && repeat.on && repeat.days.length === 0) {
      return setError('Pick at least one day to repeat on, or turn repeat off.');
    }

    try {
      await update.mutateAsync({
        id: task.id,
        patch: {
          title: title.trim(),
          type,
          scheduled_date: date,
          estimated_minutes: parsed,
          notes: notes.trim() || null,
        },
      });

      if (canRepeat && (repeat.on || wasRepeating)) {
        await setRecurrence.mutateAsync({
          task: { id: task.id, scheduled_date: date, recurring_task_id: task.recurring_task_id },
          seriesTitle,
          selected: repeat.on ? repeat.days : [],
          fields: { title: title.trim(), type, estimated_minutes: parsed },
          today: toIsoDate(new Date()),
        });
      }
      onClose();
    } catch (e) {
      setError(errorMessage(e, 'Save failed.'));
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try {
      await del.mutateAsync(task.id);
      onClose();
    } catch (e) {
      setError(errorMessage(e, 'Delete failed.'));
    }
  };

  const busy = update.isPending || del.isPending || setRecurrence.isPending;

  return (
    <Modal open onClose={onClose} title="Task">
      <div className="space-y-4">
        <label className="block">
          <span className={LABEL}>Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={FIELD}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
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
              placeholder="30"
              className={FIELD}
            />
          </label>
        </div>

        <label className="block">
          <span className={LABEL}>Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={FIELD}
          />
        </label>

        {canRepeat && (
          <div className="rounded-lg border border-slate-200 p-3">
            <label className="flex min-h-[36px] cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={repeat.on}
                onChange={(e) =>
                  setRepeat({
                    on: e.target.checked,
                    // First switch-on starts from this task's own day.
                    days: e.target.checked && repeat.days.length === 0 ? [ownDay] : repeat.days,
                  })
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm font-medium text-slate-800">Repeat weekly</span>
            </label>

            {repeat.on && (
              <>
                <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Repeat on">
                  {DISPLAY_WEEKDAYS.map((wd) => {
                    const on = repeat.days.includes(wd);
                    return (
                      <button
                        key={wd}
                        type="button"
                        onClick={() => toggleDay(wd)}
                        aria-pressed={on}
                        aria-label={WEEKDAY_LONG[wd]}
                        className={`min-h-[36px] min-w-[44px] rounded-lg border px-2 text-xs font-semibold transition ${
                          on
                            ? 'border-brand-600 bg-brand-600 text-white'
                            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {WEEKDAY_LABELS[wd]}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] leading-snug text-slate-500">
                  A copy shows up on each ticked day, every week. Title, type and minutes
                  changes apply to future copies.
                  {!repeat.days.includes(ownDay) && repeat.days.length > 0 && (
                    <> This task is on {WEEKDAY_LONG[ownDay]}, which isn't ticked, so it stays a one-off.</>
                  )}
                </p>
              </>
            )}

            {!repeat.on && wasRepeating && (
              <p className="mt-1 text-[11px] leading-snug text-rust-700">
                Saving stops the repeat and removes future copies. This one stays.
              </p>
            )}
          </div>
        )}

        {/* Say why Repeat is missing rather than hiding it silently. */}
        {!canRepeat && (
          <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-[11px] leading-snug text-slate-500">
            <span className="font-medium text-slate-600">Can't repeat an automatic follow-up.</span>{' '}
            It comes back on its own while the job is still waiting at this stage, and stops
            once you move the job on the Kanban. Repeat weekly is available on tasks you add
            yourself.
          </p>
        )}

        <label className="block">
          <span className={LABEL}>Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        {task.job && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="font-medium">Linked job:</span>{' '}
            {task.job.customer?.name ?? 'Unknown'} — {task.job.item_description}
          </p>
        )}

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
          <span>Added {formatShortDate(task.created_at)}</span>
          {task.rollover_count > 0 && <span>Rolled over {task.rollover_count}×</span>}
          {task.source !== 'manual' && <span>Source: {task.source}</span>}
        </div>

        {error && (
          <p className="rounded-lg bg-rust-50 px-3 py-2 text-sm text-rust-700">{error}</p>
        )}

        <div className="flex gap-2 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="min-h-[44px] rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-rust-700 hover:bg-rust-50 disabled:opacity-60"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="min-h-[44px] flex-1 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
