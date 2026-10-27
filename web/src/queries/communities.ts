import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { patchCommunity } from '@/lib/cache';
import type { Community, CommunityInput, Tag } from '@/lib/types';

export function useCommunities() {
  return useQuery({
    queryKey: ['communities', 'all'],
    queryFn: ({ signal }) => api.get<{ items: Community[] }>('/communities', undefined, signal),
    staleTime: 2 * 60_000,
    select: (d) => d.items,
  });
}

export function useJoinedCommunities(enabled: boolean) {
  return useQuery({
    queryKey: ['communities', 'joined'],
    queryFn: ({ signal }) => api.get<{ items: Community[] }>('/communities', { joined: 'true' }, signal),
    enabled,
    staleTime: 2 * 60_000,
    select: (d) => d.items,
  });
}

export function useCommunity(slug: string | undefined) {
  return useQuery({
    queryKey: ['community', slug],
    queryFn: ({ signal }) => api.get<{ community: Community }>(`/communities/${slug}`, undefined, signal),
    enabled: !!slug,
    select: (d) => d.community,
  });
}

export function useJoinCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, join }: { slug: string; join: boolean; memberCount: number }) =>
      join
        ? api.post<{ isMember: boolean; memberCount: number }>(`/communities/${slug}/join`)
        : api.del<{ isMember: boolean; memberCount: number }>(`/communities/${slug}/join`),
    onMutate: ({ slug, join, memberCount }) => {
      patchCommunity(qc, slug, { isMember: join, memberCount: Math.max(0, memberCount + (join ? 1 : -1)) });
    },
    onError: (_e, { slug, join, memberCount }) => patchCommunity(qc, slug, { isMember: !join, memberCount }),
    onSuccess: (res, { slug }) => {
      patchCommunity(qc, slug, res);
      qc.invalidateQueries({ queryKey: ['communities', 'joined'] });
      qc.invalidateQueries({ queryKey: ['feed', 'posts'], refetchType: 'none' });
    },
  });
}

export function useSaveCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, input }: { slug?: string; input: CommunityInput }) =>
      slug
        ? api.patch<{ community: Community }>(`/communities/${slug}`, {
            name: input.name,
            description: input.description,
            icon: input.icon,
            color: input.color,
            rules: input.rules,
          })
        : api.post<{ community: Community }>('/communities', input),
    meta: { inlineValidation: true },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communities'] });
      qc.invalidateQueries({ queryKey: ['community'] });
    },
  });
}

export function useDeleteCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => api.del(`/communities/${slug}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['communities'] });
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

/* ---------------- Etiquetas ---------------- */

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: ({ signal }) => api.get<{ items: Tag[] }>('/tags', undefined, signal),
    staleTime: 5 * 60_000,
    select: (d) => d.items,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color: string }) => api.post<{ tag: Tag }>('/tags', input),
    meta: { inlineValidation: true },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/tags/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
}
