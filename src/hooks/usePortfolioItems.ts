import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PORTFOLIO_IMAGES_BUCKET, supabase } from '../lib/supabase';
import { compressImage } from '../lib/imageCompress';
import type { PortfolioItem } from '../lib/types';

export const portfolioItemsKey = ['portfolioItems'] as const;

export function usePortfolioItems() {
  return useQuery({
    queryKey: portfolioItemsKey,
    queryFn: async (): Promise<PortfolioItem[]> => {
      const { data, error } = await supabase
        .from('stitchworks_portfolio_items')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PortfolioItem[];
    },
  });
}

type PortfolioInput = Partial<
  Pick<
    PortfolioItem,
    | 'title'
    | 'category'
    | 'description'
    | 'materials_techniques'
    | 'approach'
    | 'challenge'
    | 'detail_1_label'
    | 'detail_1_value'
    | 'detail_2_label'
    | 'detail_2_value'
    | 'detail_3_label'
    | 'detail_3_value'
    | 'before_image_url'
    | 'after_image_url'
    | 'before_storage_path'
    | 'after_storage_path'
    | 'display_order'
    | 'status'
  >
>;

export function useCreatePortfolioItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PortfolioInput): Promise<PortfolioItem> => {
      const { data, error } = await supabase
        .from('stitchworks_portfolio_items')
        .insert(input)
        .select('*')
        .single();
      if (error) throw error;
      return data as PortfolioItem;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: portfolioItemsKey }),
  });
}

export function useUpdatePortfolioItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: PortfolioInput }): Promise<PortfolioItem> => {
      const { data, error } = await supabase
        .from('stitchworks_portfolio_items')
        .update(input.patch)
        .eq('id', input.id)
        .select('*')
        .single();
      if (error) throw error;
      return data as PortfolioItem;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: portfolioItemsKey }),
  });
}

export function useDeletePortfolioItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: PortfolioItem) => {
      const paths = [item.before_storage_path, item.after_storage_path].filter(
        (p): p is string => Boolean(p),
      );
      if (paths.length > 0) {
        await supabase.storage.from(PORTFOLIO_IMAGES_BUCKET).remove(paths);
      }
      const { error } = await supabase
        .from('stitchworks_portfolio_items')
        .delete()
        .eq('id', item.id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: portfolioItemsKey }),
  });
}

export async function uploadPortfolioImage(
  file: File,
  kind: 'before' | 'after',
): Promise<{ url: string; path: string }> {
  const blob = await compressImage(file, 2000, 0.85);
  const path = `${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage
    .from(PORTFOLIO_IMAGES_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(PORTFOLIO_IMAGES_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function deletePortfolioImage(path: string | null): Promise<void> {
  if (!path) return;
  await supabase.storage.from(PORTFOLIO_IMAGES_BUCKET).remove([path]);
}
