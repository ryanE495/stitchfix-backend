import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { REPAIR_PHOTOS_BUCKET, supabase } from '../lib/supabase';
import type { RepairPhoto, RepairRequest } from '../lib/types';

export const repairRequestsKey = ['repairRequests'] as const;
export const repairPhotosKey = (requestId: string) =>
  ['repairPhotos', requestId] as const;

export function useRepairRequests() {
  return useQuery({
    queryKey: repairRequestsKey,
    queryFn: async (): Promise<RepairRequest[]> => {
      const { data, error } = await supabase
        .from('repair_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as RepairRequest[];
    },
  });
}

/**
 * Everything the form is allowed to write. The omitted columns are all
 * server-owned:
 *  - id / created_at    — DB defaults
 *  - request_number     — assigned by the BEFORE INSERT trigger
 *                         private.assign_repair_request_number(), which
 *                         overwrites anything a client sends. Do not set it.
 *  - raw_payload        — the untouched original submission; never rewritten
 */
export type RepairRequestInput = Partial<
  Omit<RepairRequest, 'id' | 'created_at' | 'request_number' | 'raw_payload'>
>;

export function useCreateRepairRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RepairRequestInput): Promise<RepairRequest> => {
      const { data, error } = await supabase
        .from('repair_requests')
        .insert({
          // raw_payload is NOT NULL; mark hand-entered rows so they are
          // distinguishable from real intake-form submissions later.
          raw_payload: { source: 'admin_app', created_by_hand: true },
          ...input,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as RepairRequest;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: repairRequestsKey }),
  });
}

export function useUpdateRepairRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      patch: RepairRequestInput;
    }): Promise<RepairRequest> => {
      const { data, error } = await supabase
        .from('repair_requests')
        .update(args.patch)
        .eq('id', args.id)
        .select('*')
        .single();
      if (error) throw error;
      return data as RepairRequest;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: repairRequestsKey }),
  });
}

export function useDeleteRepairRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (request: RepairRequest) => {
      // repair_photos rows cascade on delete, but the storage objects do not —
      // remove those first or they are orphaned in the bucket forever.
      const { data: photos } = await supabase
        .from('repair_photos')
        .select('storage_path')
        .eq('request_id', request.id);

      const paths = (photos ?? [])
        .map((p) => (p as { storage_path: string }).storage_path)
        .filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage.from(REPAIR_PHOTOS_BUCKET).remove(paths);
      }

      const { error } = await supabase
        .from('repair_requests')
        .delete()
        .eq('id', request.id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: repairRequestsKey }),
  });
}

/**
 * Photos for one request, each resolved to a signed URL. The bucket is
 * private, so getPublicUrl() would hand back a 400-ing link.
 */
export function useRepairPhotos(requestId: string | null) {
  return useQuery({
    queryKey: repairPhotosKey(requestId ?? 'none'),
    enabled: Boolean(requestId),
    queryFn: async (): Promise<(RepairPhoto & { signedUrl: string | null })[]> => {
      const { data, error } = await supabase
        .from('repair_photos')
        .select('*')
        .eq('request_id', requestId as string)
        .order('slot', { ascending: true });
      if (error) throw error;

      const rows = (data ?? []) as RepairPhoto[];
      return Promise.all(
        rows.map(async (row) => {
          const { data: signed } = await supabase.storage
            .from(REPAIR_PHOTOS_BUCKET)
            .createSignedUrl(row.storage_path, 60 * 60);
          return { ...row, signedUrl: signed?.signedUrl ?? null };
        }),
      );
    },
  });
}

export function useDeleteRepairPhoto(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photo: RepairPhoto) => {
      await supabase.storage.from(REPAIR_PHOTOS_BUCKET).remove([photo.storage_path]);
      const { error } = await supabase
        .from('repair_photos')
        .delete()
        .eq('id', photo.id);
      if (error) throw error;
    },
    onSettled: () =>
      qc.invalidateQueries({ queryKey: repairPhotosKey(requestId) }),
  });
}
