import { CircleAlert, Check, Eye, EyeOff } from 'lucide-react';
import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { inputClass } from '@/components/ui/Input';
import { Divider } from '@/components/ui/misc';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import { googleAuthUrl, useAuthProviders } from '@/queries/auth';

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

/* ---------------- Google ---------------- */

/** Logo oficial "G" multicolor de Google. */
export function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn('size-[18px] shrink-0', className)} aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** Botón "Continuar con Google": navegación completa a /api/auth/google (no es un fetch). */
export function GoogleButton({ next, label = 'Continuar con Google' }: { next: string; label?: string }) {
  const [going, setGoing] = useState(false);
  return (
    <a
      href={googleAuthUrl(next)}
      onClick={() => setGoing(true)}
      aria-busy={going || undefined}
      className={cn(
        'relative flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-zinc-300 bg-white px-4 text-[15px] font-medium text-zinc-800 shadow-xs transition-[background-color,border-color,box-shadow,transform] duration-150 hover:border-zinc-400 hover:bg-zinc-50 hover:shadow-sm active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800',
        going && 'pointer-events-none opacity-80',
      )}
    >
      {going ? <Spinner className="size-[18px]" label="Redirigiendo a Google" /> : <GoogleLogo />}
      {going ? 'Redirigiendo a Google…' : label}
    </a>
  );
}

/** Bloque de proveedores externos para login/registro (solo si el server tiene Google configurado). */
export function OAuthProviders({ next, dividerLabel = 'o con tu email' }: { next: string; dividerLabel?: string }) {
  const providers = useAuthProviders();
  if (!providers.data?.google) return null;
  return (
    <div className="mb-6 animate-fade-in">
      <GoogleButton next={next} />
      <Divider label={dividerLabel} className="mt-6" />
    </div>
  );
}
