import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AdminStats, AdminUser, Paginated, Report, ReportStatus, Role } from '@/lib/types';

export function useAdminStats() {
  return useQuery({
    queryKey: ['mod', 'stats'],
    queryFn: ({ signal }) => api.get<AdminStats>('/admin/stats', undefined, signal),
    staleTime: 60_000,
  });
}

export function useReports(status: ReportStatus) {
  return useInfiniteQuery({
    queryKey: ['mod', 'reports', status],
    queryFn: ({ pageParam, signal }) =>
      api.get<Paginated<Report>>('/reports', { status, page: pageParam }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
}

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, deleteContent }: { id: number; status: 'RESOLVED' | 'DISMISSED'; deleteContent?: boolean }) =>
      api.patch<{ report: Report }>(`/reports/${id}`, { status, ...(deleteContent ? { deleteContent: true } : {}) }),
    onSuccess: (_r, { deleteContent }) => {
      qc.invalidateQueries({ queryKey: ['mod'] });
      if (deleteContent) {
        qc.invalidateQueries({ queryKey: ['feed'] });
        qc.invalidateQueries({ queryKey: ['comments'] });
      }
    },
  });
}

export interface AdminUserFilters {
  q: string;
  role?: Role;
  bannedOnly?: boolean;
}

export function useAdminUsers(filters: AdminUserFilters) {
  return useInfiniteQuery({
    queryKey: ['mod', 'users', filters],
    queryFn: ({ pageParam, signal }) =>
      filters.bannedOnly
        ? api.get<Paginated<AdminUser>>('/admin/bans', { page: pageParam }, signal)
        : api.get<Paginated<AdminUser> & { total: number }>(
            '/admin/users',
            { q: filters.q || undefined, role: filters.role, page: pageParam, limit: 25 },
            signal,
          ),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
}

export function useSetRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: number; role: Role }) => api.patch<{ user: AdminUser }>(`/admin/users/${id}`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mod', 'users'] }),
  });
}

export function useBanUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, days }: { id: number; reason: string; days: number | null }) =>
      api.post<{ user: AdminUser }>(`/admin/users/${id}/ban`, { reason, days }),
    meta: { inlineValidation: true },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mod'] }),
  });
}

export function useUnbanUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del<{ user: AdminUser }>(`/admin/users/${id}/ban`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mod'] }),
  });
}
