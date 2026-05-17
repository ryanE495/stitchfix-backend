import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Job, JobStatus, JobWithCustomer } from '../lib/types';
import { jobsQueryKey } from './useJobs';

type JobPatch = Partial<
  Pick<
    Job,
    | 'item_description'
    | 'status'
    | 'date_received'
    | 'date_promised'
    | 'date_completed'
    | 'date_paid'
    | 'quote_amount'
    | 'actual_charged'
    | 'materials_cost'
    | 'hours_worked'
    | 'notes'
    | 'needs_followup'
    | 'followup_by'
    | 'review_requested'
    | 'review_requested_at'
    | 'payment_method'
    | 'category'
    | 'feature_in_portfolio'
    | 'portfolio_title'
    | 'portfolio_slug'
    | 'portfolio_blurb'
    | 'portfolio_location'
    | 'portfolio_published_at'
  >
>;

export function useUpdateJob() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; patch: JobPatch }) => {
      const { data, error } = await supabase
        .from('stitchworks_jobs')
        .update(input.patch)
        .eq('id', input.id)
        .select('*, customer:stitchworks_customers(*)')
        .single();
      if (error) throw error;
      return data as JobWithCustomer;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: jobsQueryKey });
      const prev = qc.getQueryData<JobWithCustomer[]>(jobsQueryKey);
      qc.setQueryData<JobWithCustomer[]>(jobsQueryKey, (old) =>
        (old ?? []).map((j) => (j.id === input.id ? { ...j, ...input.patch } : j)),
      );
      qc.setQueryData<JobWithCustomer | null>(['jobs', input.id], (old) =>
        old ? { ...old, ...input.patch } : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(jobsQueryKey, ctx.prev);
    },
    onSettled: (_d, _e, input) => {
      qc.invalidateQueries({ queryKey: jobsQueryKey });
      qc.invalidateQueries({ queryKey: ['jobs', input.id] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customerJobs'] });
    },
  });
}

type AdvanceJob = Pick<
  Job,
  | 'id'
  | 'status'
  | 'date_received'
  | 'date_completed'
  | 'date_paid'
  | 'quote_amount'
  | 'actual_charged'
>;

export function useAdvanceStatus() {
  const update = useUpdateJob();
  return (job: AdvanceJob, next: JobStatus) => {
    const today = new Date().toISOString().slice(0, 10);
    const patch: JobPatch = { status: next };
    if (next === 'in_shop' && !job.date_received) {
      patch.date_received = today;
    }
    if (next === 'complete_awaiting_pickup' && !job.date_completed) {
      patch.date_completed = today;
    }
    if (next === 'paid_closed') {
      if (!job.date_paid) patch.date_paid = today;
      // Default actual charged to the quoted amount so "Paid this month" picks it up.
      // User can still override via the modal.
      if (job.actual_charged == null && job.quote_amount != null) {
        patch.actual_charged = job.quote_amount;
      }
    }
    return update.mutateAsync({ id: job.id, patch });
  };
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      customer_id: string;
      item_description: string;
      quote_amount?: number | null;
      notes?: string | null;
      category?: Job['category'];
    }) => {
      const { data, error } = await supabase
        .from('stitchworks_jobs')
        .insert({
          customer_id: input.customer_id,
          item_description: input.item_description,
          quote_amount: input.quote_amount ?? null,
          notes: input.notes ?? null,
          category: input.category ?? null,
          status: 'quoted',
        })
        .select('*, customer:stitchworks_customers(*)')
        .single();
      if (error) throw error;
      return data as JobWithCustomer;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: jobsQueryKey });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customerJobs'] });
    },
  });
}
