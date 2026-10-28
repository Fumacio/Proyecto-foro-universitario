import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
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

/** Guardado instantáneo y optimista; si falla se revierte (el toast lo muestra el handler global). */
export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Preferences>) => api.patch<{ preferences: Preferences }>('/users/me/preferences', patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: preferencesKey });
      const prev = qc.getQueryData<{ preferences: Preferences }>(preferencesKey);
      const base = prev?.preferences ?? DEFAULT_PREFERENCES;
      qc.setQueryData(preferencesKey, { preferences: { ...base, ...patch } });
      return prev;
    },
    onError: (_e, _patch, prev) => {
      if (prev) qc.setQueryData(preferencesKey, prev);
    },
    onSuccess: ({ preferences }) => {
      if (!preferences) return;
      qc.setQueryData(preferencesKey, { preferences });
      patchMe(qc, { preferences });
    },
  });
}
