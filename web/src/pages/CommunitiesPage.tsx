import { FileText, LayoutGrid, Search, SearchX, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CommunityIcon } from '@/components/common';
import { JoinButton } from '@/components/communities/JoinButton';
import { PageHeader } from '@/components/layout/AppShell';
import { Input } from '@/components/ui/Input';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';
import { Segmented } from '@/components/ui/Segmented';
import { useDocumentTitle } from '@/hooks';
import type { Community } from '@/lib/types';
import { formatCount } from '@/lib/utils';
import { useMe } from '@/queries/auth';
import { useCommunities } from '@/queries/communities';

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function CommunityCard({ c }: { c: Community }) {
  return (
    <article className="group surface relative flex flex-col overflow-hidden transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lift dark:hover:border-zinc-700">
      <div
        className="relative h-16"
        style={{ background: `linear-gradient(135deg, ${c.color}, color-mix(in oklab, ${c.color} 55%, #1e1b4b))` }}
      >
        <div
          className="absolute inset-0 opacity-25"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,.7) 1px, transparent 0)', backgroundSize: '12px 12px' }}
        />
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4">
        <div className="-mt-7 flex items-end justify-between gap-2">
          <span className="rounded-2xl bg-white p-1 shadow-sm dark:bg-zinc-900">
            <CommunityIcon community={c} size="lg" className="size-12 text-2xl" />
          </span>
          <JoinButton community={c} size="xs" className="mb-0.5" />
        </div>
        <h2 className="mt-2.5 font-semibold text-zinc-950 dark:text-white">
          <Link to={`/c/${c.slug}`} className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-brand-500">
            {c.name}
          </Link>
        </h2>
        <p className="text-xs text-zinc-500">c/{c.slug}</p>
        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{c.description}</p>
        <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" />
            {formatCount(c.memberCount)} miembros
          </span>
          <span className="inline-flex items-center gap-1">
            <FileText className="size-3.5" />
            {formatCount(c.postCount)} posts
          </span>
        </div>
      </div>
    </article>
  );
}

export function CommunitiesPage() {
  useDocumentTitle('Comunidades');
  const { me } = useMe();
  const q = useCommunities();
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState<'all' | 'mine'>('all');

  const list = useMemo(() => {
    const items = q.data ?? [];
    const f = normalize(filter.trim());
    return items
      .filter((c) => (tab === 'mine' ? c.isMember : true))
      .filter((c) => !f || normalize(`${c.name} ${c.slug} ${c.description}`).includes(f));
  }, [q.data, filter, tab]);

  return (
    <div>
      <PageHeader
        title="Comunidades"
        description="Materias, carreras y espacios temáticos de la UTN FRT. Unite para armar tu feed."
        icon={
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
            <LayoutGrid className="size-5" />
          </span>
        }
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar comunidades…" className="pl-9" aria-label="Filtrar comunidades" />
        </div>
        {me && (
          <Segmented
            items={[
              { value: 'all', label: 'Todas' },
              { value: 'mine', label: 'Mis comunidades', count: q.data?.filter((c) => c.isMember).length },
            ]}
            value={tab}
            onChange={setTab}
          />
        )}
      </div>

      {q.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="surface overflow-hidden">
              <Skeleton className="h-16 rounded-none" />
              <div className="space-y-2.5 p-4">
                <Skeleton className="-mt-10 size-12 rounded-2xl" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : q.isError ? (
        <div className="surface">
          <ErrorState error={q.error} onRetry={() => void q.refetch()} title="No pudimos cargar las comunidades" />
        </div>
      ) : list.length === 0 ? (
        <div className="surface">
          {tab === 'mine' && !filter ? (
            <EmptyState icon={Users} title="Todavía no te uniste a ninguna comunidad" description="Explorá la lista y sumate a las de tus materias." />
          ) : (
            <EmptyState icon={SearchX} tone="zinc" title="Sin resultados" description={`No hay comunidades que coincidan con “${filter}”.`} />
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {list.map((c) => (
            <CommunityCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
