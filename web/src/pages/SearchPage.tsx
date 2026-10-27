import { FileText, LayoutGrid, Search, SearchX, Users } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CommunityIcon, RoleBadge } from '@/components/common';
import { PageLayout } from '@/components/layout/AppShell';
import { PopularCommunities, TrendingTags } from '@/components/layout/RightRail';
import { PostFeed } from '@/components/posts/PostFeed';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';
import { UnderlineTabs } from '@/components/ui/Segmented';
import { useDocumentTitle } from '@/hooks';
import { displayName } from '@/lib/utils';
import { useSearch } from '@/queries/misc';
import { usePostsFeed } from '@/queries/posts';

type Tab = 'posts' | 'users' | 'communities';

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton className="size-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const rawTab = params.get('tab') as Tab | null;
  const tab: Tab = rawTab === 'users' || rawTab === 'communities' ? rawTab : 'posts';
  const [input, setInput] = useState(q);
  useEffect(() => {
    setInput(q);
  }, [q]);
  useDocumentTitle(q ? `“${q}” · Búsqueda` : 'Buscar');

  const enabled = q.length >= 2;
  const quick = useSearch(enabled ? q : '');
  const posts = usePostsFeed({ q, sort: 'hot' }, { enabled: enabled && tab === 'posts' });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = input.trim();
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (v) n.set('q', v);
      else n.delete('q');
      return n;
    });
  };

  const setTab = (t: Tab) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (t === 'posts') n.delete('tab');
        else n.set('tab', t);
        return n;
      },
      { replace: true },
    );

  return (
    <PageLayout aside={<><PopularCommunities /><TrendingTags /></>}>
      <form onSubmit={submit} className="mb-4 flex gap-2" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-zinc-400" />
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Buscar posts, usuarios o comunidades…" className="h-11 pl-10 text-[15px]" aria-label="Buscar" autoFocus={!q} />
        </div>
        <Button type="submit" size="lg">
          Buscar
        </Button>
      </form>

      {!enabled ? (
        <div className="surface">
          <EmptyState icon={Search} title="¿Qué estás buscando?" description="Escribí al menos 2 caracteres para buscar en todo el foro." />
        </div>
      ) : (
        <>
          <h1 className="mb-1 text-lg font-semibold text-zinc-950 dark:text-white">
            Resultados para <span className="text-brand-600 dark:text-brand-400">“{q}”</span>
          </h1>
          <UnderlineTabs
            className="mb-4"
            value={tab}
            onChange={setTab}
            items={[
              { value: 'posts', label: 'Posts', icon: FileText },
              { value: 'users', label: 'Usuarios', icon: Users, count: quick.data?.users.length },
              { value: 'communities', label: 'Comunidades', icon: LayoutGrid, count: quick.data?.communities.length },
            ]}
          />
          {tab === 'posts' && <PostFeed query={posts} empty={{ icon: SearchX, title: 'No encontramos posts', description: 'Probá con otras palabras o revisá la ortografía.' }} />}
          {tab !== 'posts' && (
            <div className="surface overflow-hidden">
              {quick.isPending ? (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {Array.from({ length: 4 }, (_, i) => (
                    <RowSkeleton key={i} />
                  ))}
                </div>
              ) : quick.isError ? (
                <ErrorState error={quick.error} onRetry={() => void quick.refetch()} />
              ) : tab === 'users' ? (
                quick.data.users.length === 0 ? (
                  <EmptyState icon={SearchX} tone="zinc" title="No encontramos usuarios" />
                ) : (
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {quick.data.users.map((u) => (
                      <li key={u.id}>
                        <Link to={`/u/${u.username}`} className="flex items-center gap-3 p-3.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                          <Avatar user={u} size="lg" />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 font-medium text-zinc-900 dark:text-zinc-100">
                              {displayName(u)} <RoleBadge role={u.role} />
                            </p>
                            <p className="text-sm text-zinc-500">@{u.username}</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )
              ) : quick.data.communities.length === 0 ? (
                <EmptyState icon={SearchX} tone="zinc" title="No encontramos comunidades" />
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {quick.data.communities.map((c) => (
                    <li key={c.id}>
                      <Link to={`/c/${c.slug}`} className="flex items-center gap-3 p-3.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                        <CommunityIcon community={c} size="lg" />
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{c.name}</p>
                          <p className="text-sm text-zinc-500">c/{c.slug}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </PageLayout>
  );
}
