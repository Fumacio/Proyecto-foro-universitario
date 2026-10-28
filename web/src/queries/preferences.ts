import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, isApiError } from '@/lib/api';
import { patchMe } from '@/lib/cache';
import type { Preferences } from '@/lib/types';

export const preferencesKey = ['preferences'] as const;

export const DEFAULT_PREFERENCES: Preferences = {
  emailReplies: true,
  emailMentions: true,
  emailMessages: true,
  emailFollows: false,
  emailReactions: false,
};

export function usePreferences(initial?: Preferences) {
  return useQuery({
    queryKey: preferencesKey,
    queryFn: ({ signal }) => api.get<{ preferences: Preferences }>('/users/me/preferences', undefined, signal),
    select: (d) => ({ ...DEFAULT_PREFERENCES, ...d.preferences }),
    placeholderData: initial ? { preferences: initial } : undefined,
  });
}

/** Guardado instantáneo y optimista; si falla se revierte y avisa con un toast. */
export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Preferences>) => api.patch<{ preferences: Preferences }>('/users/me/preferences', patch),
    meta: { skipGlobalError: true },
    onMutate: (patch) => {
      // Sincrónico: el switch cambia en el mismo frame del click.
      void qc.cancelQueries({ queryKey: preferencesKey });
      const prev = qc.getQueryData<{ preferences: Preferences }>(preferencesKey);
      const base = prev?.preferences ?? DEFAULT_PREFERENCES;
      qc.setQueryData(preferencesKey, { preferences: { ...base, ...patch } });
      return prev;
    },
    onError: (err, _patch, prev) => {
      if (prev) qc.setQueryData(preferencesKey, prev);
      if (isApiError(err) && err.status === 401) {
        qc.invalidateQueries({ queryKey: ['me'] });
        return;
      }
      toast.error('No se pudo guardar la preferencia', {
        id: 'pref-error',
        description: isApiError(err) && err.code === 'NETWORK' ? err.message : 'Volvimos al valor anterior. Probá de nuevo.',
      });
    },
    onSuccess: ({ preferences }) => {
      if (!preferences) return;
      qc.setQueryData(preferencesKey, { preferences });
      patchMe(qc, { preferences });
    },
  });
}
