import { useMemo } from 'react';
import { TopNav } from '../components/TopNav';
import { useJobs } from '../hooks/useJobs';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
  CONTACT_SOURCE_LABELS,
  JOB_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  type ContactSource,
  type JobCategory,
  type PaymentMethod,
} from '../lib/types';
import { formatCurrency } from '../lib/format';

type TimeRange = 'this_month' | 'last_month' | 'last_90_days' | 'all_time';

const RANGE_LABELS: Record<TimeRange, string> = {
  this_month: 'This Month',
  last_month: 'Last Month',
  last_90_days: 'Last 90 Days',
  all_time: 'All Time',
};

const RANGE_ORDER: TimeRange[] = ['this_month', 'last_month', 'last_90_days', 'all_time'];

const RANGE_STORAGE_KEY = 'stitchworks.numbers.range';

// Tax set-aside rate — adjust here if a tax pro suggests a different bracket.
export const TAX_SET_ASIDE_RATE = 0.3;

function inRange(range: TimeRange, dateStr: string | null): boolean {
  if (range === 'all_time') return true;
  if (!dateStr) return false;
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();

  if (range === 'this_month') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  if (range === 'last_month') {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth();
  }
  if (range === 'last_90_days') {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 90);
    cutoff.setHours(0, 0, 0, 0);
    return d >= cutoff;
  }
  return false;
}

function fmtHours(n: number): string {
  return `${n.toFixed(1)}h`;
}
function fmtRate(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  return `${formatCurrency(n)}/hr`;
}

