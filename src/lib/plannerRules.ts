import { addDays, daysBetween, localDayOf, weekdayOf } from './dates';
import type {
  AutoRule,
  BlockedDay,
  JobWithCustomer,
  RecurringTask,
  TaskType,
} from './types';

/**
/** Pure decision logic for the board's automation -- no network, no React.
 *
 * Everything here is IDEMPOTENT: running it twice in a row
 * must not create a second copy of anything, because React StrictMode mounts
 * effects twice in development and a stale tab can reload at any time.
 *
 * Two layers of protection:
 *   1. These functions diff against what already exists before inserting.
 *   2. Partial unique indexes in migration 012 are the real backstop, so a
 *      race between two tabs fails the insert rather than duplicating.
 */

export interface AutoRuleSpec {
  rule: AutoRule;
  type: TaskType;
  /** Days in the status before the rule fires. */
  thresholdDays: number;
  title: (customerName: string) => string;
}

export const AUTO_RULES: AutoRuleSpec[] = [
  {
    rule: 'awaiting_dropoff_stale',
    type: 'business',
    thresholdDays: 7,
    title: (c) => `Call ${c} to schedule drop-off`,
  },
  {
    rule: 'quote_followup',
    type: 'business',
    thresholdDays: 5,
    title: (c) => `Follow up on quote: ${c}`,
  },
  {
    rule: 'pickup_reminder',
    type: 'business',
    thresholdDays: 7,
    title: (c) => `Pickup reminder + ask for review: ${c}`,
  },
  {
    rule: 'lost_reengage',
    type: 'business',
    thresholdDays: 0,
    title: (c) => `Re-engage ${c}`,
  },
];

/** How many days a job has sat in its current status.
 *
 * CAVEAT: stitchworks_jobs has no status-transition history, so this is a
 * proxy. `complete_awaiting_pickup` is exact because advancing to it stamps
 * date_completed. The others fall back to updated_at, which is bumped by ANY
 * edit -- so editing a note on a stale job resets its clock. Fixing that
 * properly means a status_changed_at column and a trigger.
 */
export function daysInStatus(job: JobWithCustomer, today: string): number {
  const anchor =
    job.status === 'complete_awaiting_pickup' && job.date_completed
      ? job.date_completed.slice(0, 10)
      : localDayOf(job.updated_at ?? job.created_at);
  return daysBetween(anchor, today);
}

/** First date from `start` (inclusive) whose weekday/date is not blocked. */
export function nextUnblockedDate(
  start: string,
  blocked: BlockedDay[],
  maxLookahead = 14,
): string {
  const blockedWeekdays = new Set(
    blocked.filter((b) => b.weekday != null).map((b) => b.weekday as number),
  );
  const blockedDates = new Set(
    blocked.filter((b) => b.date != null).map((b) => b.date as string),
  );

  for (let i = 0; i < maxLookahead; i++) {
    const d = addDays(start, i);
    if (!blockedWeekdays.has(weekdayOf(d)) && !blockedDates.has(d)) return d;
  }
  // Every day in range is blocked (e.g. all 7 weekdays marked). Blocked days
  // still accept tasks, so falling back to `start` is correct, not a failure.
  return start;
}

interface PendingTask {
  title: string;
  type: TaskType;
  scheduled_date: string;
  job_id: string;
  auto_rule: AutoRule;
  source: 'auto';
}

/**
 * Work out which auto tasks are missing. Pure -- takes the jobs and the auto
 * tasks that already exist, returns only the rows that need inserting.
 */
