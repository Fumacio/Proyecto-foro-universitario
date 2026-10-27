import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

export const inputClass =
  'block w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm text-zinc-900 shadow-xs transition-[border-color,box-shadow] duration-150 placeholder:text-zinc-400 hover:border-zinc-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-rose-500 aria-[invalid=true]:focus:ring-rose-500/15 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-700 dark:focus:border-brand-400';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(inputClass, 'h-10', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(inputClass, 'min-h-24 py-2.5 leading-relaxed', className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        inputClass,
        'h-10 appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export function Label({ htmlFor, children, className }: { htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-1.5 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300', className)}>
      {children}
    </label>
  );
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-center gap-1.5 text-[13px] text-rose-600 dark:text-rose-400">
      <CircleAlert className="size-3.5 shrink-0" />
      {children}
    </p>
  );
}

export function Hint({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mt-1.5 text-xs text-zinc-500 dark:text-zinc-400', className)}>{children}</p>;
}

interface FieldProps {
  label?: ReactNode;
  error?: string | null;
  hint?: ReactNode;
  className?: string;
  labelRight?: ReactNode;
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode;
}

/** Envoltorio de campo: label + control + error/hint con ids accesibles. */
export function Field({ label, error, hint, className, labelRight, children }: FieldProps) {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div className={className}>
      {(label || labelRight) && (
        <div className="flex items-end justify-between gap-2">
          {label ? <Label htmlFor={id}>{label}</Label> : <span />}
          {labelRight && <div className="mb-1.5 text-xs">{labelRight}</div>}
        </div>
      )}
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? errId : undefined })}
      {error ? <FieldError id={errId}>{error}</FieldError> : hint ? <Hint>{hint}</Hint> : null}
    </div>
  );
}
