import { CalendarDays, FileText, LayoutGrid, MessageSquare, PenLine, ScrollText, Sparkles, Users } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { loginPath } from '@/lib/navigation';
import { longDate } from '@/lib/time';
import type { Community } from '@/lib/types';
import { cn, formatCount, formatNumber } from '@/lib/utils';
import { useMe } from '@/queries/auth';
import { useCommunities, useTags } from '@/queries/communities';
import { usePublicStats } from '@/queries/misc';
import { CommunityIcon, LogoMark, TagChip } from '../common';
import { JoinButton } from '../communities/JoinButton';
import { InstallAppCard } from '../pwa/InstallApp';
import { buttonVariants } from '../ui/Button';
import { Card, CardHeader, Skeleton } from '../ui/misc';

export function WelcomeCard() {
  const { me } = useMe();
  return (
    <Card className="overflow-hidden">
      <div className="relative h-20 overflow-hidden bg-linear-to-br from-brand-500 via-violet-600 to-indigo-700">
        <div
          className="absolute inset-0 opacity-30"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,.55) 1px, transparent 0)', backgroundSize: '14px 14px' }}
        />
        <div className="absolute -bottom-10 -right-6 size-32 rounded-full bg-white/15 blur-2xl" />
        <LogoMark className="absolute bottom-3 left-4 size-10 drop-shadow-lg" />
      </div>
      <div className="p-4">
        <h2 className="font-semibold text-zinc-950 dark:text-white">{me ? `¡Hola, ${me.displayName || me.username}!` : 'Bienvenido al Foro UTN'}</h2>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {me
            ? '¿Tenés una duda de cursada, un apunte o algo para compartir? Publicalo y la comunidad te ayuda.'
            : 'Apuntes, consultas de parciales, encuestas y todo lo que pasa en la UTN Facultad Regional Tucumán.'}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {me ? (
            <Link to="/submit" className={buttonVariants({ className: 'w-full' })}>
              <PenLine />
              Crear post
            </Link>
          ) : (
            <>
              <Link to="/register" className={buttonVariants({ className: 'w-full' })}>
                Crear cuenta
              </Link>
              <Link to={loginPath('/')} className={buttonVariants({ variant: 'secondary', className: 'w-full' })}>
                Iniciar sesión
              </Link>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

export function PopularCommunities({ limit = 5 }: { limit?: number }) {
  const q = useCommunities();
  return (
    <Card>
      <CardHeader
        title="Comunidades populares"
        action={
          <Link to="/c" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
            Ver todas
          </Link>
        }
      />
      <div className="p-2 pt-2">
        {q.isPending ? (
          Array.from({ length: limit }, (_, i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="size-8 rounded-xl" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
            </div>
          ))
        ) : q.isError ? (
          <p className="px-2 py-3 text-sm text-zinc-400">No se pudieron cargar.</p>
        ) : (
          q.data.slice(0, limit).map((c, i) => (
            <Link key={c.id} to={`/c/${c.slug}`} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
              <span className="w-3 text-center text-xs font-semibold tabular-nums text-zinc-400">{i + 1}</span>
              <CommunityIcon community={c} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{c.name}</span>
                <span className="block text-xs text-zinc-500">{formatCount(c.memberCount)} miembros</span>
              </span>
              <JoinButton community={c} size="xs" />
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}

export function TrendingTags({ limit = 14 }: { limit?: number }) {
  const q = useTags();
  if (q.isError) return null;
  return (
    <Card>
      <CardHeader title="Etiquetas en tendencia" />
      <div className="flex flex-wrap gap-1.5 p-4 pt-3">
        {q.isPending
          ? Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-6 rounded-full" style={{ width: `${48 + ((i * 17) % 40)}px` }} />)
          : q.data.slice(0, limit).map((t) => <TagChip key={t.id} tag={t} />)}
        {q.data?.length === 0 && <p className="text-sm text-zinc-400">Todavía no hay etiquetas.</p>}
      </div>
    </Card>
  );
}

export function ForumStats() {
  const q = usePublicStats();
  const items = [
    { label: 'Usuarios', value: q.data?.users, icon: Users },
    { label: 'Posts', value: q.data?.posts, icon: FileText },
    { label: 'Comentarios', value: q.data?.comments, icon: MessageSquare },
    { label: 'Comunidades', value: q.data?.communities, icon: LayoutGrid },
  ];
  if (q.isError) return null;
  return (
    <Card>
      <CardHeader title="El foro en números" />
      <div className="grid grid-cols-2 gap-2 p-4 pt-3">
        {items.map((it) => (
          <div key={it.label} className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/40">
            <it.icon className="size-4 text-brand-500" />
            {q.isPending ? (
              <Skeleton className="mt-2 h-5 w-12" />
            ) : (
              <p className="mt-1.5 text-lg font-bold tabular-nums tracking-tight text-zinc-950 dark:text-white">{formatNumber(it.value ?? 0)}</p>
            )}
            <p className="text-xs text-zinc-500">{it.label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function RailFooter() {
  return (
    <p className="px-2 text-xs leading-relaxed text-zinc-400 dark:text-zinc-500">
      Foro UTN · Hecho por y para la comunidad de la UTN Facultad Regional Tucumán. Sé respetuoso y ayudá a mantener el foro sano. 💜
    </p>
  );
}

export function HomeRail() {
  return (
    <>
      <WelcomeCard />
      <InstallAppCard />
      <PopularCommunities />
      <TrendingTags />
      <ForumStats />
      <RailFooter />
    </>
  );
}

export function CommunityAbout({ community, className, showJoin = false }: { community: Community; className?: string; showJoin?: boolean }) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="h-2" style={{ background: community.color }} />
      <div className="p-4">
        <div className="flex items-center gap-3">
          <CommunityIcon community={community} size="lg" />
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-zinc-950 dark:text-white">{community.name}</h2>
            <p className="text-xs text-zinc-500">c/{community.slug}</p>
          </div>
        </div>
        {community.description && <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{community.description}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/40">
            <p className="text-lg font-bold tabular-nums text-zinc-950 dark:text-white">{formatNumber(community.memberCount)}</p>
            <p className="text-xs text-zinc-500">Miembros</p>
          </div>
          <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/40">
            <p className="text-lg font-bold tabular-nums text-zinc-950 dark:text-white">{formatNumber(community.postCount)}</p>
            <p className="text-xs text-zinc-500">Posts</p>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
          <CalendarDays className="size-3.5" />
          Creada el {longDate(community.createdAt)}
        </p>
        {showJoin && (
          <div className="mt-4 flex gap-2">
            <JoinButton community={community} size="md" className="flex-1" />
            <Link to={`/submit?community=${community.slug}`} className={buttonVariants({ variant: 'secondary', className: 'flex-1' })}>
              <PenLine />
              Crear post
            </Link>
          </div>
        )}
      </div>
      {community.rules.length > 0 && <CommunityRules community={community} />}
    </Card>
  );
}

export function CommunityRules({ community }: { community: Community }) {
  return (
    <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">
      <h3 className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        <ScrollText className="size-3.5" />
        Reglas
      </h3>
      <ol className="space-y-2.5">
        {community.rules.map((r, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
            <span
              className="chip-tint grid size-5 shrink-0 place-items-center rounded-md text-[11px] font-bold"
              style={{ '--chip': community.color } as CSSProperties}
            >
              {i + 1}
            </span>
            <span className="leading-snug">{r}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function NewHereHint() {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        <Sparkles className="size-4 text-brand-500" /> Tip
      </p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Usá etiquetas para que tu post llegue a más gente.</p>
    </Card>
  );
}
