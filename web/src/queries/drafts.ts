import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { patchMe } from '@/lib/cache';
import type { Draft, DraftInput } from '@/lib/types';

export const draftsKey = ['drafts'] as const;

export function useDrafts(enabled = true) {
  return useQuery({
    queryKey: draftsKey,
    queryFn: ({ signal }) => api.get<{ items: Draft[] }>('/drafts', undefined, signal),
    enabled,
    select: (d) => d.items ?? [],
  });
}

export function useDraft(id: number | null) {
  return useQuery({
    queryKey: ['draft', id],
    queryFn: ({ signal }) => api.get<{ draft: Draft }>(`/drafts/${id}`, undefined, signal),
    enabled: id != null && id > 0,
    staleTime: Infinity,
    gcTime: 0,
    select: (d) => d.draft,
  });
}

/** Refleja un borrador guardado en la lista (sin refetch). */
export function upsertDraftInCache(qc: QueryClient, draft: Draft) {
  qc.setQueryData<{ items: Draft[] }>(draftsKey, (d) =>
    d ? { items: [draft, ...d.items.filter((x) => x.id !== draft.id)] } : d,
  );
}

export function removeDraftFromCache(qc: QueryClient, id: number) {
  qc.setQueryData<{ items: Draft[] }>(draftsKey, (d) => (d ? { items: d.items.filter((x) => x.id !== id) } : d));
  qc.removeQueries({ queryKey: ['draft', id] });
  patchMe(qc, (m) => ({ draftCount: Math.max(0, (m.draftCount ?? 1) - 1) }));
}

/** Crear/actualizar borrador (autoguardado). Errores silenciosos: el editor muestra el estado. */
export function useSaveDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number | null; input: DraftInput }) =>
      id ? api.patch<{ draft: Draft }>(`/drafts/${id}`, input) : api.post<{ draft: Draft }>('/drafts', input),
    meta: { skipGlobalError: true },
    onSuccess: ({ draft }, { id }) => {
      if (!id) {
        patchMe(qc, (m) => ({ draftCount: (m.draftCount ?? 0) + 1 }));
        qc.invalidateQueries({ queryKey: draftsKey, refetchType: 'none' });
      }
      upsertDraftInCache(qc, draft);
    },
  });
}

export function useDeleteDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/drafts/${id}`),
    onSuccess: (_d, id) => removeDraftFromCache(qc, id),
  });
}
