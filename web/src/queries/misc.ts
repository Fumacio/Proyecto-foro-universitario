import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PublicStats, ReportReason, SearchResult } from '@/lib/types';

export function useSearch(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: ['search', term.toLowerCase()],
    queryFn: ({ signal }) => api.get<SearchResult>('/search', { q: term }, signal),
    enabled: term.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function usePublicStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: ({ signal }) => api.get<PublicStats>('/stats', undefined, signal),
    staleTime: 5 * 60_000,
  });
}

export function useUploadImage() {
  return useMutation({
    mutationFn: (file: File | Blob) => api.upload<{ url: string }>('/uploads/image', file),
    meta: { skipGlobalError: true },
  });
}

export function useCreateReport() {
  return useMutation({
    mutationFn: (input: { postId?: number; commentId?: number; reason: ReportReason; details?: string }) =>
      api.post<{ ok: true }>('/reports', input),
  });
}
