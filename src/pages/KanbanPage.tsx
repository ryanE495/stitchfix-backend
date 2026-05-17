import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { TopNav } from '../components/TopNav';
import { useJobs } from '../hooks/useJobs';
import { useUpdateJob } from '../hooks/useJobMutations';
import {
  CONTACT_SOURCES,
  CONTACT_SOURCE_LABELS,
  JOB_STATUS_ORDER,
  type ContactSource,
  type JobStatus,
  type JobWithCustomer,
} from '../lib/types';
import { KanbanColumn, COLUMN_ID_PREFIX } from '../components/KanbanColumn';
import { JobCardView } from '../components/JobCard';
import { JobDetailModal } from '../components/JobDetailModal';
import { NewJobModal } from '../components/NewJobModal';
import { PipelineSummary } from '../components/PipelineSummary';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { useLocalStorage } from '../hooks/useLocalStorage';

type SourceFilter = ContactSource | 'all';
const FILTER_STORAGE_KEY = 'stitchworks.kanban.sourceFilter';
const PAID_UNREVIEWED_KEY = 'stitchworks.kanban.paidUnreviewedOnly';

function groupByStatus(jobs: JobWithCustomer[]): Record<JobStatus, JobWithCustomer[]> {
  const base: Record<JobStatus, JobWithCustomer[]> = {
    quoted: [],
    awaiting_dropoff: [],
    in_shop: [],
    in_progress: [],
    complete_awaiting_pickup: [],
    paid_closed: [],
  };
  for (const j of jobs) base[j.status].push(j);
  return base;
}

export function KanbanPage() {
  const { data: jobs = [], isLoading, error } = useJobs();
  const update = useUpdateJob();
  const isDesktop = useIsDesktop();

  const [newJobOpen, setNewJobOpen] = useState(false);
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useLocalStorage<SourceFilter>(
    FILTER_STORAGE_KEY,
    'all',
  );
  const [paidUnreviewedOnly, setPaidUnreviewedOnly] = useLocalStorage<boolean>(
    PAID_UNREVIEWED_KEY,
    false,
  );

  const visibleJobs = useMemo(() => {
    if (sourceFilter === 'all') return jobs;
    return jobs.filter((j) => j.customer?.contact_source === sourceFilter);
  }, [jobs, sourceFilter]);

  const grouped = useMemo(() => {
    const g = groupByStatus(visibleJobs);
    if (paidUnreviewedOnly) {
      g.paid_closed = g.paid_closed.filter((j) => !j.review_requested);
    }
    return g;
  }, [visibleJobs, paidUnreviewedOnly]);
  const activeJob = activeJobId ? jobs.find((j) => j.id === activeJobId) ?? null : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const onDragStart = (e: DragStartEvent) => {
    setActiveJobId(String(e.active.id));
  };

  const onDragEnd = (e: DragEndEvent) => {
    const activeId = activeJobId;
    setActiveJobId(null);

    const { active, over } = e;
    if (!over) return;
    const activeJ = jobs.find((j) => j.id === (activeId ?? active.id));
    if (!activeJ) return;

    const overId = String(over.id);
    let target: JobStatus | null = null;
    if (overId.startsWith(COLUMN_ID_PREFIX)) {
      target = overId.slice(COLUMN_ID_PREFIX.length) as JobStatus;
    } else {
      const overJob = jobs.find((j) => j.id === over.id);
      if (overJob) target = overJob.status;
    }
    if (!target || target === activeJ.status) return;

    const today = new Date().toISOString().slice(0, 10);
    const patch: Parameters<typeof update.mutateAsync>[0]['patch'] = { status: target };
    if (target === 'in_shop' && !activeJ.date_received) patch.date_received = today;
    if (target === 'complete_awaiting_pickup' && !activeJ.date_completed)
      patch.date_completed = today;
    if (target === 'paid_closed') {
      if (!activeJ.date_paid) patch.date_paid = today;
      if (activeJ.actual_charged == null && activeJ.quote_amount != null) {
        patch.actual_charged = activeJ.quote_amount;
      }
    }

    update.mutate({ id: activeJ.id, patch });
  };

  const paidFilterButton = (
    <button
      type="button"
      onClick={() => setPaidUnreviewedOnly(!paidUnreviewedOnly)}
      aria-pressed={paidUnreviewedOnly}
      title={
        paidUnreviewedOnly
          ? 'Showing only jobs without review request — tap to show all'
          : 'Show only jobs without review request'
      }
      className={`min-h-[28px] rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${
        paidUnreviewedOnly
          ? 'bg-amber-200 text-amber-900'
          : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      ★ Unreviewed
    </button>
  );

  const board = (
    <div className="h-full overflow-x-auto snap-x snap-mandatory md:snap-none">
      <div className="flex h-full gap-3 px-3 py-3 md:grid md:grid-cols-6 md:px-5">
        {JOB_STATUS_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            jobs={grouped[status]}
            onCardClick={setOpenJobId}
            draggable={isDesktop}
            headerExtras={status === 'paid_closed' ? paidFilterButton : undefined}
          />
        ))}
      </div>
    </div>
  );

  const filterDropdown = (
    <label className="flex items-center gap-1.5">
      <span className="sr-only">Filter by source</span>
      <select
        value={sourceFilter}
        onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
        aria-label="Filter by source"
        className={`min-h-[40px] rounded-lg border bg-white px-2 py-1.5 pr-7 text-sm ${
          sourceFilter === 'all'
            ? 'border-slate-300 text-slate-700'
            : 'border-brand-600 text-brand-800 font-medium'
        }`}
      >
        <option value="all">All sources</option>
        {CONTACT_SOURCES.map((s) => (
          <option key={s} value={s}>
            {CONTACT_SOURCE_LABELS[s]}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex h-full flex-col">
      <TopNav
        view="kanban"
        onNewJob={() => setNewJobOpen(true)}
        extras={filterDropdown}
      />
      <PipelineSummary jobs={visibleJobs} />
      <main className="flex-1 overflow-hidden">
        {error ? (
          <p className="p-4 text-sm text-rust-700">
            Couldn't load jobs: {(error as Error).message}
          </p>
        ) : isLoading ? (
          <p className="p-4 text-sm text-slate-500">Loading jobs…</p>
        ) : isDesktop ? (
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveJobId(null)}
          >
            {board}
            <DragOverlay dropAnimation={null}>
              {activeJob ? <JobCardView job={activeJob} asOverlay /> : null}
            </DragOverlay>
          </DndContext>
        ) : (
          board
        )}
      </main>

      {newJobOpen && <NewJobModal onClose={() => setNewJobOpen(false)} />}
      {openJobId && (
        <JobDetailModal jobId={openJobId} onClose={() => setOpenJobId(null)} />
      )}
    </div>
  );
}
