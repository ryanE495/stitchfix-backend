import { useDraggable } from '@dnd-kit/core';
import { formatMinutes } from '../lib/dates';
import {
  STUCK_ROLLOVER_THRESHOLD,
  TASK_TYPE_LABELS,
  TASK_TYPE_TONES,
  type TaskWithJob,
} from '../lib/types';

interface Props {
  task: TaskWithJob;
  draggable: boolean;
  onToggle: (task: TaskWithJob) => void;
  onOpen: (task: TaskWithJob) => void;
}

/** Presentational card, also used inside the DragOverlay. */
export function TaskCardView({
  task,
  onToggle,
  onOpen,
  dragging,
}: Omit<Props, 'draggable'> & { dragging?: boolean }) {
  const done = Boolean(task.completed_at);
  const tone = TASK_TYPE_TONES[task.type];
  const stuck = task.rollover_count >= STUCK_ROLLOVER_THRESHOLD;
  const jobName = task.job?.customer?.name ?? null;

  return (
    <div
      className={`relative flex gap-2 overflow-hidden rounded-xl border bg-white p-2.5 shadow-sm ${
        dragging ? 'ring-2 ring-brand-500/60' : ''
      } ${done ? 'border-slate-200 opacity-60' : 'border-slate-200'}`}
    >
      {/* Type accent */}
      <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden="true" />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(task);
        }}
        aria-label={done ? `Mark "${task.title}" not done` : `Complete "${task.title}"`}
        className={`ml-1 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
          done
            ? 'border-brand-600 bg-brand-600 text-white'
            : 'border-slate-300 bg-white hover:border-brand-500'
        }`}
      >
        {done && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      <button
        type="button"
        onClick={() => onOpen(task)}
        className="min-w-0 flex-1 text-left"
      >
        <p
          className={`text-sm font-medium leading-snug ${
            done ? 'text-slate-400 line-through' : 'text-slate-900'
          }`}
        >
          {task.title}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tone.chip}`}>
            {TASK_TYPE_LABELS[task.type]}
          </span>

          {task.estimated_minutes != null && task.estimated_minutes > 0 && (
            <span className="text-[11px] text-slate-500">
              {formatMinutes(task.estimated_minutes)}
            </span>
          )}

          {stuck && (
            <span
              className="rounded bg-rust-100 px-1.5 py-0.5 text-[10px] font-semibold text-rust-800"
              title={`Rolled over ${task.rollover_count} times`}
            >
              ↻ {task.rollover_count}
            </span>
          )}
          {!stuck && task.rollover_count > 0 && (
            <span
              className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
              title={`Rolled over ${task.rollover_count} time${task.rollover_count === 1 ? '' : 's'}`}
            >
              ↻ {task.rollover_count}
            </span>
          )}

          {task.source !== 'manual' && (
            <span
              className="text-[10px] uppercase tracking-wide text-slate-400"
              title={task.source === 'auto' ? 'Created by a rule' : 'Recurring task'}
            >
              {task.source === 'auto' ? 'auto' : 'repeat'}
            </span>
          )}
        </div>

        {jobName && (
          <p className="mt-1 truncate text-[11px] text-slate-500" title={jobName}>
            <span className="text-slate-400">job ·</span> {jobName}
          </p>
        )}
      </button>
    </div>
  );
}

export function TaskCard({ task, draggable, onToggle, onOpen }: Props) {
  const drag = useDraggable({ id: task.id, disabled: !draggable, data: { task } });

  return (
    <div
      ref={draggable ? drag.setNodeRef : undefined}
      style={drag.isDragging ? { opacity: 0.4 } : undefined}
      {...(draggable ? drag.attributes : {})}
      {...(draggable ? drag.listeners : {})}
    >
      <TaskCardView task={task} onToggle={onToggle} onOpen={onOpen} />
    </div>
  );
}
