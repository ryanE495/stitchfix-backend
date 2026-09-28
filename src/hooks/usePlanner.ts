import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { addDays } from '../lib/dates';
import {
  computeWeekCopy,
  planCarryOver,
  planRecurrence,
  seriesKey,
} from '../lib/plannerRules';
import type {
  BlockedDay,
  RecurringTask,
  Task,
  TaskType,
  TaskWithJob,
} from '../lib/types';

export const tasksKey = (from: string, to: string) => ['tasks', from, to] as const;
export const recurringTasksKey = ['recurringTasks'] as const;
export const blockedDaysKey = ['blockedDays'] as const;

const TASK_SELECT =
  '*, job:stitchworks_jobs(id, item_description, customer:stitchworks_customers(name))';

/**
 * Tasks in a date range. The range is widened by the caller to include
 * overdue days, because rollover needs to see them.
 */
export function useTasks(from: string, to: string) {
  return useQuery({
    queryKey: tasksKey(from, to),
    queryFn: async (): Promise<TaskWithJob[]> => {
      const { data, error } = await supabase
        .from('stitchworks_tasks')
        .select(TASK_SELECT)
        .gte('scheduled_date', from)
        .lte('scheduled_date', to)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaskWithJob[];
    },
  });
}

export function useRecurringTasks() {
  return useQuery({
    queryKey: recurringTasksKey,
    queryFn: async (): Promise<RecurringTask[]> => {
      const { data, error } = await supabase
        .from('stitchworks_recurring_tasks')
        .select('*')
        .order('weekday', { ascending: true });
      if (error) throw error;
      return (data ?? []) as RecurringTask[];
    },
  });
}

export function useBlockedDays() {
  return useQuery({
    queryKey: blockedDaysKey,
    queryFn: async (): Promise<BlockedDay[]> => {
      const { data, error } = await supabase
        .from('stitchworks_blocked_days')
        .select('*');
      if (error) throw error;
      return (data ?? []) as BlockedDay[];
    },
  });
}

export type TaskInput = {
  title: string;
  type: TaskType;
  scheduled_date: string;
  estimated_minutes?: number | null;
  notes?: string | null;
  job_id?: string | null;
};

/** Invalidate every task page, whatever week range it was cached under. */
function invalidateTasks(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: ['tasks'] });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TaskInput): Promise<Task> => {
      const { data, error } = await supabase
        .from('stitchworks_tasks')
        .insert({ ...input, source: 'manual' })
        .select('*')
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSettled: () => invalidateTasks(qc),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      patch: Partial<Omit<Task, 'id' | 'created_at'>>;
    }): Promise<Task> => {
      const { data, error } = await supabase
        .from('stitchworks_tasks')
        .update(args.patch)
        .eq('id', args.id)
        .select('*')
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSettled: () => invalidateTasks(qc),
  });
}

/**
 * Optimistic move between days -- the card follows the cursor immediately
 * instead of snapping back for a round-trip, matching the jobs Kanban.
 */
export function useMoveTask(from: string, to: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; scheduled_date: string }) => {
      const { error } = await supabase
        .from('stitchworks_tasks')
        .update({ scheduled_date: args.scheduled_date })
        .eq('id', args.id);
      if (error) throw error;
    },
    onMutate: async (args) => {
      const key = tasksKey(from, to);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TaskWithJob[]>(key);
      if (prev) {
        qc.setQueryData<TaskWithJob[]>(
          key,
          prev.map((t) =>
            t.id === args.id ? { ...t, scheduled_date: args.scheduled_date } : t,
          ),
        );
      }
      return { prev, key };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => invalidateTasks(qc),
  });
}

