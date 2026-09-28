import {
  BENCH_HOURS_TARGET,
  STUCK_ROLLOVER_THRESHOLD,
  type JobWithCustomer,
  type TaskWithJob,
} from '../lib/types';

interface Props {
  tasks: TaskWithJob[];
  jobs: JobWithCustomer[];
  weekDatesIso: string[];
}

function Tile({
  label,
  value,
  sub,
  tone = 'neutral',
  progress,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'good' | 'warn';
  progress?: number; // 0..1
}) {
  const valueTone =
    tone === 'good'
      ? 'text-brand-700'
      : tone === 'warn'
        ? 'text-rust-700'
        : 'text-slate-900';
  const barTone =
    tone === 'good' ? 'bg-brand-600' : tone === 'warn' ? 'bg-rust-500' : 'bg-slate-400';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${valueTone}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
      {progress != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${barTone}`}
            style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function WeekScoreboard({ tasks, jobs, weekDatesIso }: Props) {
  const inWeek = new Set(weekDatesIso);

  // Billable bench hours.
  //
  // CAVEAT: stitchworks_jobs has no time-entry log -- hours_worked is a single
  // lifetime total per job. So "this week" means jobs COMPLETED this week, and
  // the job's whole hour count lands in its completion week. Hours spent this
  // week on a job that finishes next week are not counted until then.
  const benchHours = jobs.reduce((sum, j) => {
    if (!j.date_completed) return sum;
    if (!inWeek.has(j.date_completed.slice(0, 10))) return sum;
    return sum + Number(j.hours_worked ?? 0);
  }, 0);

  const count = (type: 'business' | 'content') => {
    const of = tasks.filter((t) => t.type === type);
    return { done: of.filter((t) => t.completed_at).length, planned: of.length };
  };
  const business = count('business');
  const content = count('content');

  const stuck = tasks.filter(
    (t) => !t.completed_at && t.rollover_count >= STUCK_ROLLOVER_THRESHOLD,
  ).length;

  const benchPct = benchHours / BENCH_HOURS_TARGET;

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Tile
        label="Bench hours"
        value={`${benchHours.toFixed(1)} / ${BENCH_HOURS_TARGET}`}
        sub={
          benchHours >= BENCH_HOURS_TARGET
            ? 'Target met'
            : `${(BENCH_HOURS_TARGET - benchHours).toFixed(1)}h to target`
        }
        tone={benchHours >= BENCH_HOURS_TARGET ? 'good' : 'neutral'}
        progress={benchPct}
      />
      <Tile
        label="Business"
        value={`${business.done} / ${business.planned}`}
        sub="tasks completed"
        tone={business.planned > 0 && business.done === business.planned ? 'good' : 'neutral'}
        progress={business.planned ? business.done / business.planned : 0}
      />
      <Tile
        label="Content"
        value={`${content.done} / ${content.planned}`}
        sub="tasks completed"
        tone={content.planned > 0 && content.done === content.planned ? 'good' : 'neutral'}
        progress={content.planned ? content.done / content.planned : 0}
      />
      <Tile
        label="Stuck"
        value={String(stuck)}
        sub={`rolled ${STUCK_ROLLOVER_THRESHOLD}+ times`}
        tone={stuck > 0 ? 'warn' : 'good'}
      />
    </div>
  );
}
