import { Component, type ErrorInfo, type ReactNode } from 'react';
import { House, RefreshCw, ShieldAlert, TriangleAlert } from 'lucide-react';
import { Link, Navigate, isRouteErrorResponse, useLocation, useRouteError } from 'react-router';
import { loginPath } from '@/lib/navigation';
import { isStaff } from '@/lib/utils';
import { useMe } from '@/queries/auth';
import { Button, buttonVariants } from './ui/Button';
import { EmptyState } from './ui/misc';
import { PageSpinner } from './ui/Spinner';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { me, isLoading } = useMe();
  const location = useLocation();
  if (isLoading) return <PageSpinner />;
  if (!me) return <Navigate to={loginPath(location.pathname + location.search)} replace />;
  return <>{children}</>;
}

export function RequireStaff({ children }: { children: ReactNode }) {
  const { me, isLoading } = useMe();
  const location = useLocation();
  if (isLoading) return <PageSpinner />;
  if (!me) return <Navigate to={loginPath(location.pathname + location.search)} replace />;
  if (!isStaff(me.role)) {
    return (
      <div className="surface">
        <EmptyState
          icon={ShieldAlert}
          tone="amber"
          title="Sin permisos"
          description="Esta sección es solo para el equipo de moderación."
          action={
            <Link to="/" className={buttonVariants({ variant: 'secondary' })}>
              Volver al inicio
            </Link>
          }
        />
      </div>
    );
  }
  return <>{children}</>;
}

function isChunkError(error: unknown) {
  return error instanceof Error && /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(error.message);
}

export function ErrorScreen({ error, onRetry, fullPage }: { error: unknown; onRetry?: () => void; fullPage?: boolean }) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const chunk = isChunkError(error);
  return (
    <div className={fullPage ? 'grid min-h-dvh place-items-center bg-zinc-50 p-4 dark:bg-zinc-950' : ''}>
      <div className="surface mx-auto w-full max-w-lg">
        <EmptyState
          icon={TriangleAlert}
          tone="rose"
          title={notFound ? 'Página no encontrada' : chunk ? 'Hay una nueva versión del foro' : 'Algo salió mal'}
          description={
            chunk
              ? 'Recargá la página para seguir usando el foro.'
              : 'Ocurrió un error inesperado al mostrar esta pantalla. Probá de nuevo; si sigue pasando, avisanos.'
          }
          action={
            <>
              <Button onClick={onRetry ?? (() => window.location.reload())}>
                <RefreshCw />
                Reintentar
              </Button>
              <a href="/" className={buttonVariants({ variant: 'secondary' })}>
                <House />
                Ir al inicio
              </a>
            </>
          }
        />
        {import.meta.env.DEV && error instanceof Error && (
          <pre className="mx-5 mb-5 max-h-40 overflow-auto rounded-xl bg-zinc-950 p-3 text-xs text-rose-300">{error.stack ?? error.message}</pre>
        )}
      </div>
    </div>
  );
}

/** errorElement de React Router. */
export function RouteError() {
  const error = useRouteError();
  return <ErrorScreen error={error} />;
}

export function RootError() {
  const error = useRouteError();
  return <ErrorScreen error={error} fullPage />;
}

/** Error boundary clásico para envolver zonas (con reintento sin recargar). */
export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('UI error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? <ErrorScreen error={this.state.error} onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
