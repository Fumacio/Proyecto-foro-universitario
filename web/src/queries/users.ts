import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CommentWithPost, Me, Paginated, UserProfile, UserSummary } from '@/lib/types';
import { resetSessionData } from './auth';

export function useProfile(username: string | undefined) {
  return useQuery({
    queryKey: ['user', username?.toLowerCase()],
    queryFn: ({ signal }) =>
      api.get<{ user: UserProfile }>(`/users/${encodeURIComponent(username ?? '')}`, undefined, signal),
    enabled: !!username,
    select: (d) => d.user,
  });
}

export function useUserComments(username: string) {
  return useInfiniteQuery({
    queryKey: ['user-comments', username.toLowerCase()],
    queryFn: ({ pageParam, signal }) =>
      api.get<Paginated<CommentWithPost>>(
        `/users/${encodeURIComponent(username)}/comments`,
        { page: pageParam, limit: 20 },
        signal,
      ),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
}

export function useFollowList(username: string, kind: 'followers' | 'following', enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['user', username.toLowerCase(), kind],
    queryFn: ({ pageParam, signal }) =>
      api.get<Paginated<UserSummary>>(`/users/${encodeURIComponent(username)}/${kind}`, { page: pageParam }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled,
  });
}

export function useFollow() {
  const qc = useQueryClient();
  type Data = { user: UserProfile };
  return useMutation({
    mutationFn: ({ username, follow }: { username: string; follow: boolean }) =>
      follow
        ? api.post<{ isFollowing: boolean; followerCount: number }>(`/users/${encodeURIComponent(username)}/follow`)
        : api.del<{ isFollowing: boolean; followerCount: number }>(`/users/${encodeURIComponent(username)}/follow`),
    onMutate: ({ username, follow }) => {
      const key = ['user', username.toLowerCase()];
      const prev = qc.getQueryData<Data>(key);
      if (prev) {
        qc.setQueryData<Data>(key, {
          user: {
            ...prev.user,
            isFollowing: follow,
            followerCount: Math.max(0, prev.user.followerCount + (follow ? 1 : -1)),
          },
        });
      }
      return prev;
    },
    onError: (_e, { username }, prev) => {
      if (prev) qc.setQueryData(['user', username.toLowerCase()], prev);
    },
    onSuccess: (res, { username }) => {
      qc.setQueryData<Data>(['user', username.toLowerCase()], (d) => (d ? { user: { ...d.user, ...res } } : d));
      qc.invalidateQueries({ queryKey: ['user', username.toLowerCase(), 'followers'] });
    },
  });
}

function useSetMe() {
  const qc = useQueryClient();
  return (user: Me) => {
    qc.setQueryData(['me'], { user });
    qc.invalidateQueries({ queryKey: ['user', user.username.toLowerCase()] });
  };
}

export function useUpdateProfile() {
  const setMe = useSetMe();
  return useMutation({
    mutationFn: (input: { displayName?: string; bio?: string; career?: string }) =>
      api.patch<{ user: Me }>('/users/me', input),
    meta: { inlineValidation: true },
    onSuccess: ({ user }) => setMe(user),
  });
}

export function useUploadAvatar() {
  const setMe = useSetMe();
  return useMutation({
    mutationFn: (file: File) => api.upload<{ user: Me }>('/users/me/avatar', file),
    onSuccess: ({ user }) => setMe(user),
  });
}

export function useRemoveAvatar() {
  const setMe = useSetMe();
  return useMutation({
    mutationFn: () => api.del<{ user: Me }>('/users/me/avatar'),
    onSuccess: ({ user }) => setMe(user),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => api.del('/users/me', { password }),
    meta: { skipGlobalError: true },
    onSuccess: () => resetSessionData(qc, null),
  });
}
