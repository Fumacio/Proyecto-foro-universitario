import { Check, KeyRound, LayoutList, Monitor, Moon, Palette, Rows3, Save, Sun, Trash, TriangleAlert, Upload, User, UserCog } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/misc';
import { useDocumentTitle } from '@/hooks';
import { errorMessage, isApiError, validateImage } from '@/lib/api';
import { useFeedView, useTheme, type FeedView, type ThemePref } from '@/lib/store';
import type { Me } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useChangePassword, useMe } from '@/queries/auth';
import { useDeleteAccount, useRemoveAvatar, useUpdateProfile, useUploadAvatar } from '@/queries/users';
import { FormAlert, PasswordInput, PasswordStrength, passwordValid } from './auth/authBits';

type Tab = 'profile' | 'account' | 'appearance';

const TABS: { value: Tab; label: string; icon: typeof User }[] = [
  { value: 'profile', label: 'Perfil', icon: User },
  { value: 'account', label: 'Cuenta', icon: UserCog },
  { value: 'appearance', label: 'Apariencia', icon: Palette },
];

const CAREERS = [
  'Ingeniería en Sistemas de Información',
  'Ingeniería Civil',
  'Ingeniería Electrónica',
  'Ingeniería Eléctrica',
  'Ingeniería Mecánica',
  'Ingeniería Química',
  'Ingeniería Industrial',
  'Tecnicatura Universitaria en Programación',
  'Licenciatura en Administración Rural',
];