export function NumbersPage() {
  const { data: jobs = [], isLoading } = useJobs();
  const [range, setRange] = useLocalStorage<TimeRange>(RANGE_STORAGE_KEY, 'this_month');

  // Only paid_closed jobs whose date_paid falls in the selected range.
  const paidJobs = useMemo(
    () => jobs.filter((j) => j.status === 'paid_closed' && inRange(range, j.date_paid)),
    [jobs, range],
  );

  const stats = useMemo(() => {
    let charged = 0;
    let materials = 0;
    let hours = 0;
    for (const j of paidJobs) {
      if (j.actual_charged != null) charged += Number(j.actual_charged);
      if (j.materials_cost != null) materials += Number(j.materials_cost);
      if (j.hours_worked != null) hours += Number(j.hours_worked);
    }
    const netProfit = charged - materials;
    const hourlyRate = hours > 0 ? netProfit / hours : 0;
    return { charged, materials, netProfit, hours, hourlyRate, count: paidJobs.length };
  }, [paidJobs]);

  const byCategory = useMemo(() => {
    const map = new Map<
      string,
      { count: number; charged: number; materials: number; hours: number; key: JobCategory | 'unset' }
    >();
    for (const j of paidJobs) {
      const key = (j.category ?? 'unset') as JobCategory | 'unset';
      const row = map.get(key) ?? { count: 0, charged: 0, materials: 0, hours: 0, key };
      row.count += 1;
      if (j.actual_charged != null) row.charged += Number(j.actual_charged);
      if (j.materials_cost != null) row.materials += Number(j.materials_cost);
      if (j.hours_worked != null) row.hours += Number(j.hours_worked);
      map.set(key, row);
    }
    return Array.from(map.values())
      .map((r) => {
        const net = r.charged - r.materials;
        const rate = r.hours > 0 ? net / r.hours : 0;
        return {
          ...r,
          netProfit: net,
          hourlyRate: rate,
          label: r.key === 'unset' ? '(uncategorized)' : JOB_CATEGORY_LABELS[r.key],
        };
      })
      .sort((a, b) => b.hourlyRate - a.hourlyRate);
  }, [paidJobs]);

  const bySource = useMemo(() => {
    const map = new Map<ContactSource, { count: number; charged: number; materials: number }>();
    for (const j of paidJobs) {
      const src = (j.customer?.contact_source ?? 'other') as ContactSource;
      const row = map.get(src) ?? { count: 0, charged: 0, materials: 0 };
      row.count += 1;
      if (j.actual_charged != null) row.charged += Number(j.actual_charged);
      if (j.materials_cost != null) row.materials += Number(j.materials_cost);
      map.set(src, row);
    }
    return Array.from(map.entries())
      .map(([src, v]) => ({
        key: src,
        label: CONTACT_SOURCE_LABELS[src],
        count: v.count,
        charged: v.charged,
        netProfit: v.charged - v.materials,
      }))
      .sort((a, b) => b.netProfit - a.netProfit);
  }, [paidJobs]);

  const byMethod = useMemo(() => {
    const map = new Map<PaymentMethod | 'unset', { count: number; charged: number }>();
    for (const j of paidJobs) {
      const key = (j.payment_method ?? 'unset') as PaymentMethod | 'unset';
      const row = map.get(key) ?? { count: 0, charged: 0 };
      row.count += 1;
      if (j.actual_charged != null) row.charged += Number(j.actual_charged);
      map.set(key, row);
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({
        key,
        label: key === 'unset' ? '(not set)' : PAYMENT_METHOD_LABELS[key],
        count: v.count,
        charged: v.charged,
      }))
      .sort((a, b) => b.charged - a.charged);
  }, [paidJobs]);

  const taxSetAside = stats.netProfit > 0 ? stats.netProfit * TAX_SET_ASIDE_RATE : 0;

  return (
    <div className="flex h-full flex-col">
      <TopNav title="Numbers" />
      <main className="flex-1 overflow-y-auto pb-12">
        {/* Range selector */}
        <div className="border-b border-slate-200 bg-white px-3 py-2.5 sm:px-5">
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
            {RANGE_ORDER.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`min-h-[44px] shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  range === r
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <p className="p-4 text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="space-y-5 p-3 sm:p-5">
            {/* Headline stats: Net Profit + Hourly Rate are the standouts */}
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-6">
              <BigStat
                label="Net Profit"
                value={formatCurrency(stats.netProfit)}
                tone="brand"
                wide
              />
              <BigStat
                label="Effective $/Hour"
                value={fmtRate(stats.hourlyRate)}
                tone="brand"
                wide
              />
              <Stat label="Total Charged" value={formatCurrency(stats.charged)} />
              <Stat label="Materials Cost" value={formatCurrency(stats.materials)} />
              <Stat label="Total Hours" value={fmtHours(stats.hours)} />
              <Stat label="Job Count" value={String(stats.count)} />
            </section>

            {/* Tax set-aside (R4) */}
            <TaxSetAsideCard amount={taxSetAside} />

            {/* By Category */}
            <BreakdownTable
              title="By Category"
              sortNote="Sorted by hourly rate"
              headers={['Category', 'Jobs', 'Charged', 'Materials', 'Net', 'Hours', '$/Hour']}
              rows={byCategory.map((r) => [
                r.label,
                String(r.count),
                formatCurrency(r.charged),
                formatCurrency(r.materials),
                formatCurrency(r.netProfit),
                fmtHours(r.hours),
                fmtRate(r.hourlyRate),
              ])}
              emptyMessage="No paid jobs in this range yet."
            />

            {/* By Source */}
            <BreakdownTable
              title="By Source"
              sortNote="Sorted by net profit"
              headers={['Source', 'Jobs', 'Charged', 'Net']}
              rows={bySource.map((r) => [
                r.label,
                String(r.count),
                formatCurrency(r.charged),
                formatCurrency(r.netProfit),
              ])}
              emptyMessage="No paid jobs in this range yet."
            />

            {/* By Payment Method */}
            <BreakdownTable
              title="By Payment Method"
              sortNote="Sorted by amount"
              headers={['Method', 'Jobs', 'Charged']}
              rows={byMethod.map((r) => [r.label, String(r.count), formatCurrency(r.charged)])}
              emptyMessage="No paid jobs in this range yet."
            />
          </div>
        )}
      </main>
    </div>
  );
}

interface StatProps {
  label: string;
  value: string;
  tone?: 'default' | 'brand';
  wide?: boolean;
}

function Stat({ label, value }: StatProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-lg font-semibold leading-tight text-slate-900 tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
    </div>
  );
}

function BigStat({ label, value, tone = 'default', wide }: StatProps) {
  const toneClasses =
    tone === 'brand'
      ? 'border-brand-200 bg-brand-50'
      : 'border-slate-200 bg-white';
  return (
    <div className={`rounded-lg border p-3 ${toneClasses} ${wide ? 'col-span-2 sm:col-span-3' : ''}`}>
      <p className="text-2xl font-bold leading-tight text-slate-900 tabular-nums sm:text-3xl">
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
        {label}
      </p>
    </div>
  );
}

function TaxSetAsideCard({ amount }: { amount: number }) {
  const pct = Math.round(TAX_SET_ASIDE_RATE * 100);
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-900">
        Estimated tax set-aside ({pct}%)
      </p>
      <p className="mt-1 text-2xl font-bold leading-tight text-amber-900 tabular-nums sm:text-3xl">
        {formatCurrency(amount)}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-amber-900/80">
        Set this aside for federal, state, and self-employment tax. Estimate only — confirm with a
        tax professional.
      </p>
    </section>
  );
}

interface BreakdownProps {
  title: string;
  sortNote?: string;
  headers: string[];
  rows: string[][];
  emptyMessage: string;
}

function BreakdownTable({ title, sortNote, headers, rows, emptyMessage }: BreakdownProps) {
  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">{title}</h3>
        {sortNote && <span className="text-[11px] text-slate-400">· {sortNote}</span>}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
          {emptyMessage}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                {headers.map((h, i) => (
                  <th
                    key={h}
                    className={`whitespace-nowrap px-3 py-2 ${i === 0 ? '' : 'text-right'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`whitespace-nowrap px-3 py-2 tabular-nums ${
                        ci === 0
                          ? 'font-medium text-slate-900'
                          : 'text-right text-slate-700'
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