export function computeAutoTasks(
  jobs: JobWithCustomer[],
  existing: { job_id: string | null; auto_rule: string | null; completed_at: string | null }[],
  blocked: BlockedDay[],
  today: string,
): PendingTask[] {
  // An OPEN task for (job, rule) blocks a re-fire...
  const openKeys = new Set(
    existing
      .filter((t) => t.completed_at == null && t.job_id && t.auto_rule)
      .map((t) => `${t.job_id}:${t.auto_rule}`),
  );
  // A COMPLETED one blocks it too, for the rule's own interval. Without this
  // cooldown, checking off "Call Alanna" brought the same task straight back
  // on the next load whenever the job hadn't moved stage on the Kanban yet.
  // Latest completion per (job, rule):
  const lastDone = new Map<string, string>();
  for (const t of existing) {
    if (!t.completed_at || !t.job_id || !t.auto_rule) continue;
    const k = `${t.job_id}:${t.auto_rule}`;
    const day = localDayOf(t.completed_at);
    const cur = lastDone.get(k);
    if (!cur || day > cur) lastDone.set(k, day);
  }
  // ...except lost_reengage, which is once-ever regardless of completion.
  const everReengaged = new Set(
    existing
      .filter((t) => t.auto_rule === 'lost_reengage' && t.job_id)
      .map((t) => t.job_id as string),
  );

  const target = nextUnblockedDate(today, blocked);
  const out: PendingTask[] = [];

  for (const job of jobs) {
    const customer = job.customer?.name;
    if (!customer) continue; // orphaned job; nothing useful to say in a title
    const age = daysInStatus(job, today);

    const fire = (rule: AutoRule) => {
      const spec = AUTO_RULES.find((r) => r.rule === rule)!;
      if (rule === 'lost_reengage') {
        if (everReengaged.has(job.id)) return;
      } else if (openKeys.has(`${job.id}:${rule}`)) {
        return;
      } else {
        const done = lastDone.get(`${job.id}:${rule}`);
        if (done && daysBetween(done, today) < spec.thresholdDays) return;
      }
      out.push({
        title: spec.title(customer),
        type: spec.type,
        scheduled_date: target,
        job_id: job.id,
        auto_rule: rule,
        source: 'auto',
      });
      // Guard against two rules in one pass emitting the same key.
      openKeys.add(`${job.id}:${rule}`);
      if (rule === 'lost_reengage') everReengaged.add(job.id);
    };

    switch (job.status) {
      case 'awaiting_dropoff':
        if (age > 7) fire('awaiting_dropoff_stale');
        break;
      case 'quoted':
        if (age > 5) fire('quote_followup');
        break;
      case 'complete_awaiting_pickup':
        if (age > 7) fire('pickup_reminder');
        break;
      case 'lost':
        // Only chase recently-lost work; past ~6 months it's cold.
        if (age < 180) fire('lost_reengage');
        break;
      default:
        break;
    }
  }

  return out;
}

/** Recurring instances missing from the visible week. */
export function computeRecurringTasks(
  recurring: RecurringTask[],
  existing: { recurring_task_id: string | null; scheduled_date: string }[],
  weekDatesIso: string[],
  today: string,
) {
  const have = new Set(
    existing
      .filter((t) => t.recurring_task_id)
      .map((t) => `${t.recurring_task_id}:${t.scheduled_date}`),
  );

  const out = [];
  for (const r of recurring) {
    if (!r.active) continue;
    for (const date of weekDatesIso) {
      // A weekly routine whose day has already gone by isn't created after
      // the fact -- it would be born overdue and roll with a false badge.
      if (date < today) continue;
      if (weekdayOf(date) !== r.weekday) continue;
      if (have.has(`${r.id}:${date}`)) continue;
      out.push({
        title: r.title,
        type: r.type,
        scheduled_date: date,
        estimated_minutes: r.estimated_minutes,
        recurring_task_id: r.id,
        source: 'recurring' as const,
      });
      have.add(`${r.id}:${date}`);
    }
  }
  return out;
}


// ── Sunday planning: copy last week's plan forward ──────────────────────

export interface WeekCopyRow {
  title: string;
  type: TaskType;
  scheduled_date: string;
  estimated_minutes: number | null;
  notes: string | null;
  source: 'manual';
}