function Section({ title, description, children, footer, danger }: { title: string; description?: string; children: ReactNode; footer?: ReactNode; danger?: boolean }) {
  return (
    <Card className={cn('overflow-hidden', danger && 'border-rose-200 dark:border-rose-500/30')}>
      <div className="p-5 sm:p-6">
        <h2 className={cn('text-base font-semibold', danger ? 'text-rose-700 dark:text-rose-400' : 'text-zinc-950 dark:text-white')}>{title}</h2>
        {description && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
        <div className="mt-5">{children}</div>
      </div>
      {footer && (
        <div className={cn('flex justify-end gap-2 border-t px-5 py-3.5 sm:px-6', danger ? 'border-rose-100 bg-rose-50/50 dark:border-rose-500/20 dark:bg-rose-500/5' : 'border-zinc-100 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40')}>
          {footer}
        </div>
      )}
    </Card>
  );
}

function ProfileTab({ me }: { me: Me }) {
  const [form, setForm] = useState({ displayName: me.displayName ?? '', bio: me.bio ?? '', career: me.career ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const update = useUpdateProfile();
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = form.displayName !== (me.displayName ?? '') || form.bio !== (me.bio ?? '') || form.career !== (me.career ?? '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.displayName.length > 40) errs.displayName = 'Máximo 40 caracteres.';
    if (form.bio.length > 500) errs.bio = 'Máximo 500 caracteres.';
    if (form.career.length > 100) errs.career = 'Máximo 100 caracteres.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    update.mutate(
      { displayName: form.displayName.trim(), bio: form.bio.trim(), career: form.career.trim() },
      {
        onSuccess: () => toast.success('Perfil actualizado'),
        onError: (err) => isApiError(err) && err.details && setErrors(err.details),
      },
    );
  };

  return (
    <div className="space-y-6">
      <Section title="Foto de perfil" description="PNG, JPG, WEBP o GIF de hasta 5 MB. Se ve en tus posts y comentarios.">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar user={me} size="2xl" className="size-20 text-2xl" />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => fileRef.current?.click()} loading={upload.isPending}>
              <Upload />
              {me.avatarUrl ? 'Cambiar foto' : 'Subir foto'}
            </Button>
            {me.avatarUrl && (
              <Button variant="danger-ghost" onClick={() => remove.mutate(undefined, { onSuccess: () => toast.success('Foto eliminada') })} loading={remove.isPending}>
                <Trash />
                Quitar
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              const problem = validateImage(f);
              if (problem) return void toast.error(problem);
              upload.mutate(f, { onSuccess: () => toast.success('¡Foto actualizada!') });
            }}
          />
        </div>
      </Section>

      <form onSubmit={submit}>
        <Section
          title="Información pública"
          description="Esto es lo que ven los demás en tu perfil."
          footer={
            <Button type="submit" loading={update.isPending} disabled={!dirty}>
              <Save />
              Guardar cambios
            </Button>
          }
        >
          <div className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Nombre visible" error={errors.displayName} hint="Si lo dejás vacío se muestra tu usuario.">
                {(p) => <Input {...p} maxLength={40} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder={me.username} />}
              </Field>
              <Field label="Usuario" hint="El nombre de usuario no se puede cambiar.">
                {(p) => <Input {...p} value={`@${me.username}`} disabled readOnly />}
              </Field>
            </div>
            <Field label="Carrera" error={errors.career}>
              {(p) => (
                <>
                  <Input {...p} list="careers" maxLength={100} value={form.career} onChange={(e) => setForm({ ...form, career: e.target.value })} placeholder="Ingeniería en Sistemas de Información" />
                  <datalist id="careers">
                    {CAREERS.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
            <Field label="Bio" error={errors.bio} labelRight={<span className="tabular-nums text-zinc-400">{form.bio.length}/500</span>}>
              {(p) => <Textarea {...p} rows={4} maxLength={500} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Contá un poco sobre vos: qué cursás, qué te interesa…" />}
            </Field>
          </div>
        </Section>
      </form>
    </div>
  );
}

function AccountTab({ me }: { me: Me }) {
  const navigate = useNavigate();
  const change = useChangePassword();
  const del = useDeleteAccount();
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePw, setDeletePw] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!pw.current) errs.currentPassword = 'Ingresá tu contraseña actual.';
    if (!passwordValid(pw.next)) errs.newPassword = 'Mínimo 8 caracteres, con al menos una letra y un número.';
    if (pw.confirm !== pw.next) errs.confirm = 'Las contraseñas no coinciden.';
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) return;
    change.mutate(
      { currentPassword: pw.current, newPassword: pw.next },
      {
        onSuccess: () => {
          toast.success('Contraseña actualizada', { description: 'Cerramos tus sesiones en otros dispositivos.' });
          setPw({ current: '', next: '', confirm: '' });
        },
        onError: (err) => {
          if (isApiError(err) && err.details) setErrors(err.details);
          else if (isApiError(err) && err.status === 401) setErrors({ currentPassword: 'La contraseña actual no es correcta.' });
          else setFormError(errorMessage(err));
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <Section title="Email" description="Tu email no se muestra públicamente.">
        <Input value={me.email} readOnly disabled className="max-w-md" />
      </Section>

      <form onSubmit={submit}>
        <Section
          title="Cambiar contraseña"
          description="Al cambiarla se cierran las sesiones abiertas en otros dispositivos."
          footer={
            <Button type="submit" loading={change.isPending}>
              <KeyRound />
              Actualizar contraseña
            </Button>
          }
        >
          {formError && <FormAlert>{formError}</FormAlert>}
          <div className="grid max-w-md gap-4">
            <Field label="Contraseña actual" error={errors.currentPassword}>
              {(p) => <PasswordInput {...p} autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />}
            </Field>
            <Field label="Nueva contraseña" error={errors.newPassword}>
              {(p) => (
                <>
                  <PasswordInput {...p} autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
                  {!errors.newPassword && <PasswordStrength password={pw.next} />}
                </>
              )}
            </Field>
            <Field label="Repetí la nueva contraseña" error={errors.confirm}>
              {(p) => <PasswordInput {...p} autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />}
            </Field>
          </div>
        </Section>
      </form>

      <Section
        danger
        title="Zona de peligro"
        description="Borrar tu cuenta es permanente. Tus posts y comentarios quedan publicados pero como “[eliminado]”."
        footer={
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash />
            Borrar mi cuenta
          </Button>
        }
      >
        <div className="flex items-start gap-3 rounded-xl bg-rose-50 p-3.5 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          Perdés tu karma, tus seguidores, tus mensajes y tus posts guardados. No hay forma de recuperarlos.
        </div>
      </Section>

      <Dialog
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o);
          if (!o) {
            setDeletePw('');
            setDeleteError(null);
          }
        }}
        title="¿Seguro que querés borrar tu cuenta?"
        description="Esta acción no se puede deshacer. Confirmá con tu contraseña."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={!deletePw}
              loading={del.isPending}
              onClick={() =>
                del.mutate(deletePw, {
                  onSuccess: () => {
                    toast.success('Tu cuenta fue borrada. ¡Gracias por haber sido parte!');
                    navigate('/', { replace: true });
                  },
                  onError: (err) => setDeleteError(isApiError(err) && (err.status === 401 || err.status === 400 || err.status === 403) ? 'La contraseña no es correcta.' : errorMessage(err)),
                })
              }
            >
              Borrar definitivamente
            </Button>
          </>
        }
      >
        <Field label="Contraseña" error={deleteError}>
          {(p) => <PasswordInput {...p} autoFocus autoComplete="current-password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} />}
        </Field>
      </Dialog>
    </div>
  );
}

function ChoiceCard({ active, onClick, title, icon: Icon, preview }: { active: boolean; onClick: () => void; title: string; icon: typeof Sun; preview: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-2xl border-2 text-left transition-all',
        active ? 'border-brand-500 ring-4 ring-brand-500/15' : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700',
      )}
    >
      <div className="h-24 overflow-hidden">{preview}</div>
      <div className="flex items-center gap-2 border-t border-zinc-100 bg-white px-3 py-2.5 text-sm font-medium text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        <Icon className="size-4 text-zinc-400" />
        {title}
        {active && (
          <span className="ml-auto grid size-5 place-items-center rounded-full bg-brand-600 text-white">
            <Check className="size-3" strokeWidth={3} />
          </span>
        )}
      </div>
    </button>
  );
}

