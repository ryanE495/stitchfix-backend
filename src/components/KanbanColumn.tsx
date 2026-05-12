import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { JobStatus, JobWithCustomer } from '../lib/types';
import { JOB_STATUS_LABELS } from '../lib/types';
import { JobCard } from './JobCard';

interface Props {
  status: JobStatus;
  jobs: JobWithCustomer[];
  onCardClick: (id: string) => void;
  draggable: boolean;
  /** Optional content rendered in the column header next to the count badge. */
  headerExtras?: ReactNode;
}

export const COLUMN_ID_PREFIX = 'col-';

export function KanbanColumn({
  status,
  jobs,
  onCardClick,
  draggable,
  headerExtras,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${COLUMN_ID_PREFIX}${status}`,
    data: { status },
    disabled: !draggable,
  });

  return (
    <section
      ref={draggable ? setNodeRef : undefined}
      className={`flex shrink-0 w-[280px] flex-col rounded-2xl p-2 snap-start md:w-auto md:snap-align-none transition-colors ${
        isOver ? 'bg-brand-50 ring-2 ring-brand-500/60' : 'bg-slate-100/70'
      }`}
    >
      <header className="flex items-center justify-between gap-1 px-2 py-2">
        <h3 className="text-sm font-semibold text-slate-700 truncate">
          {JOB_STATUS_LABELS[status]}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {headerExtras}
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
            {jobs.length}
          </span>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto pb-2 min-h-[40px]">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} onClick={onCardClick} draggable={draggable} />
        ))}
        {jobs.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-slate-400">No jobs</p>
        )}
      </div>
    </section>
  );
}
