import { useState } from 'react';
import { formatCurrency } from '../lib/format';

export interface SourceRow {
  key: string;
  label: string;
  count: number;
  charged: number;
  netProfit: number;
}

export type SourceMetric = 'count' | 'netProfit' | 'charged';

const METRIC_ORDER: SourceMetric[] = ['count', 'netProfit', 'charged'];

const METRIC_LABELS: Record<SourceMetric, string> = {
  count: 'Jobs',
  netProfit: 'Net Profit',
  charged: 'Charged',
};

// Single-hue chart: each bar is named by its own axis label, so color carries no
// identity and one validated brand step does the whole job.
const BAR_COLOR = '#059669';

function metricValue(row: SourceRow, metric: SourceMetric): number {
  return metric === 'count' ? row.count : metric === 'netProfit' ? row.netProfit : row.charged;
}

function formatMetric(value: number, metric: SourceMetric): string {
  return metric === 'count' ? String(value) : formatCurrency(value);
}

export function SourceBreakdownChart({ rows }: { rows: SourceRow[] }) {
  const [metric, setMetric] = useState<SourceMetric>('count');

  const sorted = [...rows].sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
  const total = sorted.reduce((sum, r) => sum + metricValue(r, metric), 0);
  // Negative net-profit months exist, so scale on the largest magnitude.
  const max = Math.max(1, ...sorted.map((r) => Math.abs(metricValue(r, metric))));

  return (
    <div>
      {/* Metric toggle — which measure the ranking is built on */}
      <div className="mb-3 flex gap-1">
        {METRIC_ORDER.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetric(m)}
            aria-pressed={metric === m}
            className={`min-h-[32px] rounded-md px-2.5 py-1 text-xs font-medium transition ${
              metric === m
                ? 'bg-brand-700 text-white'
                : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {METRIC_LABELS[m]}
          </button>
        ))}
      </div>

      <ul className="space-y-2.5">
        {sorted.map((r) => {
          const value = metricValue(r, metric);
          const pct = total > 0 ? (value / total) * 100 : 0;
          const width = (Math.abs(value) / max) * 100;
          return (
            <li key={r.key}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-900">{r.label}</span>
                <span className="shrink-0 text-sm font-semibold text-slate-900 tabular-nums">
                  {formatMetric(value, metric)}
                  {total > 0 && value > 0 && (
                    <span className="ml-1.5 text-xs font-normal text-slate-400">
                      {pct.toFixed(0)}%
                    </span>
                  )}
                </span>
              </div>
              {/* Track + bar: square at the baseline, 4px rounded data-end */}
              <div className="mt-1 h-2.5 w-full rounded-sm bg-slate-100">
                <div
                  className="h-full rounded-r-[4px]"
                  style={{
                    width: `${Math.max(width, value !== 0 ? 2 : 0)}%`,
                    backgroundColor: BAR_COLOR,
                  }}
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                {r.count} job{r.count === 1 ? '' : 's'} · {formatCurrency(r.charged)} charged ·{' '}
                {formatCurrency(r.netProfit)} net
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
