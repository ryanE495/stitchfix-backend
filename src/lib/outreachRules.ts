import { addDays, daysBetween, localDayOf, weekdayOf } from './dates';
import {
  ROTATION_WEEKDAY,
  type FbGroup,
  type FbGroupPost,
  type FbGroupStats,
  type FbRotation,
  type JobWithCustomer,
  type PostTemplate,
} from './types';

/**
 * Pure scheduling + stats logic for Facebook group outreach. No network, no
 * React, so it can be tested directly.
 */

/** Posts for `groupId` that fall inside [weekStart, weekStart+6]. */
export function postsInWeek(
  posts: FbGroupPost[],
  groupId: string,
  weekStart: string,
): number {
  const end = addDays(weekStart, 6);
  return posts.filter((p) => {
    if (p.group_id !== groupId) return false;
    const day = localDayOf(p.posted_at);
    return day >= weekStart && day <= end;
  }).length;
}

/** True when posting to this group on `date` is allowed by its own rules. */
export function canPostOn(
  group: FbGroup,
  date: string,
  posts: FbGroupPost[],
  weekStart: string,
): boolean {
  if (group.status !== 'active') return false;
  if (!group.allowed_weekdays.includes(weekdayOf(date))) return false;
  if (group.max_posts_per_week != null) {
    if (postsInWeek(posts, group.id, weekStart) >= group.max_posts_per_week) return false;
  }
  return true;
}

/**
 * Next date on or after `from` that this group allows, within the week.
 * Returns null when the group has no usable day left this week.
 */
export function nextAllowedDate(
  group: FbGroup,
  from: string,
  weekStart: string,
  posts: FbGroupPost[],
): string | null {
  const weekEnd = addDays(weekStart, 6);
  for (let d = from; d <= weekEnd; d = addDays(d, 1)) {
    if (canPostOn(group, d, posts, weekStart)) return d;
  }
  return null;
}

export interface RotationPlan {
  rotation: FbRotation;
  /** The rotation's nominal day (Mon for A, Thu for B) within this week. */
  date: string;
  /** Groups that can post on the rotation day itself. */
  onDay: FbGroup[];
  /** Groups whose allowed days miss the rotation day, with their catch-up date. */
  offDay: { group: FbGroup; date: string }[];
  /** Active groups in this rotation with nowhere left to go this week. */
  unschedulable: FbGroup[];
}

/**
 * Split one rotation's groups into "posts on the rotation day" and "needs its
 * own task on another day", per the rule that a group whose allowed days miss
 * its rotation day gets scheduled on its next allowed day.
 */
export function planRotation(
  rotation: FbRotation,
  groups: FbGroup[],
  posts: FbGroupPost[],
  weekStart: string,
  /** Day being planned for. Defaults to the rotation's nominal day. */
  on?: string,
): RotationPlan {
  const date = on ?? rotationDate(rotation, weekStart);
  const mine = groups.filter((g) => g.rotation === rotation && g.status === 'active');

  const onDay: FbGroup[] = [];
  const offDay: { group: FbGroup; date: string }[] = [];
  const unschedulable: FbGroup[] = [];

  for (const g of mine) {
    if (canPostOn(g, date, posts, weekStart)) {
      onDay.push(g);
      continue;
    }
    // Only look FORWARD from the posting day. Searching from the start of the
    // week could pick a day that has already gone by.
    const next = nextAllowedDate(g, date, weekStart, posts);
    if (next) offDay.push({ group: g, date: next });
    else unschedulable.push(g);
  }

  return { rotation, date, onDay, offDay, unschedulable };
}

/** The rotation's nominal day in a Mon-first week: A -> Monday, B -> Thursday. */
export function rotationDate(rotation: FbRotation, weekStart: string): string {
  // ROTATION_WEEKDAY holds JS weekday numbers (1 = Mon, 4 = Thu), and the
  // week starts on Monday, so the offset from weekStart is weekday - 1.
  return addDays(weekStart, ROTATION_WEEKDAY[rotation] - 1);
}

export interface PendingOutreachTask {
  title: string;
  type: 'business';
  scheduled_date: string;
  source: 'auto';
  auto_rule: 'fb_rotation' | 'fb_group_offday';
  fb_rotation: FbRotation | null;
  fb_group_id: string | null;
}

/**
 * Tasks the board is missing for this week. Diffs against what already
 * exists; the partial unique indexes in migration 013 are the backstop.
 */
export function computeOutreachTasks(
  groups: FbGroup[],
  posts: FbGroupPost[],
  existing: {
    fb_rotation: string | null;
    fb_group_id: string | null;
    scheduled_date: string;
  }[],
  weekStart: string,
  today: string,
): PendingOutreachTask[] {
  // `existing` is already limited to this week by the caller, so keying on
  // rotation / group alone means "one per week". Keying on the date as well
  // would miss a task that was created on a shifted day (see below) and make
  // a second copy on the next load.
  const haveRotation = new Set(existing.filter((t) => t.fb_rotation).map((t) => t.fb_rotation));
  const haveGroup = new Set(existing.filter((t) => t.fb_group_id).map((t) => t.fb_group_id));
  const weekEnd = addDays(weekStart, 6);

  const out: PendingOutreachTask[] = [];

  for (const rotation of ['A', 'B'] as FbRotation[]) {
    // Never create work on a day that's already over. If the rotation's day
    // has passed but the week hasn't, plan it for today; if the whole week
    // is over (browsing history), plan nothing.
    const nominal = rotationDate(rotation, weekStart);
    const on = nominal < today ? today : nominal;
    if (on > weekEnd) continue;

    const plan = planRotation(rotation, groups, posts, weekStart, on);

    if (plan.onDay.length > 0 && !haveRotation.has(rotation)) {
      out.push({
        title: `Post in Group ${rotation} (${plan.onDay.length} group${plan.onDay.length === 1 ? '' : 's'})`,
        type: 'business',
        scheduled_date: plan.date,
        source: 'auto',
        auto_rule: 'fb_rotation',
        fb_rotation: rotation,
        fb_group_id: null,
      });
      haveRotation.add(rotation);
    }

    for (const { group, date } of plan.offDay) {
      if (haveGroup.has(group.id)) continue;
      out.push({
        title: `Post in ${group.name}`,
        type: 'business',
        scheduled_date: date,
        source: 'auto',
        auto_rule: 'fb_group_offday',
        fb_rotation: null,
        fb_group_id: group.id,
      });
      haveGroup.add(group.id);
    }
  }

  return out;
}

