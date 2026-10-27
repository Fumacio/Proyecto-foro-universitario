import { AtSign, UserPlus } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { useDocumentTitle } from '@/hooks';
import { errorMessage, isApiError } from '@/lib/api';
import { safeNext } from '@/lib/utils';
import { useMe, useRegister } from '@/queries/auth';
import { AuthHeader } from './AuthLayout';
import { FormAlert, PasswordInput, PasswordStrength, passwordValid } from './authBits';

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Form = { username: string; displayName: string; email: string; password: string };

function validate(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {};
  if (f.username.length < 3 || f.username.length > 20) e.username = 'Tiene que tener entre 3 y 20 caracteres.';
  else if (!USERNAME_RE.test(f.username)) e.username = 'Solo letras, números y guion bajo (_).';
  if (f.displayName.length > 40) e.displayName = 'Máximo 40 caracteres.';
  if (!EMAIL_RE.test(f.email.trim())) e.email = 'Ingresá un email válido.';
  if (!passwordValid(f.password)) e.password = 'Mínimo 8 caracteres, con al menos una letra y un número.';
  return e;
}

export function RegisterPage() {
  useDocumentTitle('Crear cuenta');
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const { me } = useMe();
  const register = useRegister();
  const [form, setForm] = useState<Form>({ username: '', displayName: '', email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (me && !register.isPending && !register.isSuccess) return <Navigate to={next} replace />;

  const set = (k: keyof Form) => (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((f) => {
      const nf = { ...f, [k]: value };
      if (touched) setErrors(validate(nf) as Record<string, string>);
      return nf;
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setFormError(null);
    const errs = validate(form) as Record<string, string>;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    register.mutate(
      {
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        displayName: form.displayName.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('¡Bienvenido al Foro UTN! 🎉', { description: 'Sumate a las comunidades de tus materias para armar tu feed.' });
          navigate(next === '/' ? '/c' : next, { replace: true });
        },
        onError: (err) => {
          if (isApiError(err) && err.details && Object.keys(err.details).length) {
            setErrors(err.details);
            setFormError(null);
          } else setFormError(errorMessage(err));
        },
      },
    );
  };

  return (
    <>
      <AuthHeader
        title="Creá tu cuenta"
        subtitle={
          <>
            ¿Ya tenés cuenta?{' '}
            <Link to={`/login${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
              Iniciá sesión
            </Link>
          </>
        }
      />
      {formError && <FormAlert>{formError}</FormAlert>}
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Usuario" error={errors.username} hint="Letras, números y _">
            {(p) => (
              <div className="relative">
                <AtSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                <Input {...p} autoComplete="username" autoFocus className="h-11 pl-9" maxLength={20} value={form.username} onChange={set('username')} placeholder="tu_usuario" />
              </div>
            )}
          </Field>
          <Field label={<>Nombre <span className="font-normal text-zinc-400">(opcional)</span></>} error={errors.displayName}>
            {(p) => <Input {...p} autoComplete="name" className="h-11" maxLength={40} value={form.displayName} onChange={set('displayName')} placeholder="Lucía Pérez" />}
          </Field>
        </div>
        <Field label="Email" error={errors.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" className="h-11" value={form.email} onChange={set('email')} placeholder="tu@email.com" />}
        </Field>
        <Field label="Contraseña" error={errors.password}>
          {(p) => (
            <>
              <PasswordInput {...p} autoComplete="new-password" value={form.password} onChange={set('password')} placeholder="Creá una contraseña segura" />
              {!errors.password && <PasswordStrength password={form.password} />}
            </>
          )}
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={register.isPending}>
          <UserPlus />
          Crear cuenta
        </Button>
        <p className="text-center text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Al registrarte aceptás convivir con respeto y seguir las reglas de cada comunidad.
        </p>
      </form>
    </>
  );
}
