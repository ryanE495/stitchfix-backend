import { useMemo } from 'react';
import type { JobWithCustomer } from '../lib/types';
import { formatCurrency } from '../lib/format';

interface Props {
  jobs: JobWithCustomer[];
}

function thisYearMonth(): string {
  // YYYY-MM in local time (matches how Postgres `date` is stored)
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function PipelineSummary({ jobs }: Props) {
  const stats = useMemo(() => {
    const ym = thisYearMonth();
    let active = 0;
    let awaitingPickup = 0;
    let activePipeline = 0;
    let paidThisMonth = 0;

    for (const j of jobs) {
      if (j.status !== 'paid_closed') {
        active += 1;
        if (j.quote_amount != null) activePipeline += Number(j.quote_amount);
      }
      if (j.status === 'complete_awaiting_pickup') {
        awaitingPickup += 1;
      }
      if (j.date_paid && j.date_paid.slice(0, 7) === ym && j.actual_charged != null) {
        paidThisMonth += Number(j.actual_charged);
      }
    }

    return { active, awaitingPickup, activePipeline, paidThisMonth };
  }, [jobs]);

  return (
    <div className="border-b border-slate-200 bg-slate-100 px-3 py-2.5 sm:px-5">
      <div className="grid grid-cols-2 gap-y-2 sm:grid-cols-4 sm:gap-y-0">
        <Stat label="Active jobs" value={String(stats.active)} />
        <Stat label="Awaiting pickup" value={String(stats.awaitingPickup)} />
        <Stat label="Active pipeline" value={formatCurrency(stats.activePipeline)} />
        <Stat label="Paid this month" value={formatCurrency(stats.paidThisMonth)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 sm:px-4 sm:border-l sm:border-slate-300/70 sm:first:border-l-0 sm:first:pl-0">
      <p className="text-base font-semibold leading-tight text-slate-900 tabular-nums sm:text-lg">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
    </div>
  );
}
