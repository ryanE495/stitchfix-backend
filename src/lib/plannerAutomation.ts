import { supabase } from './supabase';
import { toIsoDate } from './dates';
import { computeAutoTasks, computeRecurringTasks } from './plannerRules';
import { computeOutreachTasks } from './outreachRules';
import type {
  BlockedDay,
  FbGroup,
  FbGroupPost,
  JobWithCustomer,
  RecurringTask,
} from './types';

/**
 * Supabase side of the board automation. The decision logic lives in
 * ./plannerRules.ts as pure functions so it can be tested without a network
 * or a browser; this module only does I/O.
 */

export interface AutomationResult {
  autoCreated: number;
  recurringCreated: number;
  rolledOver: number;
  outreachCreated: number;
}

/**
 * One full pass. Safe to call repeatedly.
 *
 * Rollover is self-idempotent: a task moved to today no longer matches
 * "scheduled_date < today", so a second pass finds nothing to move. The
 * caller still guards against CONCURRENT passes, which could double-count.
 */
export async function runPlannerAutomation(args: {
  jobs: JobWithCustomer[];
  recurring: RecurringTask[];
  blocked: BlockedDay[];
  fbGroups: FbGroup[];
  fbPosts: FbGroupPost[];
  weekDatesIso: string[];
  today?: string;
}): Promise<AutomationResult> {
  const today = args.today ?? toIsoDate(new Date());
  const result: AutomationResult = {
    autoCreated: 0,
    recurringCreated: 0,
    rolledOver: 0,
    outreachCreated: 0,
  };

  // ---- 1. Roll overdue incomplete tasks forward to today ----------------
  // Outreach tasks are excluded: each is pinned to a day that respects its
  // groups' posting rules, and moving a Wed/Thu-only group's task to a
  // Sunday would have you posting against the rules. A missed one stays on
  // its day, still clickable; the next rotation picks the groups up again.
  const { data: overdue, error: overdueErr } = await supabase
    .from('stitchworks_tasks')
    .select('id, rollover_count')
    .lt('scheduled_date', today)
    .is('completed_at', null)
    .is('fb_rotation', null)
    .is('fb_group_id', null);
  if (overdueErr) throw overdueErr;

  if (overdue && overdue.length > 0) {
    // rollover_count must increment per row, which PostgREST cannot express
    // as a bulk update -- so these go one at a time. Fine at one operator's
    // volume; revisit with an RPC if it ever gets slow.
    const results = await Promise.all(
      overdue.map((t) =>
        supabase
          .from('stitchworks_tasks')
          .update({
            scheduled_date: today,
            rollover_count: (t as { rollover_count: number }).rollover_count + 1,
          })
          .eq('id', (t as { id: string }).id),
      ),
    );
    // These results used to be ignored, which hid real failures. A unique
    // violation (a recurring instance already sitting on today) just means
    // that one stays put; anything else is surfaced.
    for (const { error } of results) {
      if (error && error.code !== '23505') throw error;
    }
    result.rolledOver = results.filter((r) => !r.error).length;
  }

  // ---- 2. Auto tasks from job state -------------------------------------
  // Pull every auto task ever, not just this week's: an open follow-up
  // sitting on a future date still has to suppress a duplicate.
  const { data: existingAuto, error: autoErr } = await supabase
    .from('stitchworks_tasks')
    .select('job_id, auto_rule, completed_at')
    .not('auto_rule', 'is', null);
  if (autoErr) throw autoErr;

  const pendingAuto = computeAutoTasks(
    args.jobs,
    existingAuto ?? [],
    args.blocked,
    today,
  );
  if (pendingAuto.length > 0) {
    const { error } = await supabase.from('stitchworks_tasks').insert(pendingAuto);
    // A unique-index violation here means another tab won the race. That is
    // the backstop doing its job, not an error worth surfacing.
    if (error && error.code !== '23505') throw error;
    if (!error) result.autoCreated = pendingAuto.length;
  }

  // ---- 3. Recurring instances for the visible week ----------------------
  const weekStart = args.weekDatesIso[0];
  const weekEnd = args.weekDatesIso[args.weekDatesIso.length - 1];
  const { data: existingRecurring, error: recErr } = await supabase
    .from('stitchworks_tasks')
    .select('recurring_task_id, scheduled_date')
    .gte('scheduled_date', weekStart)
    .lte('scheduled_date', weekEnd)
    .not('recurring_task_id', 'is', null);
  if (recErr) throw recErr;

  const pendingRecurring = computeRecurringTasks(
    args.recurring,
    existingRecurring ?? [],
    args.weekDatesIso,
    today,
  );
  if (pendingRecurring.length > 0) {
    const { error } = await supabase
      .from('stitchworks_tasks')
      .insert(pendingRecurring);
    if (error && error.code !== '23505') throw error;
    if (!error) result.recurringCreated = pendingRecurring.length;
  }

  // ---- 4. Facebook group outreach tasks for the visible week ------------
  const { data: existingOutreach, error: outErr } = await supabase
    .from('stitchworks_tasks')
    .select('fb_rotation, fb_group_id, scheduled_date')
    .gte('scheduled_date', weekStart)
    .lte('scheduled_date', weekEnd)
    .or('fb_rotation.not.is.null,fb_group_id.not.is.null');
  if (outErr) throw outErr;

  const pendingOutreach = computeOutreachTasks(
    args.fbGroups,
    args.fbPosts,
    existingOutreach ?? [],
    weekStart,
    today,
  );
  if (pendingOutreach.length > 0) {
    const { error } = await supabase.from('stitchworks_tasks').insert(pendingOutreach);
    if (error && error.code !== '23505') throw error;
    if (!error) result.outreachCreated = pendingOutreach.length;
  }

  return result;
}
