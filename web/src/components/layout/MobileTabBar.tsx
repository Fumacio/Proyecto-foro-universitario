import { Bell, House, LogIn, Plus, Search } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router';
import { loginPath } from '@/lib/navigation';
import { paletteStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useMe } from '@/queries/auth';
import { Avatar } from '../ui/Avatar';
import { CountBadge } from '../ui/misc';

const tab = 'relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition-colors';

export function MobileTabBar() {
  const { me } = useMe();
  const location = useLocation();
  const cls = ({ isActive }: { isActive: boolean }) =>
    cn(tab, isActive ? 'text-brand-600 dark:text-brand-400' : 'text-zinc-500 dark:text-zinc-400');

  return (
    <nav
      aria-label="Navegación inferior"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200/80 bg-white/85 backdrop-blur-xl md:hidden dark:border-zinc-800/80 dark:bg-zinc-950/85"
    >
      <div className="flex h-16 items-stretch px-2">
        <NavLink to="/" end className={cls}>
          <House className="size-[22px]" />
          Inicio
        </NavLink>
        <button type="button" className={cn(tab, 'text-zinc-500 dark:text-zinc-400')} onClick={() => paletteStore.set(true)}>
          <Search className="size-[22px]" />
          Buscar
        </button>
        <div className="flex flex-1 items-center justify-center">
          <Link
            to={me ? '/submit' : loginPath('/submit')}
            aria-label="Crear post"
            className="grid size-12 -translate-y-2 place-items-center rounded-2xl bg-linear-to-br from-brand-500 to-violet-600 text-white shadow-lg shadow-brand-600/30 ring-4 ring-white transition-transform active:scale-95 dark:ring-zinc-950"
          >
            <Plus className="size-6" strokeWidth={2.5} />
          </Link>
        </div>
        {me ? (
          <NavLink to="/notifications" className={cls}>
            <span className="relative">
              <Bell className="size-[22px]" />
              <CountBadge count={me.unreadNotifications} className="-right-2 -top-1.5" />
            </span>
            Avisos
          </NavLink>
        ) : (
          <Link to={loginPath('/notifications')} className={cn(tab, 'text-zinc-500 dark:text-zinc-400')}>
            <Bell className="size-[22px]" />
            Avisos
          </Link>
        )}
        {me ? (
          <NavLink to={`/u/${me.username}`} className={cls}>
            {({ isActive }) => (
              <>
                <Avatar user={me} size="sm" className={cn(isActive && 'ring-2 ring-brand-500')} />
                Perfil
              </>
            )}
          </NavLink>
        ) : (
          <Link to={loginPath(location.pathname + location.search)} className={cn(tab, 'text-zinc-500 dark:text-zinc-400')}>
            <LogIn className="size-[22px]" />
            Ingresar
          </Link>
        )}
      </div>
    </nav>
  );
}