/**
 * Manual tasks from one week, re-dated onto the same weekdays of another.
 *
 * Safe to run twice: each source task is matched against what's already in
 * the target week (same title, same day), counting duplicates -- so three
 * "Post a photo" tasks on one day copy as three, and a second click copies
 * nothing. Days already over are skipped rather than created overdue. Job
 * links aren't carried: last week's job isn't next week's job. Auto and
 * recurring tasks aren't copied either; the board regenerates those itself.
 */
export function computeWeekCopy(
  sourceTasks: {
    title: string;
    type: TaskType;
    scheduled_date: string;
    estimated_minutes: number | null;
    notes: string | null;
    source: string;
  }[],
  targetExisting: { title: string; scheduled_date: string }[],
  fromWeekStart: string,
  toWeekStart: string,
  today: string,
): { rows: WeekCopyRow[]; skippedPast: number; skippedExisting: number } {
  const offset = daysBetween(fromWeekStart, toWeekStart);
  const key = (title: string, day: string) => `${title.trim().toLowerCase()}|${day}`;

  const remaining = new Map<string, number>();
  for (const t of targetExisting) {
    const k = key(t.title, t.scheduled_date);
    remaining.set(k, (remaining.get(k) ?? 0) + 1);
  }

  const rows: WeekCopyRow[] = [];
  let skippedPast = 0;
  let skippedExisting = 0;

  for (const t of sourceTasks) {
    if (t.source !== 'manual') continue;
    const day = addDays(t.scheduled_date, offset);
    if (day < today) {
      skippedPast++;
      continue;
    }
    const k = key(t.title, day);
    const left = remaining.get(k) ?? 0;
    if (left > 0) {
      remaining.set(k, left - 1);
      skippedExisting++;
      continue;
    }
    rows.push({
      title: t.title,
      type: t.type,
      scheduled_date: day,
      estimated_minutes: t.estimated_minutes,
      notes: t.notes,
      source: 'manual',
    });
  }

  return { rows, skippedPast, skippedExisting };
}

/**
 * Sunday planning: carry today's unfinished tasks into a coming week, onto
 * its first unblocked day (so they don't land on a day-job day).
 *
 * Outreach tasks stay put -- the target week generates its own rotation, and
 * moving this week's would collide with it (one per rotation per week).
 * rollover_count is deliberately not touched: moving work while planning
 * isn't the same as letting it slip.
 */
export function planCarryOver(
  tasks: {
    id: string;
    scheduled_date: string;
    completed_at: string | null;
    fb_rotation: string | null;
    fb_group_id: string | null;
  }[],
  targetWeekStart: string,
  blocked: BlockedDay[],
  today: string,
): { date: string; ids: string[]; skippedOutreach: number } {
  const blockedWeekdays = new Set(
    blocked.filter((b) => b.weekday != null).map((b) => b.weekday as number),
  );
  const blockedDates = new Set(
    blocked.filter((b) => b.date != null).map((b) => b.date as string),
  );

  // First unblocked day inside the target week; if every day is blocked,
  // fall back to its Monday (blocked days still accept tasks).
  let date = targetWeekStart;
  for (let i = 0; i < 7; i++) {
    const d = addDays(targetWeekStart, i);
    if (!blockedWeekdays.has(weekdayOf(d)) && !blockedDates.has(d)) {
      date = d;
      break;
    }
  }

  const ids: string[] = [];
  let skippedOutreach = 0;
  for (const t of tasks) {
    if (t.completed_at) continue;
    if (t.scheduled_date > today) continue; // only leftovers, not future plans
    if (t.fb_rotation || t.fb_group_id) {
      skippedOutreach++;
      continue;
    }
    ids.push(t.id);
  }
  return { date, ids, skippedOutreach };
}

// ── "Repeat weekly" from the task editor ─────────────────────────────────
// A series is the set of recurring templates sharing a title (case- and
// whitespace-insensitive), one template per weekday -- the shape the
// stitchworks_recurring_tasks table already has, so no schema change.