function MiniUI({ dark }: { dark: boolean }) {
  return (
    <div className={cn('h-full p-3', dark ? 'bg-[#09090b]' : 'bg-zinc-50')}>
      <div className={cn('h-full rounded-lg border p-2', dark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white')}>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-brand-500" />
          <span className={cn('h-1.5 w-12 rounded-full', dark ? 'bg-zinc-700' : 'bg-zinc-200')} />
        </div>
        <span className={cn('mt-2 block h-2 w-3/4 rounded-full', dark ? 'bg-zinc-600' : 'bg-zinc-300')} />
        <span className={cn('mt-1.5 block h-1.5 w-full rounded-full', dark ? 'bg-zinc-800' : 'bg-zinc-100')} />
        <span className={cn('mt-1 block h-1.5 w-2/3 rounded-full', dark ? 'bg-zinc-800' : 'bg-zinc-100')} />
      </div>
    </div>
  );
}

function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const [view, setView] = useFeedView();
  const themes: { value: ThemePref; title: string; icon: typeof Sun; preview: ReactNode }[] = [
    { value: 'light', title: 'Claro', icon: Sun, preview: <MiniUI dark={false} /> },
    { value: 'dark', title: 'Oscuro', icon: Moon, preview: <MiniUI dark /> },
    {
      value: 'system',
      title: 'Sistema',
      icon: Monitor,
      preview: (
        <div className="grid h-full grid-cols-2">
          <MiniUI dark={false} />
          <MiniUI dark />
        </div>
      ),
    },
  ];
  const views: { value: FeedView; title: string; icon: typeof Sun; preview: ReactNode }[] = [
    {
      value: 'card',
      title: 'Tarjeta',
      icon: LayoutList,
      preview: (
        <div className="h-full space-y-1.5 bg-zinc-50 p-3 dark:bg-zinc-950">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-md border border-zinc-200 bg-white p-1.5 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="block h-1.5 w-2/3 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              <span className="mt-1 block h-4 rounded bg-zinc-100 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      ),
    },
    {
      value: 'compact',
      title: 'Compacta',
      icon: Rows3,
      preview: (
        <div className="h-full bg-zinc-50 p-3 dark:bg-zinc-950">
          <div className="divide-y divide-zinc-100 rounded-md border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-1.5 p-1.5">
                <span className="size-2.5 rounded bg-zinc-200 dark:bg-zinc-700" />
                <span className="h-1.5 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-700" />
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];
  return (
    <div className="space-y-6">
      <Section title="Tema" description="Elegí cómo se ve el foro. “Sistema” sigue la configuración de tu dispositivo.">
        <div role="radiogroup" aria-label="Tema" className="grid gap-3 sm:grid-cols-3">
          {themes.map((t) => (
            <ChoiceCard key={t.value} active={theme === t.value} onClick={() => setTheme(t.value)} title={t.title} icon={t.icon} preview={t.preview} />
          ))}
        </div>
      </Section>
      <Section title="Vista del feed" description="Tarjetas con vista previa o una lista compacta para ver más posts a la vez.">
        <div role="radiogroup" aria-label="Vista del feed" className="grid gap-3 sm:grid-cols-2">
          {views.map((v) => (
            <ChoiceCard key={v.value} active={view === v.value} onClick={() => setView(v.value)} title={v.title} icon={v.icon} preview={v.preview} />
          ))}
        </div>
      </Section>
    </div>
  );
}

export default function SettingsPage() {
  useDocumentTitle('Configuración');
  const { me } = useMe();
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab') as Tab | null;
  const tab: Tab = raw && TABS.some((t) => t.value === raw) ? raw : 'profile';
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);
  if (!me) return null;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">Configuración</h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">Administrá tu perfil, tu cuenta y cómo se ve el foro.</p>
      <div className="flex flex-col gap-6 md:flex-row">
        <nav aria-label="Secciones" className="no-scrollbar -mx-3 flex shrink-0 gap-1 overflow-x-auto px-3 md:mx-0 md:w-52 md:flex-col md:px-0">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setParams(t.value === 'profile' ? {} : { tab: t.value }, { replace: true })}
              aria-current={tab === t.value ? 'page' : undefined}
              className={cn(
                'flex h-9 shrink-0 items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition-colors',
                tab === t.value
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100',
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1">
          {tab === 'profile' && <ProfileTab me={me} />}
          {tab === 'account' && <AccountTab me={me} />}
          {tab === 'appearance' && <AppearanceTab />}
        </div>
      </div>
    </div>
  );
}
