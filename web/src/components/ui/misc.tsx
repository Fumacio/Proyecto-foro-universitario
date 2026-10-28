import type { LucideIcon } from 'lucide-react';
import { CloudOff, RefreshCw } from 'lucide-react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('surface', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, action, className }: { title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-2 px-4 pt-4', className)}>
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{title}</h3>
      {action}
    </div>
  );
}

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn('animate-shimmer rounded-lg bg-zinc-200/80 dark:bg-zinc-800/80', className)} style={style} />;
}

const tones = {
  brand: 'bg-brand-50 text-brand-600 ring-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/20',
  zinc: 'bg-zinc-100 text-zinc-500 ring-zinc-200/70 dark:bg-zinc-800/80 dark:text-zinc-400 dark:ring-zinc-700/60',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  rose: 'bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20',
  sky: 'bg-sky-50 text-sky-600 ring-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20',
};

export type Tone = keyof typeof tones;

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = 'brand',
  className,
  compact,
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  tone?: Tone;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 text-center', compact ? 'py-8' : 'py-14', className)}>
      <div className="relative">
        <div className={cn('absolute inset-0 -m-3 rounded-full opacity-50 blur-xl', tones[tone])} aria-hidden />
        <div className={cn('relative grid place-items-center rounded-full ring-8', tones[tone], compact ? 'size-12' : 'size-16')}>
          <Icon className={compact ? 'size-5' : 'size-7'} strokeWidth={1.75} />
        </div>
      </div>
      <h3 className={cn('font-semibold text-zinc-900 dark:text-zinc-100', compact ? 'mt-4 text-sm' : 'mt-6 text-base')}>{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = 'No pudimos cargar esto',
  className,
  compact,
}: {
  error?: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <EmptyState
      icon={CloudOff}
      tone="rose"
      compact={compact}
      className={className}
      title={title}
      description={error ? errorMessage(error) : 'Revisá tu conexión y probá de nuevo.'}
      action={
        onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            <RefreshCw />
            Reintentar
          </Button>
        )
      }
    />
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 px-1.5 font-sans text-[11px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function Badge({
  tone = 'zinc',
  children,
  className,
  icon: Icon,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  icon?: LucideIcon;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {Icon && <Icon className="size-3" strokeWidth={2.25} />}
      {children}
    </span>
  );
}

export function Dot({ className }: { className?: string }) {
  return <span aria-hidden className={cn('text-zinc-300 dark:text-zinc-700', className)}>·</span>;
}

/** Contador rojo para íconos de la barra. */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span
      className={cn(
        'pointer-events-none absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-zinc-950',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function Divider({ label, className }: { label?: string; className?: string }) {
  if (!label) return <hr className={cn('border-zinc-200 dark:border-zinc-800', className)} />;
  return (
    <div className={cn('flex items-center gap-3 text-xs text-zinc-400', className)}>
      <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      {label}
      <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}
