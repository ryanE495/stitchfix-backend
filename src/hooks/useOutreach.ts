import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { noonLocalIso } from '../lib/dates';
import { planLastPostedEdit, type LastPostedEdit } from '../lib/outreachRules';
import type {
  FbGroup,
  FbGroupPost,
  FbRotation,
  PostTemplate,
} from '../lib/types';

export const fbGroupsKey = ['fbGroups'] as const;
export const fbPostsKey = ['fbGroupPosts'] as const;
export const templatesKey = ['postTemplates'] as const;

export function useFbGroups() {
  return useQuery({
    queryKey: fbGroupsKey,
    queryFn: async (): Promise<FbGroup[]> => {
      const { data, error } = await supabase
        .from('stitchworks_fb_groups')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FbGroup[];
    },
  });
}

/**
 * Every post ever. The table is one row per post by one operator, so the
 * whole history is small enough to hold client-side and compute stats from
 * without a round trip per group.
 */
export function useFbGroupPosts() {
  return useQuery({
    queryKey: fbPostsKey,
    queryFn: async (): Promise<FbGroupPost[]> => {
      const { data, error } = await supabase
        .from('stitchworks_fb_group_posts')
        .select('*')
        .order('posted_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as FbGroupPost[];
    },
  });
}

export function usePostTemplates() {
  return useQuery({
    queryKey: templatesKey,
    queryFn: async (): Promise<PostTemplate[]> => {
      const { data, error } = await supabase
        .from('stitchworks_post_templates')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PostTemplate[];
    },
  });
}

export function useUpdateFbGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; patch: Partial<FbGroup> }) => {
      const { error } = await supabase
        .from('stitchworks_fb_groups')
        .update(args.patch)
        .eq('id', args.id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: fbGroupsKey }),
  });
}

/** Bulk rotation reassignment, used by auto-balance. */
export function useSetRotations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignments: { id: string; rotation: FbRotation }[]) => {
      // One statement per group; PostgREST has no "update many rows to
      // different values" primitive short of an RPC.
      for (const a of assignments) {
        const { error } = await supabase
          .from('stitchworks_fb_groups')
          .update({ rotation: a.rotation })
          .eq('id', a.id);
        if (error) throw error;
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: fbGroupsKey }),
  });
}

export function useLogFbPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      group_id: string;
      template_id?: string | null;
      notes?: string | null;
    }) => {
      const { error } = await supabase.from('stitchworks_fb_group_posts').insert({
        group_id: input.group_id,
        template_id: input.template_id ?? null,
        notes: input.notes ?? null,
      });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: fbPostsKey }),
  });
}

export function useDeleteFbPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('stitchworks_fb_group_posts')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: fbPostsKey }),
  });
}

export function useUpsertTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<PostTemplate> & { name: string; body: string }) => {
      const { error } = input.id
        ? await supabase
            .from('stitchworks_post_templates')
            .update(input)
            .eq('id', input.id)
        : await supabase.from('stitchworks_post_templates').insert(input);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: templatesKey }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('stitchworks_post_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: templatesKey }),
  });
}

/** Set a group's "last posted" day from the Groups page date picker.
 *  The decision lives in planLastPostedEdit() so it can be tested. */
export function useSetLastPosted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      groupId: string;
      day: string; // YYYY-MM-DD, local
      groupPosts: FbGroupPost[];
    }): Promise<LastPostedEdit['kind']> => {
      const plan = planLastPostedEdit(args.groupPosts, args.day);

      if (plan.kind === 'log') {
        const { error } = await supabase.from('stitchworks_fb_group_posts').insert({
          group_id: args.groupId,
          posted_at: noonLocalIso(args.day),
          notes: 'Logged from the Groups page',
        });
        if (error) throw error;
      } else if (plan.kind === 'correct') {
        const { error } = await supabase
          .from('stitchworks_fb_group_posts')
          .update({ posted_at: noonLocalIso(args.day) })
          .eq('id', plan.postId);
        if (error) throw error;
      } else if (plan.kind === 'blocked') {
        throw new Error(
          `There's another post on ${plan.blockerDay}, after the date you picked. ` +
            'Correcting only the latest post would still leave that one showing.',
        );
      }
      return plan.kind;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: fbPostsKey }),
  });
}
