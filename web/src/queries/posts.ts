import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { findPost, patchPost, removePostFromCaches } from '@/lib/cache';
import type {
  CreatePostInput,
  Paginated,
  Poll,
  PostDetail,
  PostListItem,
  PostSort,
  PostType,
  TimeRange,
  UpdatePostInput,
} from '@/lib/types';

export interface PostFilters {
  sort?: PostSort;
  t?: TimeRange;
  feed?: 'all' | 'following';
  community?: string;
  tag?: string;
  author?: string;
  type?: PostType;
  unanswered?: boolean;
  q?: string;
}

const PAGE_SIZE = 20;

function nextPage(last: Paginated<unknown>) {
  return last.hasMore ? last.page + 1 : undefined;
}

export function usePostsFeed(filters: PostFilters, opts?: { enabled?: boolean }) {
  return useInfiniteQuery({
    queryKey: ['feed', 'posts', filters],
    queryFn: ({ pageParam, signal }) =>
      api.get<Paginated<PostListItem>>(
        '/posts',
        {
          sort: filters.sort,
          t: filters.sort === 'top' || filters.sort === 'comments' ? filters.t : undefined,
          feed: filters.feed && filters.feed !== 'all' ? filters.feed : undefined,
          community: filters.community,
          tag: filters.tag,
          author: filters.author,
          type: filters.type,
          unanswered: filters.unanswered ? 'true' : undefined,
          q: filters.q,
          page: pageParam,
          limit: PAGE_SIZE,
        },
        signal,
      ),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled: opts?.enabled ?? true,
  });
}

export function useUserPosts(username: string, sort: 'new' | 'top') {
  return useInfiniteQuery({
    queryKey: ['feed', 'user-posts', username.toLowerCase(), sort],
    queryFn: ({ pageParam, signal }) =>
      api.get<Paginated<PostListItem>>(
        `/users/${encodeURIComponent(username)}/posts`,
        { page: pageParam, limit: PAGE_SIZE, sort },
        signal,
      ),
    initialPageParam: 1,
    getNextPageParam: nextPage,
  });
}

export function useBookmarks(enabled = true) {
  return useInfiniteQuery({
    queryKey: ['feed', 'bookmarks'],
    queryFn: ({ pageParam, signal }) =>
      api.get<Paginated<PostListItem>>('/users/me/bookmarks', { page: pageParam, limit: PAGE_SIZE }, signal),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled,
  });
}

export function usePost(id: number) {
  return useQuery({
    queryKey: ['post', id],
    queryFn: ({ signal }) => api.get<{ post: PostDetail }>(`/posts/${id}`, undefined, signal),
    enabled: Number.isFinite(id) && id > 0,
    staleTime: 2 * 60_000,
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePostInput) => api.post<{ post: PostDetail }>('/posts', input),
    meta: { inlineValidation: true },
    onSuccess: ({ post }) => {
      qc.setQueryData(['post', post.id], { post });
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['community', post.community.slug] });
    },
  });
}

export function useUpdatePost(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePostInput) => api.patch<{ post: PostDetail }>(`/posts/${id}`, input),
    meta: { inlineValidation: true },
    onSuccess: ({ post }) => {
      qc.setQueryData(['post', id], { post });
      patchPost(qc, id, {
        title: post.title,
        excerpt: post.excerpt,
        tags: post.tags,
        imageUrl: post.imageUrl,
        editedAt: post.editedAt,
      });
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/posts/${id}`),
    onSuccess: (_d, id) => {
      removePostFromCaches(qc, id);
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

/** Voto optimista: se aplica en todas las listas donde aparece el post. */
export function useVotePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, value }: { id: number; value: -1 | 0 | 1 }) =>
      api.post<{ score: number; myVote: -1 | 0 | 1 }>(`/posts/${id}/vote`, { value }),
    onMutate: ({ id, value }) => {
      const current = findPost(qc, id);
      if (!current) return undefined;
      const prev = { score: current.score, myVote: current.myVote };
      patchPost(qc, id, { myVote: value, score: current.score - current.myVote + value });
      return prev;
    },
    onError: (_e, { id }, prev) => {
      if (prev) patchPost(qc, id, prev);
    },
    onSuccess: (res, { id }) => patchPost(qc, id, res),
  });
}

export function useBookmarkPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, bookmarked }: { id: number; bookmarked: boolean }) =>
      bookmarked
        ? api.post<{ isBookmarked: boolean }>(`/posts/${id}/bookmark`)
        : api.del<{ isBookmarked: boolean }>(`/posts/${id}/bookmark`),
    onMutate: ({ id, bookmarked }) => {
      patchPost(qc, id, { isBookmarked: bookmarked });
    },
    onError: (_e, { id, bookmarked }) => patchPost(qc, id, { isBookmarked: !bookmarked }),
    onSuccess: (res, { id }) => {
      patchPost(qc, id, { isBookmarked: res?.isBookmarked ?? false });
      qc.invalidateQueries({ queryKey: ['feed', 'bookmarks'], refetchType: 'none' });
    },
  });
}

export function usePinPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pinned }: { id: number; pinned: boolean }) =>
      api.post<{ isPinned: boolean }>(`/posts/${id}/pin`, { pinned }),
    onSuccess: (res, { id }) => {
      patchPost(qc, id, { isPinned: res.isPinned });
      qc.invalidateQueries({ queryKey: ['feed'], refetchType: 'none' });
    },
  });
}

export function useLockPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, locked }: { id: number; locked: boolean }) =>
      api.post<{ isLocked: boolean }>(`/posts/${id}/lock`, { locked }),
    onSuccess: (res, { id }) => patchPost(qc, id, { isLocked: res.isLocked }),
  });
}

export function useAcceptAnswer(postId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: number | null) =>
      api.post<{ acceptedCommentId: number | null }>(`/posts/${postId}/accept`, { commentId }),
    onSuccess: (res) => {
      patchPost(qc, postId, { acceptedCommentId: res.acceptedCommentId });
      qc.invalidateQueries({ queryKey: ['comments', postId] });
    },
  });
}

export function usePollVote(postId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (optionId: number) => api.post<{ poll: Poll }>(`/posts/${postId}/poll/vote`, { optionId }),
    onMutate: (optionId) => {
      const current = findPost(qc, postId)?.poll;
      if (!current) return undefined;
      const had = current.myOptionId;
      const options = current.options.map((o) => ({
        ...o,
        votes: o.votes + (o.id === optionId ? 1 : 0) - (o.id === had ? 1 : 0),
      }));
      patchPost(qc, postId, {
        poll: { ...current, options, myOptionId: optionId, totalVotes: current.totalVotes + (had == null ? 1 : 0) },
      });
      return current;
    },
    onError: (_e, _v, prev) => {
      if (prev) patchPost(qc, postId, { poll: prev });
    },
    onSuccess: ({ poll }) => patchPost(qc, postId, { poll }),
  });
}
