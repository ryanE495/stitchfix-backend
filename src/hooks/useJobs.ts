import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { JobWithCustomer } from '../lib/types';

export const jobsQueryKey = ['jobs'] as const;

export function useJobs() {
  return useQuery({
    queryKey: jobsQueryKey,
    queryFn: async (): Promise<JobWithCustomer[]> => {
      const { data, error } = await supabase
        .from('stitchworks_jobs')
        .select('*, customer:stitchworks_customers(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as JobWithCustomer[];
    },
  });
}

export function useJob(id: string | null | undefined) {
  return useQuery({
    queryKey: ['jobs', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<JobWithCustomer | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('stitchworks_jobs')
        .select('*, customer:stitchworks_customers(*)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as JobWithCustomer;
    },
  });
}
