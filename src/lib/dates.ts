export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diff = Date.now() - then;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function ageBadgeTone(days: number | null): 'green' | 'yellow' | 'red' | 'gray' {
  if (days == null) return 'gray';
  if (days < 3) return 'green';
  if (days < 7) return 'yellow';
  return 'red';
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// For <input type="date">: returns YYYY-MM-DD or empty string
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  // Accepts both YYYY-MM-DD and full ISO timestamps
  return iso.slice(0, 10);
}

// Today as YYYY-MM-DD in local time. (toISOString() would give the UTC
// date, which is already tomorrow after ~6pm in Colorado.)
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// True when a follow-up due date is today or earlier (ISO string compare).
export function isFollowupOverdue(followupBy: string | null | undefined): boolean {
  if (!followupBy) return false;
  return followupBy.slice(0, 10) <= todayIso();
}

// ── Week math for the planner ──────────────────────────────────────────
// All of these work in LOCAL time and produce YYYY-MM-DD strings, matching
// how `date` columns round-trip through PostgREST. Never use toISOString()
// for a calendar date -- it shifts by the UTC offset and lands on the wrong
// day for anyone west of Greenwich, which is everyone here.

/** YYYY-MM-DD for a Date, in local time. */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as a LOCAL midnight Date (not UTC). */
export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(iso: string, n: number): string {
  const d = fromIsoDate(iso);
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

/** Monday of the week containing `iso`. */
export function startOfWeek(iso: string): string {
  const d = fromIsoDate(iso);
  const dow = d.getDay(); // 0=Sun
  const backToMonday = dow === 0 ? 6 : dow - 1;
  d.setDate(d.getDate() - backToMonday);
  return toIsoDate(d);
}

/** The 7 dates Mon..Sun for the week containing `iso`. */
export function weekDates(iso: string): string[] {
  const monday = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** 0=Sunday..6=Saturday for a YYYY-MM-DD string. */
export function weekdayOf(iso: string): number {
  return fromIsoDate(iso).getDay();
}

/** "Sep 22 – Sep 28, 2026" */
export function formatWeekRange(mondayIso: string): string {
  const start = fromIsoDate(mondayIso);
  const end = fromIsoDate(addDays(mondayIso, 6));
  const sameYear = start.getFullYear() === end.getFullYear();
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(withYear ? { year: 'numeric' } : {}),
    });
  return `${fmt(start, !sameYear)} – ${fmt(end, true)}`;
}

/** Whole days between two YYYY-MM-DD dates (b - a). */
export function daysBetween(a: string, b: string): number {
  const ms = fromIsoDate(b).getTime() - fromIsoDate(a).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/** "1h 30m" / "45m" / "—" */
export function formatMinutes(mins: number | null | undefined): string {
  if (mins == null || mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Local calendar day (YYYY-MM-DD) of a timestamp. Use this instead of
 * `ts.slice(0, 10)`, which reads the UTC date: a 7pm Colorado timestamp is
 * already tomorrow in UTC. Plain YYYY-MM-DD input is returned unchanged,
 * since `new Date('2026-09-20')` would itself be parsed as UTC.
 */
export function localDayOf(ts: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) return ts;
  return toIsoDate(new Date(ts));
}

/** ISO timestamp for noon local time on a YYYY-MM-DD day. Noon keeps the
 *  stored UTC instant on the same calendar day in any US timezone. */
export function noonLocalIso(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
}
