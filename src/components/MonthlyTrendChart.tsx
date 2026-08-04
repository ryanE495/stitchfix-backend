import { useLayoutEffect, useRef, useState } from 'react';
import { formatCurrency } from '../lib/format';

export interface MonthPoint {
  key: string; // YYYY-MM
  label: string; // "Aug"
  labelWithYear: string; // "Aug 2025"
  charged: number;
  netProfit: number;
  count: number;
}

// Palette validated with the dataviz six-checks script (light surface):
// bars = brand-600, line = indigo-600. Both series are dollars → one shared axis.
const BAR_COLOR = '#059669';
const BAR_HOVER = '#10b981';
const LINE_COLOR = '#4f46e5';
const GRID_COLOR = '#e2e8f0';
const BASELINE_COLOR = '#cbd5e1';
const TICK_COLOR = '#64748b';

const HEIGHT = 240;
const MARGIN = { top: 12, right: 8, bottom: 26, left: 48 };

function useContainerWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Round a rough step up to a clean 1/2/2.5/5 × 10^n value. */
function niceStep(rough: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  if (norm <= 1) return mag;
  if (norm <= 2) return 2 * mag;
  if (norm <= 2.5) return 2.5 * mag;
  if (norm <= 5) return 5 * mag;
  return 10 * mag;
}

function fmtAxis(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) {
    const k = v / 1000;
    const s = Number.isInteger(k) ? String(k) : k.toFixed(1);
    return `$${s}k`;
  }
  return `$${v}`;
}

/** Column with a 4px rounded data-end and a square baseline. */
function columnPath(x: number, yTop: number, w: number, yBase: number): string {
  const r = Math.min(4, w / 2, Math.max(0, yBase - yTop));
  return [
    `M ${x} ${yBase}`,
    `L ${x} ${yTop + r}`,
    `Q ${x} ${yTop} ${x + r} ${yTop}`,
    `L ${x + w - r} ${yTop}`,
    `Q ${x + w} ${yTop} ${x + w} ${yTop + r}`,
    `L ${x + w} ${yBase}`,
    'Z',
  ].join(' ');
}

export function MonthlyTrendChart({ data }: { data: MonthPoint[] }) {
  const [containerRef, width] = useContainerWidth();
  const [active, setActive] = useState<number | null>(null);

  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;

  // Shared dollar scale across both series; keep 0 in the domain.
  const rawMax = Math.max(1, ...data.map((d) => Math.max(d.charged, d.netProfit)));
  const rawMin = Math.min(0, ...data.map((d) => d.netProfit));
  const step = niceStep((rawMax - rawMin) / 4);
  const yMax = Math.ceil(rawMax / step) * step;
  const yMin = Math.floor(rawMin / step) * step;
  const ticks: number[] = [];
  for (let t = yMin; t <= yMax + 1e-6; t += step) ticks.push(t);

  const y = (v: number) => MARGIN.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const band = data.length > 0 ? plotW / data.length : 0;
  const xCenter = (i: number) => MARGIN.left + band * i + band / 2;
  const barW = Math.min(24, band * 0.55);
  const yZero = y(0);

  // Thin out x labels when bands get narrow (phone widths).
  const labelEvery = band >= 30 ? 1 : band >= 16 ? 2 : 3;

  const linePoints = data.map((d, i) => `${xCenter(i)},${y(d.netProfit)}`).join(' ');

  const activePoint = active != null ? data[active] : null;
  const tipX =
    active != null ? Math.min(Math.max(xCenter(active), 80), Math.max(80, width - 80)) : 0;
  const tipY =
    activePoint != null
      ? Math.min(y(Math.max(activePoint.charged, 0)), y(activePoint.netProfit)) - 8
      : 0;

  return (
    <div>
      {/* Legend — two series, so identity never rides on color alone */}
      <div className="mb-2 flex items-center gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: BAR_COLOR }}
          />
          Charged
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-3.5 rounded-full"
            style={{ backgroundColor: LINE_COLOR }}
          />
          Net profit
        </span>
      </div>

      <div ref={containerRef} className="relative" style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label="Monthly charged and net profit">
            {/* Gridlines + y ticks */}
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={MARGIN.left}
                  x2={width - MARGIN.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 ? BASELINE_COLOR : GRID_COLOR}
                  strokeWidth={1}
                />
                <text
                  x={MARGIN.left - 6}
                  y={y(t)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={10}
                  fill={TICK_COLOR}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {fmtAxis(t)}
                </text>
              </g>
            ))}

            {/* Columns: total charged */}
            {data.map((d, i) =>
              d.charged > 0 ? (
                <path
                  key={d.key}
                  d={columnPath(xCenter(i) - barW / 2, y(d.charged), barW, yZero)}
                  fill={active === i ? BAR_HOVER : BAR_COLOR}
                />
              ) : null,
            )}

            {/* Line: net profit, with white-ringed dots */}
            <polyline
              points={linePoints}
              fill="none"
              stroke={LINE_COLOR}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {data.map((d, i) => (
              <circle
                key={d.key}
                cx={xCenter(i)}
                cy={y(d.netProfit)}
                r={active === i ? 5 : 4}
                fill={LINE_COLOR}
                stroke="#ffffff"
                strokeWidth={2}
              />
            ))}

            {/* X labels */}
            {data.map((d, i) =>
              i % labelEvery === 0 ? (
                <text
                  key={d.key}
                  x={xCenter(i)}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  fontSize={10}
                  fill={TICK_COLOR}
                >
                  {d.label === 'Jan' || i === 0 ? d.labelWithYear : d.label}
                </text>
              ) : null,
            )}

            {/* Hover/focus hit targets: full band, full plot height */}
            {data.map((d, i) => (
              <rect
                key={d.key}
                x={MARGIN.left + band * i}
                y={MARGIN.top}
                width={band}
                height={plotH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.labelWithYear}: charged ${formatCurrency(d.charged)}, net profit ${formatCurrency(d.netProfit)}, ${d.count} job${d.count === 1 ? '' : 's'}`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                style={{ outline: 'none' }}
              />
            ))}
          </svg>
        )}

        {/* Tooltip — one readout, every series */}
        {activePoint && (
          <div
            className="pointer-events-none absolute z-10 min-w-[130px] rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md"
            style={{ left: tipX, top: tipY, transform: 'translate(-50%, -100%)' }}
          >
            <p className="text-[11px] font-medium text-slate-500">{activePoint.labelWithYear}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm">
              <span
                className="inline-block h-0.5 w-3 rounded-full"
                style={{ backgroundColor: BAR_COLOR }}
              />
              <span className="font-semibold text-slate-900 tabular-nums">
                {formatCurrency(activePoint.charged)}
              </span>
              <span className="text-xs text-slate-500">charged</span>
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm">
              <span
                className="inline-block h-0.5 w-3 rounded-full"
                style={{ backgroundColor: LINE_COLOR }}
              />
              <span className="font-semibold text-slate-900 tabular-nums">
                {formatCurrency(activePoint.netProfit)}
              </span>
              <span className="text-xs text-slate-500">net</span>
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {activePoint.count} job{activePoint.count === 1 ? '' : 's'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
