import { TriangleAlert } from 'lucide-react';
import { Suspense, type ReactNode } from 'react';
import { Outlet } from 'react-router';
import { useRealtime } from '@/lib/realtime';
import { longDate } from '@/lib/time';
import { cn } from '@/lib/utils';
import { useMe } from '@/queries/auth';
import { CommandPalette } from '../CommandPalette';
import { IOSInstallDialog } from '../pwa/InstallApp';
import { PageSpinner } from '../ui/Spinner';
import { MobileTabBar } from './MobileTabBar';
import { Navbar } from './Navbar';
import { MobileDrawer, SidebarContent } from './Sidebar';

function BanBanner() {
  const { me } = useMe();
  if (!me?.ban) return null;
  const { ban } = me;
  return (
    <div role="alert" className="border-b border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
      <div className="mx-auto flex max-w-[1400px] items-start gap-3 px-4 py-2.5 text-sm sm:px-6">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p>
          <strong className="font-semibold">
            {ban.expiresAt ? `Tu cuenta está suspendida hasta el ${longDate(ban.expiresAt)}.` : 'Tu cuenta está suspendida de forma permanente.'}
          </strong>{' '}
          Motivo: {ban.reason}. Podés seguir leyendo, pero no publicar, comentar ni votar.
        </p>
      </div>
    </div>
  );
}

export function AppShell() {
  const { me } = useMe();
  useRealtime(me?.id ?? null);

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-transform focus:translate-y-0"
      >
        Saltar al contenido
      </a>
      <Navbar />
      <BanBanner />
      <div className="mx-auto flex max-w-[1400px] gap-6 px-3 sm:px-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-14 h-[calc(100dvh-3.5rem)] overflow-y-auto py-5 pr-1">
            <SidebarContent />
          </div>
        </aside>
        <main id="main" className="min-w-0 flex-1 pb-28 pt-4 sm:pt-5 md:pb-12">
          <Suspense fallback={<PageSpinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <MobileTabBar />
      <MobileDrawer />
      <CommandPalette />
      <IOSInstallDialog />
    </div>
  );
}

/** Columna principal + barra derecha contextual (xl+). */
export function PageLayout({ children, aside, className }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className="flex gap-6">
      <div className={cn('min-w-0 flex-1', className)}>{children}</div>
      {aside && (
        <aside className="hidden w-80 shrink-0 xl:block">
          <div className="no-scrollbar sticky top-[4.75rem] max-h-[calc(100dvh-5.75rem)] space-y-4 overflow-y-auto pb-4">{aside}</div>
        </aside>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  icon,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-x-4 gap-y-3', className)}>
      {icon}
      {/* basis-56: en pantallas angostas las acciones bajan de renglón en vez de pisar el título */}
      <div className="min-w-0 flex-1 basis-56">
        <h1 className="text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
