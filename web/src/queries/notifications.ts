import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { patchMe } from '@/lib/cache';
import type { NotificationsPage } from '@/lib/types';

export function useNotifications(unreadOnly: boolean, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['notifications', 'list', unreadOnly],
    queryFn: ({ pageParam, signal }) =>
      api.get<NotificationsPage>(
        '/notifications',
        { page: pageParam, limit: 20, unread: unreadOnly ? 'true' : undefined },
        signal,
      ),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled,
  });
}

export function useLatestNotifications(enabled: boolean) {
  return useQuery({
    queryKey: ['notifications', 'latest'],
    queryFn: ({ signal }) => api.get<NotificationsPage>('/notifications', { page: 1, limit: 8 }, signal),
    enabled,
    staleTime: 15_000,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: number[]) => api.post<{ unreadCount: number }>('/notifications/read', ids ? { ids } : {}),
    onMutate: (ids) => {
      const mark = <T extends { id: number; read: boolean }>(n: T): T =>
        !ids || ids.includes(n.id) ? { ...n, read: true } : n;
      qc.setQueriesData<InfiniteData<NotificationsPage>>({ queryKey: ['notifications', 'list'] }, (d) =>
        d?.pages ? { ...d, pages: d.pages.map((p) => ({ ...p, items: p.items.map(mark) })) } : d,
      );
      qc.setQueryData<NotificationsPage>(['notifications', 'latest'], (d) =>
        d ? { ...d, items: d.items.map(mark) } : d,
      );
    },
    onSuccess: ({ unreadCount }) => patchMe(qc, { unreadNotifications: unreadCount }),
  });
}
