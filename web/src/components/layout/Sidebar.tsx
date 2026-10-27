import * as RD from '@radix-ui/react-dialog';
import { Bookmark, CircleQuestionMark, ExternalLink, House, LayoutGrid, Rss, Plus, X, type LucideIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { drawerStore } from '@/lib/store';
import { cn, formatCount, isMac } from '@/lib/utils';
import { useMe } from '@/queries/auth';
import { useCommunities, useJoinedCommunities } from '@/queries/communities';
import { CommunityIcon, Logo } from '../common';
import { Kbd, Skeleton } from '../ui/misc';
import { ThemeSwitcher } from './UserMenu';

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean; auth?: boolean }[] = [
  { to: '/', label: 'Inicio', icon: House, end: true },
  { to: '/following', label: 'Siguiendo', icon: Rss, auth: true },
  { to: '/unanswered', label: 'Sin responder', icon: CircleQuestionMark },
  { to: '/saved', label: 'Guardados', icon: Bookmark, auth: true },
  { to: '/c', label: 'Comunidades', icon: LayoutGrid, end: true },
];

const navItem = ({ isActive }: { isActive: boolean }) =>
  cn(
    'group flex h-9 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors',
    isActive
      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100',
  );

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { me } = useMe();
  const joined = useJoinedCommunities(!!me);
  const all = useCommunities();
  const mine = me && joined.data && joined.data.length > 0;
  const list = mine ? joined.data! : (all.data ?? []).slice(0, 8);
  const loading = mine ? false : all.isPending || (!!me && joined.isPending);

  return (
    <div className="flex h-full flex-col">
      <nav className="space-y-0.5" aria-label="Principal">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={navItem} onClick={onNavigate}>
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    'size-[18px] transition-colors',
                    isActive ? 'text-brand-600 dark:text-brand-400' : 'text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300',
                  )}
                  strokeWidth={isActive ? 2.25 : 2}
                />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-6">
        <div className="mb-1.5 flex items-center justify-between px-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {mine ? 'Mis comunidades' : 'Comunidades'}
          </h2>
          <Link to="/c" onClick={onNavigate} className="text-[11px] font-medium text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400">
            Ver todas
          </Link>
        </div>
        <div className="space-y-0.5">
          {loading
            ? Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-1.5">
                  <Skeleton className="size-6 rounded-lg" />
                  <Skeleton className="h-3 flex-1" />
                </div>
              ))
            : list.map((c) => (
                <NavLink key={c.id} to={`/c/${c.slug}`} className={navItem} onClick={onNavigate}>
                  <CommunityIcon community={c} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  {!mine && <span className="text-[11px] tabular-nums text-zinc-400">{formatCount(c.memberCount)}</span>}
                </NavLink>
              ))}
          {!loading && list.length === 0 && (all.isError || joined.isError) && (
            <p className="px-3 py-2 text-xs text-zinc-400">No se pudieron cargar las comunidades.</p>
          )}
        </div>
      </div>

      <div className="mt-auto space-y-3 pt-8">
        <div className="rounded-xl border border-dashed border-zinc-200 p-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Buscá lo que quieras con <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd> <Kbd>K</Kbd>
        </div>
        <footer className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11.5px] text-zinc-400 dark:text-zinc-500">
          <Link to="/c" className="hover:text-zinc-700 dark:hover:text-zinc-300" onClick={onNavigate}>
            Comunidades
          </Link>
          <Link to="/search" className="hover:text-zinc-700 dark:hover:text-zinc-300" onClick={onNavigate}>
            Buscar
          </Link>
          <a href="https://www.frt.utn.edu.ar" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-zinc-700 dark:hover:text-zinc-300">
            UTN FRT <ExternalLink className="size-3" />
          </a>
          <span className="w-full">© {new Date().getFullYear()} Foro UTN · Facultad Regional Tucumán</span>
        </footer>
      </div>
    </div>
  );
}

export function MobileDrawer() {
  const open = drawerStore.useValue();
  const location = useLocation();
  const { me } = useMe();

  useEffect(() => {
    drawerStore.set(false);
  }, [location.pathname]);

  return (
    <RD.Root open={open} onOpenChange={drawerStore.set}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out lg:hidden" />
        <RD.Content className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,86vw)] flex-col border-r border-zinc-200 bg-white shadow-pop outline-none data-[state=open]:animate-slide-in-left data-[state=closed]:animate-slide-out-left lg:hidden dark:border-zinc-800 dark:bg-zinc-950">
          <RD.Title className="sr-only">Menú</RD.Title>
          <RD.Description className="sr-only">Navegación del foro</RD.Description>
          <div className="flex h-14 items-center justify-between border-b border-zinc-100 px-4 dark:border-zinc-800">
            <Logo />
            <RD.Close className="grid size-9 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Cerrar menú">
              <X className="size-5" />
            </RD.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {me && (
              <Link
                to="/submit"
                className="mb-4 flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
              >
                <Plus className="size-4" />
                Crear post
              </Link>
            )}
            <SidebarContent onNavigate={() => drawerStore.set(false)} />
            <div className="mt-4">
              <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Tema</p>
              <ThemeSwitcher />
            </div>
          </div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