/** Toggle complete/incomplete, optimistically. */
export function useToggleTask(from: string, to: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from('stitchworks_tasks')
        .update({ completed_at: args.completed ? new Date().toISOString() : null })
        .eq('id', args.id);
      if (error) throw error;
    },
    onMutate: async (args) => {
      const key = tasksKey(from, to);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TaskWithJob[]>(key);
      if (prev) {
        qc.setQueryData<TaskWithJob[]>(
          key,
          prev.map((t) =>
            t.id === args.id
              ? { ...t, completed_at: args.completed ? new Date().toISOString() : null }
              : t,
          ),
        );
      }
      return { prev, key };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => invalidateTasks(qc),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('stitchworks_tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: () => invalidateTasks(qc),
  });
}

// ── Recurring task + blocked day management ───────────────────────────

export function useUpsertRecurringTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<RecurringTask> & { title: string }) => {
      const { error } = input.id
        ? await supabase
            .from('stitchworks_recurring_tasks')
            .update(input)
            .eq('id', input.id)
        : await supabase.from('stitchworks_recurring_tasks').insert(input);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: recurringTasksKey });
      invalidateTasks(qc);
    },
  });
}

export function useDeleteRecurringTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('stitchworks_recurring_tasks')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: recurringTasksKey }),
  });
}

export function useUpsertBlockedDay() {
  const qc = useQueryClient();
  return useMutation({
    // Rename an existing rule (id given), or block a weekday (weekday given).
    mutationFn: async (
      input: { id: string; label: string } | { weekday: number; label: string },
    ) => {
      const { error } =
        'id' in input
          ? await supabase
              .from('stitchworks_blocked_days')
              .update({ label: input.label })
              .eq('id', input.id)
          : await supabase
              .from('stitchworks_blocked_days')
              .insert({ weekday: input.weekday, label: input.label });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: blockedDaysKey }),
  });
}

export function useDeleteBlockedDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('stitchworks_blocked_days')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: blockedDaysKey }),
  });
}

/** Copy one week's manual tasks onto the same weekdays of another week. */
export function useCopyWeekPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { fromWeekStart: string; toWeekStart: string; today: string }) => {
      const fromEnd = addDays(args.fromWeekStart, 6);
      const toEnd = addDays(args.toWeekStart, 6);

      const [src, dst] = await Promise.all([
        supabase
          .from('stitchworks_tasks')
          .select('title, type, scheduled_date, estimated_minutes, notes, source')
          .eq('source', 'manual')
          .gte('scheduled_date', args.fromWeekStart)
          .lte('scheduled_date', fromEnd)
          .order('created_at', { ascending: true }),
        supabase
          .from('stitchworks_tasks')
          .select('title, scheduled_date')
          .gte('scheduled_date', args.toWeekStart)
          .lte('scheduled_date', toEnd),
      ]);
      if (src.error) throw src.error;
      if (dst.error) throw dst.error;

      const plan = computeWeekCopy(
        (src.data ?? []) as Parameters<typeof computeWeekCopy>[0],
        dst.data ?? [],
        args.fromWeekStart,
        args.toWeekStart,
        args.today,
      );
      if (plan.rows.length > 0) {
        const { error } = await supabase.from('stitchworks_tasks').insert(plan.rows);
        if (error) throw error;
      }
      return {
        copied: plan.rows.length,
        skippedPast: plan.skippedPast,
        skippedExisting: plan.skippedExisting,
      };
    },
    onSettled: () => invalidateTasks(qc),
  });
}

/** Move today's unfinished tasks onto a coming week's first unblocked day. */
export function useCarryOverTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      targetWeekStart: string;
      blocked: BlockedDay[];
      today: string;
    }) => {
      // Rollover keeps overdue non-outreach tasks on today, so "on or before
      // today" is exactly the leftover pile.
      const { data, error } = await supabase
        .from('stitchworks_tasks')
        .select('id, scheduled_date, completed_at, fb_rotation, fb_group_id')
        .lte('scheduled_date', args.today)
        .is('completed_at', null);
      if (error) throw error;

      const plan = planCarryOver(data ?? [], args.targetWeekStart, args.blocked, args.today);
      if (plan.ids.length > 0) {
        const { error: upErr } = await supabase
          .from('stitchworks_tasks')
          .update({ scheduled_date: plan.date })
          .in('id', plan.ids);
        if (upErr) throw upErr;
      }
      return { moved: plan.ids.length, date: plan.date, skippedOutreach: plan.skippedOutreach };
    },
    onSettled: () => invalidateTasks(qc),
  });
}

