import { ArrowLeft, MailCheck, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button, buttonVariants } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { useDocumentTitle } from '@/hooks';
import { errorMessage } from '@/lib/api';
import { useForgotPassword } from '@/queries/auth';
import { AuthHeader } from './AuthLayout';
import { FormAlert } from './authBits';

export function ForgotPasswordPage() {
  useDocumentTitle('Recuperar contraseña');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const forgot = useForgotPassword();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Ingresá un email válido.');
      return;
    }
    setError(null);
    forgot.mutate({ email: email.trim() });
  };

  if (forgot.isSuccess) {
    return (
      <div className="text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/5">
          <MailCheck className="size-7" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">Revisá tu email</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Si <strong className="font-medium text-zinc-700 dark:text-zinc-200">{email}</strong> está registrado, te mandamos un link para crear una
          contraseña nueva. Puede tardar unos minutos.
        </p>
        <Link to="/login" className={buttonVariants({ variant: 'secondary', size: 'lg', className: 'mt-8 w-full' })}>
          <ArrowLeft />
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <>
      <AuthHeader title="¿Olvidaste tu contraseña?" subtitle="No pasa nada. Ingresá tu email y te mandamos un link para recuperarla." />
      {forgot.isError && <FormAlert>{errorMessage(forgot.error)}</FormAlert>}
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Email" error={error}>
          {(p) => <Input {...p} type="email" autoComplete="email" autoFocus className="h-11" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />}
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={forgot.isPending}>
          <Send />
          Enviar link
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500">
        ¿Te acordaste?{' '}
        <Link to="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
          Iniciá sesión
        </Link>
      </p>
    </>
  );
}
