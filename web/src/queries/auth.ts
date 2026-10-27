import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { loginPath } from '@/lib/navigation';
import { longDate } from '@/lib/time';
import type { Me } from '@/lib/types';

export const meKey = ['me'] as const;

export function useMeQuery() {
  return useQuery({
    queryKey: meKey,
    queryFn: ({ signal }) => api.get<{ user: Me | null }>('/auth/me', undefined, signal),
    staleTime: 60_000,
    retry: false,
  });
}

/** Usuario actual (o null). `isLoading` solo es true en la primera carga. */
export function useMe() {
  const q = useMeQuery();
  return { me: q.data?.user ?? null, isLoading: q.isPending, isError: q.isError };
}

/** Al cambiar de usuario recargamos todo lo que depende de la sesión (myVote, isMember, …). */
export function resetSessionData(qc: QueryClient, user: Me | null) {
  qc.setQueryData(meKey, { user });
  qc.resetQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
}

export function banMessage(ban: NonNullable<Me['ban']>) {
  return ban.expiresAt
    ? `Tu cuenta está suspendida hasta el ${longDate(ban.expiresAt)}.`
    : 'Tu cuenta está suspendida de forma permanente.';
}

/**
 * Para acciones que requieren sesión: si no hay usuario manda al login; si está baneado muestra un toast.
 * Devuelve true si se puede continuar.
 */
export function useRequireUser() {
  const { me } = useMe();
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    (opts?: { allowBanned?: boolean }) => {
      if (!me) {
        navigate(loginPath(location.pathname + location.search));
        return false;
      }
      if (me.ban && !opts?.allowBanned) {
        toast.error(banMessage(me.ban), { description: `Motivo: ${me.ban.reason}` });
        return false;
      }
      return true;
    },
    [me, navigate, location.pathname, location.search],
  );
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { login: string; password: string }) => api.post<{ user: Me }>('/auth/login', input),
    meta: { skipGlobalError: true },
    onSuccess: ({ user }) => resetSessionData(qc, user),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { username: string; email: string; password: string; displayName?: string }) =>
      api.post<{ user: Me }>('/auth/register', input),
    meta: { skipGlobalError: true },
    onSuccess: ({ user }) => resetSessionData(qc, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>('/auth/logout'),
    meta: { skipGlobalError: true },
    onSettled: () => resetSessionData(qc, null),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: { email: string }) => api.post<{ ok: true }>('/auth/forgot-password', input),
    meta: { skipGlobalError: true },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: { token: string; password: string }) => api.post<{ ok: true }>('/auth/reset-password', input),
    meta: { skipGlobalError: true },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      api.post<{ ok: true }>('/auth/change-password', input),
    meta: { skipGlobalError: true },
  });
}