export interface RecurrencePlan {
  /** Weekdays that need a brand-new template. */
  create: number[];
  /** Paused templates to switch back on. */
  reactivate: string[];
  /** Templates for days no longer selected. */
  remove: string[];
  /** Future, unfinished copies belonging to removed templates. */
  deleteInstances: string[];
  /** Tasks to attach to the template for a weekday (current task included). */
  link: { taskId: string; weekday: number }[];
  /** The task being edited stops repeating and becomes a plain task. */
  unlinkCurrent: boolean;
}

export function planRecurrence(input: {
  /** Days chosen in the editor. Empty = stop repeating. */
  selected: number[];
  series: { id: string; weekday: number; active: boolean }[];
  task: { id: string; scheduled_date: string; recurring_task_id: string | null };
  /** Other unfinished tasks with the same title, dated today or later. */
  sameTitleOpen: { id: string; scheduled_date: string; recurring_task_id: string | null }[];
  /** Existing copies generated from this series' templates. */
  seriesInstances: {
    id: string;
    scheduled_date: string;
    completed_at: string | null;
    recurring_task_id: string | null;
  }[];
  today: string;
}): RecurrencePlan {
  const selected = new Set(input.selected);
  const byWeekday = new Map(input.series.map((t) => [t.weekday, t]));

  const create: number[] = [];
  const reactivate: string[] = [];
  for (const wd of [...selected].sort()) {
    const existing = byWeekday.get(wd);
    if (!existing) create.push(wd);
    else if (!existing.active) reactivate.push(existing.id);
  }

  const remove = input.series.filter((t) => !selected.has(t.weekday)).map((t) => t.id);
  const removeSet = new Set(remove);

  // Copies from removed days disappear going forward. Today's and anything
  // already done stay; so does the task you're editing.
  const deleteInstances = input.seriesInstances
    .filter(
      (i) =>
        i.recurring_task_id != null &&
        removeSet.has(i.recurring_task_id) &&
        !i.completed_at &&
        i.scheduled_date > input.today &&
        i.id !== input.task.id,
    )
    .map((i) => i.id);

  // Attach tasks to their weekday's template. At most one task per template
  // per date -- the DB enforces that too (recurring_task_id, scheduled_date).
  const link: { taskId: string; weekday: number }[] = [];
  const used = new Set<string>();
  const templateIdFor = (wd: number) => byWeekday.get(wd)?.id ?? `new:${wd}`;

  // Copies that already exist (and survive) claim their day first, so a
  // same-title plain task on that day doesn't get linked into a clash.
  const deleting = new Set(deleteInstances);
  for (const i of input.seriesInstances) {
    if (i.id === input.task.id || deleting.has(i.id) || !i.recurring_task_id) continue;
    if (removeSet.has(i.recurring_task_id)) continue;
    used.add(`${i.recurring_task_id}|${i.scheduled_date}`);
  }

  const currentWd = weekdayOf(input.task.scheduled_date);
  const currentRepeats = selected.has(currentWd);
  if (currentRepeats) {
    const target = templateIdFor(currentWd);
    const key = `${target}|${input.task.scheduled_date}`;
    if (input.task.recurring_task_id !== target && !used.has(key)) {
      link.push({ taskId: input.task.id, weekday: currentWd });
    }
    used.add(key);
  }

  for (const t of input.sameTitleOpen) {
    if (t.id === input.task.id) continue;
    if (t.recurring_task_id) continue; // already part of some series
    if (t.scheduled_date < input.today) continue;
    const wd = weekdayOf(t.scheduled_date);
    if (!selected.has(wd)) continue;
    const key = `${templateIdFor(wd)}|${t.scheduled_date}`;
    if (used.has(key)) continue; // a second same-title task that day stays plain
    used.add(key);
    link.push({ taskId: t.id, weekday: wd });
  }

  return {
    create,
    reactivate,
    remove,
    deleteInstances,
    link,
    unlinkCurrent: input.task.recurring_task_id != null && !currentRepeats,
  };
}

/** Series lookup key: same title, ignoring case and surrounding spaces. */
export function seriesKey(title: string): string {
  return title.trim().toLowerCase();
}
