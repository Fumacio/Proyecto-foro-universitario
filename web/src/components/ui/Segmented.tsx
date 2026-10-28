import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';

export interface SegmentItem<T extends string> {
  value: T;
  label: ReactNode;
  icon?: LucideIcon;
  count?: number;
}

/** Control segmentado tipo "pill" (tabs de orden, vista, tema…). */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  size = 'md',
  className,
  ariaLabel,
  iconOnlyMobile,
}: {
  items: SegmentItem<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  ariaLabel?: string;
  iconOnlyMobile?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-xl border border-zinc-200 bg-zinc-100/70 p-0.5 dark:border-zinc-800 dark:bg-zinc-900/80',
        className,
      )}
    >
      {items.map((it) => {
        const active = it.value === value;
        const Icon = it.icon;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-[10px] font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2',
              size === 'sm' ? 'h-7 px-2.5 text-xs [&_svg]:size-3.5' : 'h-8 px-3 text-[13px] [&_svg]:size-4',
              active
                ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700/80'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100',
            )}
          >
            {Icon && <Icon className={cn(active && 'text-brand-600 dark:text-brand-400')} />}
            <span className={cn(iconOnlyMobile && Icon && !active && 'sr-only sm:not-sr-only')}>{it.label}</span>
            {it.count != null && (
              <span className="rounded-md bg-zinc-200/80 px-1.5 text-[11px] tabular-nums text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Tabs con subrayado (perfil, búsqueda, configuración). */
export function UnderlineTabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: SegmentItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('no-scrollbar flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800', className)}>
      {items.map((it) => {
        const active = it.value === value;
        const Icon = it.icon;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cn(
              'relative inline-flex h-11 shrink-0 items-center gap-2 px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 [&_svg]:size-4',
              active ? 'text-zinc-950 dark:text-white' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
            )}
          >
            {Icon && <Icon />}
            {it.label}
            {it.count != null && (
              <span className="rounded-md bg-zinc-100 px-1.5 text-[11px] tabular-nums text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {it.count}
              </span>
            )}
            <span
              className={cn(
                'absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-colors',
                active ? 'bg-brand-600 dark:bg-brand-400' : 'bg-transparent',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

/** Igual que UnderlineTabs pero con links (rutas). */
export function LinkTabs({ items, className }: { items: { to: string; label: ReactNode; icon?: LucideIcon; end?: boolean; badge?: number }[]; className?: string }) {
  return (
    <nav className={cn('no-scrollbar flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800', className)}>
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              cn(
                'group relative inline-flex h-11 shrink-0 items-center gap-2 px-3 text-sm font-medium transition-colors [&_svg]:size-4',
                isActive ? 'text-zinc-950 dark:text-white' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
              )
            }
          >
            {({ isActive }) => (
              <>
                {Icon && <Icon />}
                {it.label}
                {!!it.badge && (
                  <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-4 text-white">{it.badge}</span>
                )}
                <span
                  className={cn(
                    'absolute inset-x-2 -bottom-px h-0.5 rounded-full',
                    isActive ? 'bg-brand-600 dark:bg-brand-400' : 'bg-transparent',
                  )}
                />
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