/**
 * Apply the task editor's "Repeat weekly" choice. The decisions live in
 * planRecurrence() (tested); this only does the reads and writes.
 */
export function useSetRecurrence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      task: { id: string; scheduled_date: string; recurring_task_id: string | null };
      /** Title the series is known by: the task's title before this edit. */
      seriesTitle: string;
      selected: number[];
      fields: { title: string; type: TaskType; estimated_minutes: number | null };
      today: string;
    }) => {
      const key = seriesKey(args.seriesTitle);

      const { data: templates, error: tErr } = await supabase
        .from('stitchworks_recurring_tasks')
        .select('id, title, weekday, active');
      if (tErr) throw tErr;
      const series = (templates ?? []).filter((t) => seriesKey(t.title) === key);
      const seriesIds = series.map((t) => t.id);

      const [open, inst] = await Promise.all([
        supabase
          .from('stitchworks_tasks')
          .select('id, title, scheduled_date, recurring_task_id')
          .is('completed_at', null)
          .gte('scheduled_date', args.today),
        seriesIds.length
          ? supabase
              .from('stitchworks_tasks')
              .select('id, scheduled_date, completed_at, recurring_task_id')
              .in('recurring_task_id', seriesIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (open.error) throw open.error;
      if (inst.error) throw inst.error;

      const plan = planRecurrence({
        selected: args.selected,
        series,
        task: args.task,
        sameTitleOpen: (open.data ?? []).filter((t) => seriesKey(t.title) === key),
        seriesInstances: inst.data ?? [],
        today: args.today,
      });

      const must = (r: { error: unknown }) => {
        if (r.error) throw r.error;
      };

      if (plan.deleteInstances.length)
        must(await supabase.from('stitchworks_tasks').delete().in('id', plan.deleteInstances));
      if (plan.remove.length)
        must(await supabase.from('stitchworks_recurring_tasks').delete().in('id', plan.remove));
      if (plan.reactivate.length)
        must(
          await supabase
            .from('stitchworks_recurring_tasks')
            .update({ active: true })
            .in('id', plan.reactivate),
        );

      const idByWeekday = new Map(
        series.filter((t) => !plan.remove.includes(t.id)).map((t) => [t.weekday, t.id]),
      );
      if (plan.create.length) {
        const { data: made, error } = await supabase
          .from('stitchworks_recurring_tasks')
          .insert(plan.create.map((weekday) => ({ ...args.fields, weekday, active: true })))
          .select('id, weekday');
        if (error) throw error;
        for (const m of made ?? []) idByWeekday.set(m.weekday, m.id);
      }

      const finalIds = [...idByWeekday.values()];
      // Keep every template in the series matching the edited fields.
      if (finalIds.length)
        must(
          await supabase
            .from('stitchworks_recurring_tasks')
            .update(args.fields)
            .in('id', finalIds),
        );

      for (const l of plan.link) {
        must(
          await supabase
            .from('stitchworks_tasks')
            .update({ recurring_task_id: idByWeekday.get(l.weekday), source: 'recurring' })
            .eq('id', l.taskId),
        );
      }

      if (plan.unlinkCurrent)
        must(
          await supabase
            .from('stitchworks_tasks')
            .update({ recurring_task_id: null, source: 'manual' })
            .eq('id', args.task.id),
        );

      // Future, unfinished copies pick up the edited title/type/minutes.
      if (finalIds.length)
        must(
          await supabase
            .from('stitchworks_tasks')
            .update(args.fields)
            .in('recurring_task_id', finalIds)
            .is('completed_at', null)
            .gte('scheduled_date', args.today),
        );

      return plan;
    },
    onSettled: () => {
      invalidateTasks(qc);
      qc.invalidateQueries({ queryKey: recurringTasksKey });
    },
  });
}
