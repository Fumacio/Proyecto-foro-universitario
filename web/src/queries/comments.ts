import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { findComment, insertComment, patchComment, patchPost } from '@/lib/cache';
import type { Comment, CommentSort, CommentsResponse } from '@/lib/types';

export function useComments(postId: number, sort: CommentSort) {
  return useQuery({
    queryKey: ['comments', postId, sort],
    queryFn: ({ signal }) => api.get<CommentsResponse>(`/posts/${postId}/comments`, { sort }, signal),
    enabled: postId > 0,
  });
}

export function useCreateComment(postId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; parentId?: number | null }) =>
      api.post<{ comment: Comment }>(`/posts/${postId}/comments`, {
        body: input.body,
        ...(input.parentId ? { parentId: input.parentId } : {}),
      }),
    meta: { inlineValidation: true },
    onSuccess: ({ comment }) => {
      insertComment(qc, postId, { ...comment, replies: comment.replies ?? [] });
      patchPost(qc, postId, (p) => ({ commentCount: p.commentCount + 1 }));
    },
  });
}

export function useEditComment(postId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) => api.patch<{ comment: Comment }>(`/comments/${id}`, { body }),
    meta: { inlineValidation: true },
    onSuccess: ({ comment }) =>
      patchComment(qc, postId, comment.id, { body: comment.body, editedAt: comment.editedAt }),
  });
}

export function useDeleteComment(postId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/comments/${id}`),
    onSuccess: (_d, id) => patchComment(qc, postId, id, { isDeleted: true, body: '', author: null }),
  });
}

export function useVoteComment(postId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, value }: { id: number; value: -1 | 0 | 1 }) =>
      api.post<{ score: number; myVote: -1 | 0 | 1 }>(`/comments/${id}/vote`, { value }),
    onMutate: ({ id, value }) => {
      let prev: { score: number; myVote: -1 | 0 | 1 } | undefined;
      for (const [, d] of qc.getQueriesData<CommentsResponse>({ queryKey: ['comments', postId] })) {
        const c = d && findComment(d.items, id);
        if (c) {
          prev = { score: c.score, myVote: c.myVote };
          break;
        }
      }
      if (prev) {
        const base = prev;
        patchComment(qc, postId, id, { myVote: value, score: base.score - base.myVote + value });
      }
      return prev;
    },
    onError: (_e, { id }, prev) => {
      if (prev) patchComment(qc, postId, id, prev);
    },
    onSuccess: (res, { id }) => patchComment(qc, postId, id, res),
  });
}
