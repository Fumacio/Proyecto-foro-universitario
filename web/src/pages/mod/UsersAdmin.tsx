import { Ban, Search, ShieldOff, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ROLE_LABEL, RoleBadge } from '@/components/common';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';
import { Segmented } from '@/components/ui/Segmented';
import { Spinner } from '@/components/ui/Spinner';
import { useDebounce, useDocumentTitle, useInfiniteScroll } from '@/hooks';
import { isApiError } from '@/lib/api';
import { flattenPages } from '@/lib/cache';
import { longDate, shortDate } from '@/lib/time';
import type { AdminUser, Role } from '@/lib/types';
import { cn, displayName, formatNumber } from '@/lib/utils';
import { useMe } from '@/queries/auth';
import { useAdminUsers, useBanUser, useSetRole, useUnbanUser } from '@/queries/admin';

const ROLES: Role[] = ['STUDENT', 'PROFESSOR', 'MODERATOR', 'ADMIN'];
const DURATIONS: { value: string; label: string }[] = [
  { value: '1', label: '1 día' },
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: 'perm', label: 'Permanente' },
];

function BanDialog({ user, onOpenChange }: { user: AdminUser | null; onOpenChange: (o: boolean) => void }) {
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('7');
  const [error, setError] = useState<string | null>(null);
  const ban = useBanUser();

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setReason('');
      setDuration('7');
      setError(null);
    }
  };

  const submit = () => {
    if (!user) return;
    const r = reason.trim();
    if (r.length < 3) return setError('Escribí un motivo (mínimo 3 caracteres).');
    ban.mutate(
      { id: user.id, reason: r, days: duration === 'perm' ? null : Number(duration) },
      {
        onSuccess: () => {
          toast.success(`${displayName(user)} fue suspendido/a`);
          close(false);
        },
        onError: (e) => isApiError(e) && e.status === 400 && setError(e.details?.reason ?? e.message),
      },
    );
  };

  return (
    <Dialog
      open={!!user}
      onOpenChange={close}
      title={user ? `Suspender a ${displayName(user)}` : 'Suspender'}
      description="Va a poder leer el foro pero no publicar, comentar, votar ni mandar mensajes. Recibe una notificación con el motivo."
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={submit} loading={ban.isPending}>
            <Ban />
            Suspender
          </Button>
        </>
      }
    >
      <Field label="Motivo" error={error}>
        {(p) => <Textarea {...p} value={reason} maxLength={500} rows={3} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: Spam reiterado en varias comunidades" autoFocus />}
      </Field>
      <fieldset className="mt-4">
        <legend className="mb-2 text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Duración</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DURATIONS.map((d) => (
            <label
              key={d.value}
              className={cn(
                'flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                duration === d.value
                  ? 'border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-300'
                  : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/50',
              )}
            >
              <input type="radio" name="ban-duration" value={d.value} checked={duration === d.value} onChange={() => setDuration(d.value)} className="sr-only" />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>
    </Dialog>
  );
}

function BanStatus({ u }: { u: AdminUser }) {
  if (!u.ban) return <Badge tone="emerald">Activo</Badge>;
  return (
    <span className="inline-flex flex-col">
      <Badge tone="rose" icon={Ban}>
        {u.ban.expiresAt ? `Hasta ${shortDate(u.ban.expiresAt)}` : 'Permanente'}
      </Badge>
      <span className="mt-0.5 max-w-[12rem] truncate text-[11px] text-zinc-500" title={u.ban.reason}>
        {u.ban.reason}
      </span>
    </span>
  );
}

