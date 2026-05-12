import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { ContactSource, Customer } from '../lib/types';
import { customersQueryKey } from './useCustomers';

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      phone: string | null;
      contact_source: ContactSource;
      contact_handle?: string | null;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('stitchworks_customers')
        .insert({
          name: input.name,
          phone: input.phone,
          contact_source: input.contact_source,
          contact_handle: input.contact_handle ?? null,
          notes: input.notes ?? null,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as Customer;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: customersQueryKey });
    },
  });
}

type CustomerPatch = Partial<
  Pick<Customer, 'name' | 'phone' | 'contact_source' | 'contact_handle' | 'notes'>
>;

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: CustomerPatch }) => {
      const { data, error } = await supabase
        .from('stitchworks_customers')
        .update(input.patch)
        .eq('id', input.id)
        .select('*')
        .single();
      if (error) throw error;
      return data as Customer;
    },
    onSettled: (_d, _e, input) => {
      qc.invalidateQueries({ queryKey: customersQueryKey });
      qc.invalidateQueries({ queryKey: ['customers', input.id] });
    },
  });
}
