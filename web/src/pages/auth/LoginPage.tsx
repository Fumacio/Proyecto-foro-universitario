import { LogIn } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { useDocumentTitle } from '@/hooks';
import { errorMessage, isApiError } from '@/lib/api';
import { displayName, safeNext } from '@/lib/utils';
import { useLogin, useMe } from '@/queries/auth';
import { AuthHeader } from './AuthLayout';
import { FormAlert, PasswordInput } from './authBits';

export function LoginPage() {
  useDocumentTitle('Iniciar sesión');
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const { me } = useMe();
  const login = useLogin();
  const [form, setForm] = useState({ login: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  if (me && !login.isPending && !login.isSuccess) return <Navigate to={next} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.login.trim()) errs.login = 'Ingresá tu email o usuario.';
    if (!form.password) errs.password = 'Ingresá tu contraseña.';
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) return;
    login.mutate(
      { login: form.login.trim(), password: form.password },
      {
        onSuccess: ({ user }) => {
          toast.success(`¡Hola de nuevo, ${displayName(user)}!`);
          navigate(next, { replace: true });
        },
        onError: (err) => {
          if (isApiError(err) && err.details) setErrors(err.details);
          if (isApiError(err) && err.status === 401) setFormError('Usuario o contraseña incorrectos.');
          else setFormError(errorMessage(err));
        },
      },
    );
  };

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors(({ [k]: _omit, ...rest }) => rest);
  };

  return (
    <>
      <AuthHeader
        title="Iniciá sesión"
        subtitle={
          <>
            ¿No tenés cuenta?{' '}
            <Link to={`/register${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
              Registrate gratis
            </Link>
          </>
        }
      />
      {formError && <FormAlert>{formError}</FormAlert>}
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Email o usuario" error={errors.login}>
          {(p) => (
            <Input {...p} autoComplete="username" autoFocus className="h-11" value={form.login} onChange={set('login')} placeholder="tu@email.com o tu_usuario" />
          )}
        </Field>
        <Field
          label="Contraseña"
          error={errors.password}
          labelRight={
            <Link to="/forgot-password" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
              ¿Olvidaste tu contraseña?
            </Link>
          }
        >
          {(p) => <PasswordInput {...p} autoComplete="current-password" value={form.password} onChange={set('password')} placeholder="••••••••" />}
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
          <LogIn />
          Iniciar sesión
        </Button>
      </form>
      {import.meta.env.DEV && (
        <p className="mt-6 rounded-xl border border-dashed border-zinc-200 p-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <strong className="font-semibold text-zinc-700 dark:text-zinc-300">Modo desarrollo:</strong> probá con{' '}
          <button type="button" className="font-mono text-brand-600 hover:underline dark:text-brand-400" onClick={() => setForm({ login: 'lucia_dev', password: 'foro1234' })}>
            lucia_dev
          </button>{' '}
          o{' '}
          <button type="button" className="font-mono text-brand-600 hover:underline dark:text-brand-400" onClick={() => setForm({ login: 'admin', password: 'foro1234' })}>
            admin
          </button>{' '}
          (contraseña <code className="font-mono">foro1234</code>).
        </p>
      )}
    </>
  );
}
