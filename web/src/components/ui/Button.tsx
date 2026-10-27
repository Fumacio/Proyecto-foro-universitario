import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'danger-ghost' | 'success';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm' | 'icon-xs';

const base =
  'relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:pointer-events-none disabled:opacity-55 active:scale-[0.98] [&_svg]:shrink-0';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm shadow-brand-900/10 hover:bg-brand-700 dark:bg-brand-600 dark:hover:bg-brand-500',
  secondary:
    'bg-white text-zinc-800 border border-zinc-200 shadow-xs hover:bg-zinc-50 hover:border-zinc-300 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800 dark:hover:border-zinc-700',
  ghost: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100',
  outline:
    'border border-brand-600/30 text-brand-700 hover:bg-brand-50 dark:border-brand-400/30 dark:text-brand-300 dark:hover:bg-brand-500/10',
  danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700 dark:hover:bg-rose-500',
  'danger-ghost': 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10',
  success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 dark:hover:bg-emerald-500',
};

const sizes: Record<ButtonSize, string> = {
  xs: 'h-7 rounded-lg px-2.5 text-xs [&_svg]:size-3.5',
  sm: 'h-8 rounded-lg px-3 text-[13px] [&_svg]:size-4',
  md: 'h-9 rounded-xl px-4 text-sm [&_svg]:size-4',
  lg: 'h-11 rounded-xl px-5 text-[15px] [&_svg]:size-[18px]',
  icon: 'size-9 rounded-xl [&_svg]:size-[18px]',
  'icon-sm': 'size-8 rounded-lg [&_svg]:size-4',
  'icon-xs': 'size-7 rounded-lg [&_svg]:size-3.5',
};

export function buttonVariants({
  variant = 'primary',
  size = 'md',
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading, className, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonVariants({ variant, size, className })}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner className="size-4" />
        </span>
      )}
      <span className={cn('inline-flex items-center justify-center gap-[inherit]', loading && 'invisible')}>
        {children}
      </span>
    </button>
  );
});