export function UsersAdmin() {
  useDocumentTitle('Usuarios · Moderación');
  const { me } = useMe();
  const isAdmin = me?.role === 'ADMIN';
  const [params, setParams] = useSearchParams();
  const bannedOnly = params.get('banned') === '1';
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const debounced = useDebounce(search, 300);
  const q = useAdminUsers({ q: debounced.trim(), role: role || undefined, bannedOnly });
  const users = flattenPages(q.data);
  const setRoleM = useSetRole();
  const unban = useUnbanUser();
  const [banning, setBanning] = useState<AdminUser | null>(null);
  const sentinel = useInfiniteScroll<HTMLDivElement>({ hasMore: !!q.hasNextPage, loading: q.isFetchingNextPage, onLoadMore: () => void q.fetchNextPage() });
  const total = q.data?.pages[0]?.total;

  const canBan = (u: AdminUser) => u.id !== me?.id && u.role !== 'ADMIN';

  const actions = (u: AdminUser) =>
    u.ban ? (
      <Button size="xs" variant="secondary" onClick={() => unban.mutate(u.id, { onSuccess: () => toast.success(`Se levantó la suspensión de ${displayName(u)}`) })} disabled={unban.isPending}>
        <ShieldOff />
        Quitar ban
      </Button>
    ) : (
      <Button size="xs" variant="danger-ghost" onClick={() => setBanning(u)} disabled={!canBan(u)} title={!canBan(u) ? 'No se puede suspender a un admin ni a vos mismo/a' : undefined}>
        <Ban />
        Banear
      </Button>
    );

  const roleCell = (u: AdminUser) =>
    isAdmin && u.id !== me?.id ? (
      <Select
        value={u.role}
        aria-label={`Rol de ${u.username}`}
        className="h-8 w-36 text-[13px]"
        disabled={setRoleM.isPending}
        onChange={(e) =>
          setRoleM.mutate(
            { id: u.id, role: e.target.value as Role },
            { onSuccess: (r) => toast.success(`${displayName(r.user)} ahora es ${ROLE_LABEL[r.user.role].toLowerCase()}`) },
          )
        }
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </Select>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
        {ROLE_LABEL[u.role]} <RoleBadge role={u.role} />
      </span>
    );

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Segmented
          value={bannedOnly ? 'banned' : 'all'}
          onChange={(v) => setParams(v === 'banned' ? { banned: '1' } : {}, { replace: true })}
          items={[
            { value: 'all', label: 'Todos' },
            { value: 'banned', label: 'Suspendidos' },
          ]}
        />
        {!bannedOnly && (
          <>
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por usuario o email…" className="pl-9" aria-label="Buscar usuarios" />
            </div>
            <Select value={role} onChange={(e) => setRole(e.target.value as Role | '')} className="sm:w-44" aria-label="Filtrar por rol">
              <option value="">Todos los roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </>
        )}
        {total != null && <span className="text-sm text-zinc-500 sm:ml-auto">{formatNumber(total)} usuarios</span>}
      </div>

      <div className="surface overflow-hidden">
        {q.isPending ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
            ))}
          </div>
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : users.length === 0 ? (
          <EmptyState icon={Users} tone="zinc" title={bannedOnly ? 'No hay usuarios suspendidos' : 'No encontramos usuarios'} />
        ) : (
          <>
            {/* Tabla (desktop) */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50/70 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Usuario</th>
                    <th className="px-4 py-2.5 font-medium">Rol</th>
                    <th className="px-4 py-2.5 text-right font-medium">Posts</th>
                    <th className="px-4 py-2.5 text-right font-medium">Coment.</th>
                    <th className="px-4 py-2.5 font-medium">Alta</th>
                    <th className="px-4 py-2.5 font-medium">Estado</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30">
                      <td className="px-4 py-3">
                        <Link to={`/u/${u.username}`} className="flex items-center gap-3">
                          <Avatar user={u} size="md" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-zinc-900 dark:text-zinc-100">{displayName(u)}</span>
                            <span className="block truncate text-xs text-zinc-500">
                              @{u.username} · {u.email}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">{roleCell(u)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(u.postCount)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(u.commentCount)}</td>
                      <td className="px-4 py-3 text-zinc-500" title={longDate(u.createdAt)}>
                        {shortDate(u.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <BanStatus u={u} />
                      </td>
                      <td className="px-4 py-3 text-right">{actions(u)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Tarjetas (mobile) */}
            <div className="divide-y divide-zinc-100 lg:hidden dark:divide-zinc-800">
              {users.map((u) => (
                <div key={u.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar user={u} size="lg" />
                    <div className="min-w-0 flex-1">
                      <Link to={`/u/${u.username}`} className="block truncate font-medium text-zinc-900 dark:text-zinc-100">
                        {displayName(u)}
                      </Link>
                      <p className="truncate text-xs text-zinc-500">
                        @{u.username} · {u.email}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {formatNumber(u.postCount)} posts · {formatNumber(u.commentCount)} comentarios · desde {shortDate(u.createdAt)}
                      </p>
                    </div>
                    <BanStatus u={u} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    {roleCell(u)}
                    {actions(u)}
                  </div>
                </div>
              ))}
            </div>
            <div ref={sentinel} className="flex h-10 items-center justify-center">
              {q.isFetchingNextPage && <Spinner className="size-4 text-zinc-400" />}
            </div>
          </>
        )}
      </div>
      <BanDialog user={banning} onOpenChange={(o) => !o && setBanning(null)} />
    </div>
  );
}
