import { Bookmark, LogOut, Monitor, Moon, Settings, ShieldCheck, Sun, User } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useTheme, type ThemePref } from '@/lib/store';
import type { Me } from '@/lib/types';
import { cn, displayName, formatCount, isStaff } from '@/lib/utils';
import { useLogout } from '@/queries/auth';
import { RoleBadge } from '../common';
import { Avatar } from '../ui/Avatar';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from '../ui/Menu';

export const THEME_OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className={cn('grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/70', className)} role="radiogroup" aria-label="Tema">
      {THEME_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          onClick={() => setTheme(o.value)}
          className={cn(
            'flex flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors',
            theme === o.value
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-white'
              : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
          )}
        >
          <o.icon className="size-4" />
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function UserMenu({ me }: { me: Me }) {
  const navigate = useNavigate();
  const logout = useLogout();
  const { theme, setTheme } = useTheme();
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label="Menú de usuario"
          className="rounded-full outline-offset-2 transition-shadow hover:ring-4 hover:ring-zinc-200/70 data-[state=open]:ring-4 data-[state=open]:ring-brand-500/25 dark:hover:ring-zinc-800"
        >
          <Avatar user={me} size="md" />
        </button>
      </MenuTrigger>
      <MenuContent className="w-64">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <Avatar user={me} size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{displayName(me)}</p>
              <RoleBadge role={me.role} />
            </div>
            <p className="truncate text-xs text-zinc-500">
              @{me.username} · {formatCount(me.karma)} karma
            </p>
          </div>
        </div>
        <MenuSeparator />
        <MenuItem icon={<User />} onSelect={() => navigate(`/u/${me.username}`)}>
          Mi perfil
        </MenuItem>
        <MenuItem icon={<Bookmark />} onSelect={() => navigate('/saved')}>
          Guardados
        </MenuItem>
        <MenuItem icon={<Settings />} onSelect={() => navigate('/settings')}>
          Configuración
        </MenuItem>
        {isStaff(me.role) && (
          <MenuItem icon={<ShieldCheck />} onSelect={() => navigate('/mod')}>
            Moderación
          </MenuItem>
        )}
        <MenuSeparator />
        <MenuLabel>Tema</MenuLabel>
        <MenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemePref)}>
          {THEME_OPTIONS.map((o) => (
            <MenuRadioItem key={o.value} value={o.value} icon={<o.icon />} onSelect={(e) => e.preventDefault()}>
              {o.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuItem
          icon={<LogOut />}
          onSelect={() =>
            logout.mutate(undefined, {
              onSettled: () => {
                toast.success('Cerraste sesión. ¡Hasta pronto!');
                navigate('/');
              },
            })
          }
        >
          Cerrar sesión
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
