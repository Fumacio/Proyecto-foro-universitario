import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { isApiError } from './api';
import { loginPath, navigateTo } from './navigation';
import type { Me } from './types';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** El componente muestra todos los errores (p. ej. formularios de login). */
      skipGlobalError?: boolean;
      /** El componente muestra los errores de validación (400) en línea. */
      inlineValidation?: boolean;
    };
  }
}

let lastAuthToast = 0;

function handleUnauthorized(client: QueryClient) {
  const hadUser = !!client.getQueryData<{ user: Me | null }>(['me'])?.user;
  client.setQueryData(['me'], { user: null });
  const now = Date.now();
  if (now - lastAuthToast > 3000) {
    lastAuthToast = now;
    toast.error(hadUser ? 'Tu sesión expiró. Iniciá sesión para continuar.' : 'Iniciá sesión para continuar.');
  }
  navigateTo(loginPath());
}

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Una sesión vencida en una consulta privada: refrescamos `me` (RequireAuth redirige).
      if (isApiError(error) && error.status === 401 && query.queryKey[0] !== 'me') {
        queryClient.invalidateQueries({ queryKey: ['me'] });
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      const meta = mutation.meta;
      if (meta?.skipGlobalError) return;
      if (isApiError(error)) {
        if (error.status === 401) return handleUnauthorized(queryClient);
        if (error.code === 'BANNED') {
          toast.error('Tu cuenta está suspendida: no podés realizar esta acción.');
          queryClient.invalidateQueries({ queryKey: ['me'] });
          return;
        }
        if (error.status === 400 && meta?.inlineValidation) return;
        toast.error(error.message);
        return;
      }
      toast.error('Algo salió mal. Probá de nuevo.');
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => {
        if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
        return count < 1;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