// ── Groups page stats ────────────────────────────────────────────────────

export function computeGroupStats(
  groups: FbGroup[],
  posts: FbGroupPost[],
  jobs: JobWithCustomer[],
  today: string,
  weekStart: string,
): FbGroupStats[] {
  const lastByGroup = new Map<string, string>();
  for (const p of posts) {
    const cur = lastByGroup.get(p.group_id);
    if (!cur || p.posted_at > cur) lastByGroup.set(p.group_id, p.posted_at);
  }

  const jobsByGroup = new Map<string, { count: number; revenue: number }>();
  for (const j of jobs) {
    if (!j.fb_group_id) continue;
    const agg = jobsByGroup.get(j.fb_group_id) ?? { count: 0, revenue: 0 };
    agg.count += 1;
    // actual_charged is what was really collected; quote_amount is not
    // revenue until it is. Unpriced jobs contribute count but no revenue.
    agg.revenue += Number(j.actual_charged ?? 0);
    jobsByGroup.set(j.fb_group_id, agg);
  }

  return groups.map((group) => {
    const lastPostedAt = lastByGroup.get(group.id) ?? null;
    const agg = jobsByGroup.get(group.id);
    return {
      group,
      lastPostedAt,
      daysSince: lastPostedAt ? daysBetween(localDayOf(lastPostedAt), today) : null,
      postsThisWeek: postsInWeek(posts, group.id, weekStart),
      jobsSourced: agg?.count ?? 0,
      revenueSourced: agg?.revenue ?? 0,
    };
  });
}

/**
 * Spread each region's active groups evenly across A and B, so neither
 * rotation day is all one region. Returns only the groups that change.
 */
export function autoBalanceRotations(
  groups: FbGroup[],
): { id: string; rotation: FbRotation }[] {
  const changes: { id: string; rotation: FbRotation }[] = [];
  const byRegion = new Map<string, FbGroup[]>();

  for (const g of groups) {
    if (g.status !== 'active') continue;
    const list = byRegion.get(g.region) ?? [];
    list.push(g);
    byRegion.set(g.region, list);
  }

  for (const [, list] of byRegion) {
    // Stable order so the result is deterministic rather than dependent on
    // whatever order the query happened to return.
    const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
    sorted.forEach((g, i) => {
      const want: FbRotation = i % 2 === 0 ? 'A' : 'B';
      if (g.rotation !== want) changes.push({ id: g.id, rotation: want });
    });
  }

  return changes;
}

export interface TemplateStat {
  template: PostTemplate;
  posts: number;
  jobsWithin7Days: number;
}

/**
 * Template performance: how often each template was posted, and how many
 * jobs arrived from that same group within 7 days of such a post.
 *
 * CAVEAT: this is correlation, not attribution. A job is counted if it came
 * from a group that had a post using this template in the preceding 7 days;
 * nothing records which post the customer actually saw. Two templates posted
 * to the same group in one week will both claim the same job.
 */
export function computeTemplateStats(
  templates: PostTemplate[],
  posts: FbGroupPost[],
  jobs: JobWithCustomer[],
): TemplateStat[] {
  return templates.map((template) => {
    const used = posts.filter((p) => p.template_id === template.id);
    let jobsWithin7Days = 0;

    for (const j of jobs) {
      if (!j.fb_group_id) continue;
      const created = localDayOf(j.created_at);
      const hit = used.some((p) => {
        if (p.group_id !== j.fb_group_id) return false;
        const gap = daysBetween(localDayOf(p.posted_at), created);
        return gap >= 0 && gap <= 7;
      });
      if (hit) jobsWithin7Days += 1;
    }

    return { template, posts: used.length, jobsWithin7Days };
  });
}

// ── Groups page "last posted" date picker ────────────────────────────────

export type LastPostedEdit =
  | { kind: 'unchanged' }
  | { kind: 'log' }
  | { kind: 'correct'; postId: string }
  | { kind: 'blocked'; blockerDay: string };

/**
 * What picking `day` in the "last posted" picker should do, given this
 * group's post history. Later than the newest post (or no posts yet) means a
 * new post; earlier means correcting the newest one -- unless another post
 * would still sit after the chosen day, in which case the edit is refused
 * rather than leaving the page showing a date that wasn't picked.
 */
export function planLastPostedEdit(groupPosts: FbGroupPost[], day: string): LastPostedEdit {
  const sorted = [...groupPosts].sort((a, b) => b.posted_at.localeCompare(a.posted_at));
  const latest = sorted[0];
  if (!latest) return { kind: 'log' };

  const latestDay = localDayOf(latest.posted_at);
  if (latestDay === day) return { kind: 'unchanged' };
  if (day > latestDay) return { kind: 'log' };

  const blocker = sorted.slice(1).find((p) => localDayOf(p.posted_at) > day);
  if (blocker) return { kind: 'blocked', blockerDay: localDayOf(blocker.posted_at) };
  return { kind: 'correct', postId: latest.id };
}
