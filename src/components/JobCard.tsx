import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { JobWithCustomer } from '../lib/types';
import { ageBadgeTone, daysSince, isFollowupOverdue } from '../lib/dates';
import { formatCurrency } from '../lib/format';

const toneClass: Record<ReturnType<typeof ageBadgeTone>, string> = {
  green: 'bg-brand-100 text-brand-800',
  yellow: 'bg-amber-100 text-amber-800',
  red: 'bg-rust-100 text-rust-800',
  gray: 'bg-slate-100 text-slate-600',
};

interface ViewProps {
  job: JobWithCustomer;
  onClick?: (id: string) => void;
  dragging?: boolean;
  asOverlay?: boolean;
}

/** Pure visual card — no DnD hooks. Used both as the in-column card and inside <DragOverlay>. */
export function JobCardView({ job, onClick, dragging, asOverlay }: ViewProps) {
  const ageDays = daysSince(job.date_received ?? job.created_at);
  const tone = ageBadgeTone(ageDays);
  const ageLabel =
    ageDays == null ? 'new' : ageDays === 0 ? 'today' : `${ageDays}d`;

  return (
    <button
      type="button"
      onClick={onClick ? () => onClick(job.id) : undefined}
      className={`w-full text-left rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition active:scale-[0.99] hover:border-slate-300 hover:shadow ${
        dragging ? 'opacity-0' : ''
      } ${asOverlay ? 'cursor-grabbing shadow-lg ring-1 ring-brand-500/30 rotate-[1.5deg]' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900 truncate">
          {job.customer?.name ?? 'Unknown customer'}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {job.needs_followup && (
            <span
              aria-label={
                isFollowupOverdue(job.followup_by) ? 'Follow-up overdue' : 'Needs follow-up'
              }
              title={
                isFollowupOverdue(job.followup_by)
                  ? `Follow-up overdue${job.followup_by ? ` (${job.followup_by})` : ''}`
                  : `Needs follow-up${job.followup_by ? ` by ${job.followup_by}` : ''}`
              }
              className={`inline-block h-2 w-2 rounded-full ${
                isFollowupOverdue(job.followup_by) ? 'bg-red-500' : 'bg-orange-500'
              }`}
            />
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${toneClass[tone]}`}
          >
            {ageLabel}
          </span>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-600 line-clamp-2 leading-snug">
        {job.item_description}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
        <span>
          {formatCurrency(job.quote_amount != null ? Number(job.quote_amount) : null)}
        </span>
        {job.status === 'paid_closed' && !job.review_requested && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
            <span aria-hidden="true">★</span>
            Ask for review
          </span>
        )}
      </div>
    </button>
  );
}

interface JobCardProps {
  job: JobWithCustomer;
  onClick: (id: string) => void;
  draggable: boolean;
}

export function JobCard({ job, onClick, draggable }: JobCardProps) {
  const drag = useDraggable({ id: job.id, disabled: !draggable, data: { job } });
  const { attributes, listeners, setNodeRef, transform, isDragging } = drag;

  if (!draggable) {
    return <JobCardView job={job} onClick={onClick} />;
  }

  return (
    <div
      ref={setNodeRef}
      // Hide the original while dragging — the DragOverlay paints a moving copy.
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
      className="touch-none"
    >
      <JobCardView job={job} onClick={onClick} dragging={isDragging} />
    </div>
  );
}
