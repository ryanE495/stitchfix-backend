import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Customer, Job } from '../lib/types';

type CustomerJobSummary = Pick<Job, 'id' | 'status' | 'actual_charged'>;
export type CustomerWithStats = Customer & { jobs: CustomerJobSummary[] };

export const customersQueryKey = ['customers'] as const;

export function useCustomers() {
  return useQuery({
    queryKey: customersQueryKey,
    queryFn: async (): Promise<CustomerWithStats[]> => {
      const { data, error } = await supabase
        .from('stitchworks_customers')
        .select('*, jobs:stitchworks_jobs(id, status, actual_charged)')
        .order('name');
      if (error) throw error;
      return (data ?? []) as CustomerWithStats[];
    },
  });
}

export function useCustomer(id: string | null | undefined) {
  return useQuery({
    queryKey: ['customers', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<Customer | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('stitchworks_customers')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Customer;
    },
  });
}

export function useCustomerJobs(customerId: string | null | undefined) {
  return useQuery({
    queryKey: ['customerJobs', customerId],
    enabled: Boolean(customerId),
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from('stitchworks_jobs')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Job[];
    },
  });
}

export function customerRevenue(c: CustomerWithStats): number {
  let total = 0;
  for (const j of c.jobs) {
    if (j.status === 'paid_closed' && j.actual_charged != null) {
      total += Number(j.actual_charged);
    }
  }
  return total;
}
