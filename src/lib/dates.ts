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

// Today as YYYY-MM-DD in local time
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// True when a follow-up due date is today or earlier (ISO string compare).
export function isFollowupOverdue(followupBy: string | null | undefined): boolean {
  if (!followupBy) return false;
  return followupBy.slice(0, 10) <= todayIso();
}
