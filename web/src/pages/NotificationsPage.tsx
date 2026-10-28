import { Bell, BellOff, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { PageHeader, PageLayout } from '@/components/layout/AppShell';
import { PopularCommunities } from '@/components/layout/RightRail';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';
import { Segmented } from '@/components/ui/Segmented';
import { Spinner } from '@/components/ui/Spinner';
import { useDocumentTitle, useInfiniteScroll } from '@/hooks';
import { flattenPages } from '@/lib/cache';
import { timeBucket, type TimeBucket } from '@/lib/time';
import type { Notification } from '@/lib/types';
import { useMe } from '@/queries/auth';
import { useMarkNotificationsRead, useNotifications } from '@/queries/notifications';

const BUCKET_LABEL: Record<TimeBucket, string> = { today: 'Hoy', week: 'Esta semana', older: 'Anteriores' };

export function NotificationsPage() {
  useDocumentTitle('Notificaciones');
  const { me } = useMe();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const q = useNotifications(filter === 'unread');
  const markRead = useMarkNotificationsRead();
  const items = flattenPages(q.data);
  const unread = me?.unreadNotifications ?? 0;
  const sentinel = useInfiniteScroll<HTMLDivElement>({ hasMore: !!q.hasNextPage, loading: q.isFetchingNextPage, onLoadMore: () => void q.fetchNextPage() });

  const groups: { bucket: TimeBucket; items: Notification[] }[] = [];
  for (const n of items) {
    const b = timeBucket(n.createdAt);
    const g = groups.find((x) => x.bucket === b);
    if (g) g.items.push(n);
    else groups.push({ bucket: b, items: [n] });
  }

  const onOpen = (n: Notification) => {
    if (!n.read) markRead.mutate([n.id]);
  };

  return (
    <PageLayout aside={<PopularCommunities />}>
      <PageHeader
        title="Notificaciones"
        description={unread ? `Tenés ${unread} sin leer` : 'Estás al día 🎉'}
        icon={
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
            <Bell className="size-5" />
          </span>
        }
        actions={
          <Button variant="secondary" size="sm" onClick={() => markRead.mutate(undefined)} disabled={!unread} loading={markRead.isPending && !markRead.variables}>
            <CheckCheck />
            Marcar todo como leído
          </Button>
        }
      />
      <Segmented
        className="mb-4"
        value={filter}
        onChange={setFilter}
        items={[
          { value: 'all', label: 'Todas' },
          { value: 'unread', label: 'Sin leer', count: unread || undefined },
        ]}
      />
      <div className="surface overflow-hidden">
        {q.isPending ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex gap-3 p-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={BellOff}
            tone="zinc"
            title={filter === 'unread' ? 'No tenés notificaciones sin leer' : 'Todavía no tenés notificaciones'}
            description="Te avisamos cuando alguien responda tus posts, te mencione o te siga."
          />
        ) : (
          <div className="p-2">
            {groups.map((g) => (
              <section key={g.bucket} className="mb-2 last:mb-0">
                <h2 className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{BUCKET_LABEL[g.bucket]}</h2>
                <div className="space-y-0.5">
                  {g.items.map((n) => (
                    <NotificationItem key={n.id} n={n} onOpen={onOpen} />
                  ))}
                </div>
              </section>
            ))}
            <div ref={sentinel} className="flex h-12 items-center justify-center">
              {q.isFetchingNextPage && <Spinner className="text-zinc-400" />}
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
