import { CircleCheckBig, KeyRound, LogIn, TriangleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button, buttonVariants } from '@/components/ui/Button';
import { Field } from '@/components/ui/Input';
import { useDocumentTitle } from '@/hooks';
import { errorMessage, isApiError } from '@/lib/api';
import { useResetPassword } from '@/queries/auth';
import { AuthHeader } from './AuthLayout';
import { FormAlert, PasswordInput, PasswordStrength, passwordValid } from './authBits';

export function ResetPasswordPage() {
  useDocumentTitle('Nueva contraseña');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const reset = useResetPassword();

  if (!token) {
    return (
      <div className="text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-amber-50 text-amber-600 ring-8 ring-amber-50/60 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/5">
          <TriangleAlert className="size-7" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">Link inválido</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">El link de recuperación está incompleto o ya venció. Pedí uno nuevo.</p>
        <Link to="/forgot-password" className={buttonVariants({ size: 'lg', className: 'mt-8 w-full' })}>
          Pedir un link nuevo
        </Link>
      </div>
    );
  }

  if (reset.isSuccess) {
    return (
      <div className="text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/5">
          <CircleCheckBig className="size-7" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">¡Listo!</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Tu contraseña se actualizó. Ya podés iniciar sesión con la nueva.</p>
        <Link to="/login" className={buttonVariants({ size: 'lg', className: 'mt-8 w-full' })}>
          <LogIn />
          Iniciar sesión
        </Link>
      </div>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!passwordValid(password)) errs.password = 'Mínimo 8 caracteres, con al menos una letra y un número.';
    if (confirm !== password) errs.confirm = 'Las contraseñas no coinciden.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    reset.mutate(
      { token, password },
      { onError: (err) => isApiError(err) && err.details && setErrors(err.details) },
    );
  };

  return (
    <>
      <AuthHeader title="Creá una contraseña nueva" subtitle="Elegí una que no uses en otros sitios." />
      {reset.isError && !(isApiError(reset.error) && reset.error.details) && (
        <FormAlert>
          {errorMessage(reset.error)}{' '}
          <Link to="/forgot-password" className="font-semibold underline">
            Pedir otro link
          </Link>
        </FormAlert>
      )}
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Nueva contraseña" error={errors.password}>
          {(p) => (
            <>
              <PasswordInput {...p} autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
              {!errors.password && <PasswordStrength password={password} />}
            </>
          )}
        </Field>
        <Field label="Repetí la contraseña" error={errors.confirm}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={reset.isPending}>
          <KeyRound />
          Guardar contraseña
        </Button>
      </form>
    </>
  );
}
