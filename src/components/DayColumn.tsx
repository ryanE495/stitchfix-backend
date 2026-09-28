import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { TaskCard } from './TaskCard';
import { formatMinutes, fromIsoDate, weekdayOf } from '../lib/dates';
import { WEEKDAY_LABELS, type TaskType, type TaskWithJob } from '../lib/types';

export const DAY_ID_PREFIX = 'day-';

interface Props {
  date: string;
  tasks: TaskWithJob[];
  isToday: boolean;
  /** Day is already over: no quick-add, no drops. Existing tasks stay usable. */
  isPast: boolean;
  blockedLabel: string | null;
  draggable: boolean;
  defaultType: TaskType;
  onToggle: (task: TaskWithJob) => void;
  onOpen: (task: TaskWithJob) => void;
  onQuickAdd: (date: string, title: string) => void;
}

export function DayColumn({
  date,
  tasks,
  isToday,
  isPast,
  blockedLabel,
  draggable,
  defaultType,
  onToggle,
  onOpen,
  onQuickAdd,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${DAY_ID_PREFIX}${date}`,
    data: { date },
    // A card dropped on a finished day would be overdue on arrival and roll
    // straight back to today with a badge.
    disabled: !draggable || isPast,
  });
  const [draft, setDraft] = useState('');

  const planned = tasks.reduce((sum, t) => sum + (t.estimated_minutes ?? 0), 0);
  const completed = tasks
    .filter((t) => t.completed_at)
    .reduce((sum, t) => sum + (t.estimated_minutes ?? 0), 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    onQuickAdd(date, title);
    setDraft('');
  };

  const d = fromIsoDate(date);
  const blocked = blockedLabel != null;

  return (
    <section
      ref={draggable ? setNodeRef : undefined}
      className={`flex w-[264px] shrink-0 snap-start flex-col rounded-2xl p-2 transition-colors md:w-auto md:snap-align-none ${
        isOver
          ? 'bg-brand-50 ring-2 ring-brand-500/60'
          : blocked
            ? 'bg-slate-200/60'
            : 'bg-slate-100/70'
      } ${isPast && !isOver ? 'opacity-70' : ''}`}
    >
      <header className="px-2 py-2">
        <div className="flex items-baseline justify-between gap-1">
          <h3
            className={`truncate text-sm font-semibold ${
              isToday ? 'text-brand-800' : blocked ? 'text-slate-500' : 'text-slate-700'
            }`}
          >
            {WEEKDAY_LABELS[weekdayOf(date)]}
            <span
              className={`ml-1.5 text-xs font-normal ${
                isToday ? 'text-brand-700' : 'text-slate-400'
              }`}
            >
              {d.getDate()}
            </span>
          </h3>
          {isToday && (
            <span className="shrink-0 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Today
            </span>
          )}
        </div>
        {blocked && (
          <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500" title={blockedLabel}>
            {blockedLabel}
          </p>
        )}
      </header>

      <div className="flex min-h-[60px] flex-1 flex-col gap-2 px-1">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            draggable={draggable}
            onToggle={onToggle}
            onOpen={onOpen}
          />
        ))}
        {tasks.length === 0 && (
          <p className="px-2 py-3 text-center text-[11px] text-slate-400">Nothing planned</p>
        )}
      </div>

      {/* Quick add -- not on days that are over (see isPast) */}
      {isPast ? (
        <p className="mt-2 px-2 text-center text-[11px] text-slate-400">Day's over</p>
      ) : (
      <form onSubmit={submit} className="mt-2 px-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="+ Add task"
          aria-label={`Add a ${defaultType} task on ${date}`}
          className="block w-full min-h-[38px] rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1.5 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none"
        />
      </form>
      )}

      {/* Footer: planned vs completed minutes */}
      <footer className="mt-2 flex items-center justify-between border-t border-slate-300/60 px-2 pt-2 text-[11px]">
        <span className="text-slate-500">
          {formatMinutes(planned)} planned
        </span>
        <span className={completed > 0 ? 'font-medium text-brand-700' : 'text-slate-400'}>
          {formatMinutes(completed)} done
        </span>
      </footer>
    </section>
  );
}
