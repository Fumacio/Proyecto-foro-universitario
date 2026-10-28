import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { findComment, findPost, patchComment, patchPost } from '@/lib/cache';
import { REACTIONS, type CommentsResponse, type ReactionEmoji, type ReactionSummary, type UserSummary } from '@/lib/types';

export type ReactionTarget = { type: 'post'; id: number } | { type: 'comment'; id: number; postId: number };

const ORDER = new Map<string, number>(REACTIONS.map((e, i) => [e, i]));

/** Aplica el toggle localmente (misma semántica que el server). */
export function toggleReactionList(list: ReactionSummary[] | undefined, emoji: ReactionEmoji): ReactionSummary[] {
  const current = list ?? [];
  const found = current.find((r) => r.emoji === emoji);
  let next: ReactionSummary[];
  if (!found) next = [...current, { emoji, count: 1, reacted: true }];
  else if (found.reacted) next = current.map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, reacted: false } : r));
  else next = current.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r));
  return next.filter((r) => r.count > 0).sort((a, b) => (ORDER.get(a.emoji) ?? 99) - (ORDER.get(b.emoji) ?? 99));
}

function readReactions(qc: QueryClient, target: ReactionTarget): ReactionSummary[] | undefined {
  if (target.type === 'post') return findPost(qc, target.id)?.reactions ?? [];
  for (const [, d] of qc.getQueriesData<CommentsResponse>({ queryKey: ['comments', target.postId] })) {
    const c = d && findComment(d.items, target.id);
    if (c) return c.reactions ?? [];
  }
  return undefined;
}

function writeReactions(qc: QueryClient, target: ReactionTarget, reactions: ReactionSummary[]) {
  if (target.type === 'post') patchPost(qc, target.id, { reactions });
  else patchComment(qc, target.postId, target.id, { reactions });
}

const basePath = (t: ReactionTarget) => (t.type === 'post' ? `/posts/${t.id}` : `/comments/${t.id}`);

/** Toggles en vuelo por contenido: solo la última respuesta pisa el estado optimista (sin parpadeos). */
const pending = new Map<string, number>();
const targetKey = (t: ReactionTarget) => `${t.type}:${t.id}`;

/** Toggle optimista: se refleja en el feed, el detalle, la búsqueda y el árbol de comentarios. */
export function useToggleReaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ target, emoji }: { target: ReactionTarget; emoji: ReactionEmoji }) =>
      api.post<{ reactions: ReactionSummary[] }>(`${basePath(target)}/reactions`, { emoji }),
    onMutate: ({ target, emoji }) => {
      pending.set(targetKey(target), (pending.get(targetKey(target)) ?? 0) + 1);
      const prev = readReactions(qc, target);
      if (prev) writeReactions(qc, target, toggleReactionList(prev, emoji));
      return prev;
    },
    onError: (_e, { target, emoji }) => {
      // Deshacer solo este toggle (otros pueden seguir en vuelo).
      const current = readReactions(qc, target);
      if (current) writeReactions(qc, target, toggleReactionList(current, emoji));
    },
    onSuccess: ({ reactions }, { target }) => {
      if (Array.isArray(reactions) && (pending.get(targetKey(target)) ?? 0) <= 1) writeReactions(qc, target, reactions);
      qc.invalidateQueries({ queryKey: ['reaction-users', target.type, target.id] });
    },
    onSettled: (_d, _e, { target }) => {
      const k = targetKey(target);
      const n = (pending.get(k) ?? 1) - 1;
      if (n <= 0) pending.delete(k);
      else pending.set(k, n);
    },
  });
}

/** Quién reaccionó con un emoji (para el tooltip). Se pide recién al abrirlo. */
export function useReactionUsers(target: ReactionTarget, emoji: ReactionEmoji, enabled: boolean) {
  return useQuery({
    queryKey: ['reaction-users', target.type, target.id, emoji],
    queryFn: ({ signal }) => api.get<{ items: UserSummary[] }>(`${basePath(target)}/reactions/users`, { emoji }, signal),
    enabled,
    staleTime: 30_000,
    select: (d) => d.items ?? [],
  });
}
