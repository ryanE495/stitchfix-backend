import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PHOTOS_BUCKET, supabase } from '../lib/supabase';
import { compressImage } from '../lib/imageCompress';
import type { JobPhoto, PhotoCategory } from '../lib/types';

export function useJobPhotos(jobId: string | null | undefined) {
  return useQuery({
    queryKey: ['jobPhotos', jobId],
    enabled: Boolean(jobId),
    queryFn: async (): Promise<JobPhoto[]> => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from('stitchworks_job_photos')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as JobPhoto[];
    },
  });
}

export function useUploadJobPhoto(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { file: File; category: PhotoCategory }) => {
      const blob = await compressImage(input.file);
      const path = `${jobId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error: upErr } = await supabase.storage
        .from(PHOTOS_BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path);
      const { data, error } = await supabase
        .from('stitchworks_job_photos')
        .insert({
          job_id: jobId,
          photo_url: pub.publicUrl,
          storage_path: path,
          category: input.category,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as JobPhoto;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['jobPhotos', jobId] });
    },
  });
}

export function useUpdatePhotoCategory(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; category: PhotoCategory }) => {
      const { data, error } = await supabase
        .from('stitchworks_job_photos')
        .update({ category: input.category })
        .eq('id', input.id)
        .select('*')
        .single();
      if (error) throw error;
      return data as JobPhoto;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ['jobPhotos', jobId] });
      const prev = qc.getQueryData<JobPhoto[]>(['jobPhotos', jobId]);
      qc.setQueryData<JobPhoto[]>(['jobPhotos', jobId], (old) =>
        (old ?? []).map((p) => (p.id === input.id ? { ...p, category: input.category } : p)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['jobPhotos', jobId], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['jobPhotos', jobId] });
    },
  });
}

export function useDeleteJobPhoto(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photo: JobPhoto) => {
      if (photo.storage_path) {
        await supabase.storage.from(PHOTOS_BUCKET).remove([photo.storage_path]);
      }
      const { error } = await supabase
        .from('stitchworks_job_photos')
        .delete()
        .eq('id', photo.id);
      if (error) throw error;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['jobPhotos', jobId] });
    },
  });
}
