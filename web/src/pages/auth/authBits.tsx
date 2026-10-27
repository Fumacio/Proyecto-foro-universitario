import { CircleAlert, Check, Eye, EyeOff } from 'lucide-react';
import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { inputClass } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function PasswordInput(
  { className, ...props },
  ref,
) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input ref={ref} type={show ? 'text' : 'password'} className={cn(inputClass, 'h-11 pr-11', className)} {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={show}
        className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </button>
    </div>
  );
});

export function passwordChecks(pw: string) {
  return [
    { ok: pw.length >= 8, label: 'Al menos 8 caracteres' },
    { ok: /[a-zA-Z]/.test(pw), label: 'Una letra' },
    { ok: /\d/.test(pw), label: 'Un número' },
  ];
}

export function passwordValid(pw: string) {
  return pw.length <= 100 && passwordChecks(pw).every((c) => c.ok);
}

function strength(pw: string) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[a-zA-Z]/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw) || pw.length >= 14) s++;
  if (pw.length < 8) s = Math.min(s, 1);
  return Math.max(1, s);
}

const LEVELS = [
  { label: 'Muy débil', bar: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
  { label: 'Débil', bar: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400' },
  { label: 'Aceptable', bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  { label: 'Buena', bar: 'bg-lime-500', text: 'text-lime-600 dark:text-lime-400' },
  { label: 'Excelente', bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
];

export function PasswordStrength({ password }: { password: string }) {
  const s = strength(password);
  const level = LEVELS[s];
  const checks = passwordChecks(password);
  if (!password) {
    return <p className="mt-1.5 text-xs text-zinc-500">Mínimo 8 caracteres, con al menos una letra y un número.</p>;
  }
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-300', i <= s ? level.bar : 'bg-zinc-200 dark:bg-zinc-800')} />
          ))}
        </div>
        <span className={cn('w-20 text-right text-xs font-medium', level.text)}>{level.label}</span>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {checks.map((c) => (
          <li key={c.label} className={cn('inline-flex items-center gap-1 text-xs', c.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400')}>
            <Check className={cn('size-3', !c.ok && 'opacity-40')} strokeWidth={3} />
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FormAlert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'success' }) {
  return (
    <div
      role="alert"
      className={cn(
        'mb-5 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm',
        tone === 'error'
          ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300',
      )}
    >
      {tone === 'error' ? <CircleAlert className="mt-0.5 size-4 shrink-0" /> : <Check className="mt-0.5 size-4 shrink-0" />}
      <div>{children}</div>
    </div>
  );
}
