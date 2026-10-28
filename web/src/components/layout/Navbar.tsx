import { Menu as MenuIcon, MessageCircle, Plus, Search } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { loginPath } from '@/lib/navigation';
import { drawerStore, paletteStore } from '@/lib/store';
import { isMac } from '@/lib/utils';
import { useMe } from '@/queries/auth';
import { Logo } from '../common';
import { buttonVariants } from '../ui/Button';
import { CountBadge, Kbd, Skeleton } from '../ui/misc';
import { Tooltip } from '../ui/Popover';
import { NotificationsPopover } from './NotificationsPopover';
import { UserMenu } from './UserMenu';

const iconBtn =
  'relative grid size-9 place-items-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100';

export function Navbar() {
  const { me, isLoading } = useMe();
  const location = useLocation();
  const next = location.pathname + location.search;

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/75 backdrop-blur-xl backdrop-saturate-150 dark:border-zinc-800/80 dark:bg-zinc-950/70">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-3 sm:gap-3 sm:px-6">
        <button type="button" className={`${iconBtn} lg:hidden`} aria-label="Abrir menú" onClick={() => drawerStore.set(true)}>
          <MenuIcon className="size-5" />
        </button>
        <Logo className="shrink-0" />

        <div className="flex flex-1 justify-center px-2 lg:px-8">
          <button
            type="button"
            onClick={() => paletteStore.set(true)}
            className="group hidden h-9 w-full max-w-md items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-100/70 px-3 text-left text-sm text-zinc-500 transition-colors hover:border-zinc-300 hover:bg-white md:flex dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
            aria-label="Buscar en el foro"
          >
            <Search className="size-4 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" />
            <span className="flex-1 truncate">Buscar en el foro…</span>
            <span className="flex items-center gap-1">
              <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5">
          <button type="button" className={`${iconBtn} md:hidden`} aria-label="Buscar" onClick={() => paletteStore.set(true)}>
            <Search className="size-[19px]" />
          </button>
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Skeleton className="hidden h-9 w-24 rounded-xl sm:block" />
              <Skeleton className="size-8 rounded-full" />
            </div>
          ) : me ? (
            <>
              <Link to="/submit" className={buttonVariants({ size: 'md', className: 'hidden h-9 sm:inline-flex' })}>
                <Plus className="-ml-1" strokeWidth={2.5} />
                Crear
              </Link>
              <div className="mx-1 hidden h-6 w-px bg-zinc-200 sm:block dark:bg-zinc-800" />
              <Tooltip content="Mensajes">
                <Link to="/messages" className={iconBtn} aria-label={me.unreadMessages ? `Mensajes (${me.unreadMessages} sin leer)` : 'Mensajes'}>
                  <MessageCircle className="size-[19px]" />
                  <CountBadge count={me.unreadMessages} />
                </Link>
              </Tooltip>
              <div className="hidden md:block">
                <NotificationsPopover unread={me.unreadNotifications} />
              </div>
              <div className="ml-1">
                <UserMenu me={me} />
              </div>
            </>
          ) : (
            <>
              <Link to={loginPath(next)} className={buttonVariants({ variant: 'ghost', size: 'md', className: 'h-9' })}>
                Iniciar sesión
              </Link>
              <Link to="/register" className={buttonVariants({ size: 'md', className: 'hidden h-9 sm:inline-flex' })}>
                Registrarse
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
