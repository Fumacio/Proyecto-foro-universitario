import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { CalendarRange, ChevronDown, Flame, LayoutList, MessagesSquare, Rows3, Sparkles, TrendingUp, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useInfiniteScroll } from '@/hooks';
import { flattenPages } from '@/lib/cache';
import { useFeedView } from '@/lib/store';
import type { Paginated, PostListItem, PostSort, TimeRange } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Menu, MenuContent, MenuRadioGroup, MenuRadioItem, MenuTrigger } from '../ui/Menu';
import { EmptyState, ErrorState } from '../ui/misc';
import { Tooltip } from '../ui/Popover';
import { Segmented } from '../ui/Segmented';
import { Spinner } from '../ui/Spinner';
import { PostCard, PostCardSkeleton, PostCompactRow } from './PostCard';

type FeedQuery = UseInfiniteQueryResult<InfiniteData<Paginated<PostListItem>>, Error>;

export function PostFeed({
  query,
  showCommunity = true,
  empty,
}: {
  query: FeedQuery;
  showCommunity?: boolean;
  empty?: { icon: LucideIcon; title: string; description?: string; action?: ReactNode };
}) {
  const [view] = useFeedView();
  const posts = flattenPages(query.data);
  const sentinel = useInfiniteScroll<HTMLDivElement>({
    hasMore: !!query.hasNextPage,
    loading: query.isFetchingNextPage,
    onLoadMore: () => void query.fetchNextPage(),
  });
  const compact = view === 'compact';

  if (query.isPending) {
    return compact ? (
      <div className="surface divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
        {Array.from({ length: 8 }, (_, i) => (
          <PostCardSkeleton key={i} compact />
        ))}
      </div>
    ) : (
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (query.isError && posts.length === 0) {
    return (
      <div className="surface">
        <ErrorState error={query.error} onRetry={() => void query.refetch()} title="No pudimos cargar los posts" />
      </div>
    );
  }

  if (posts.length === 0) {
    const e = empty ?? { icon: Sparkles, title: 'Todavía no hay posts', description: 'Sé la primera persona en publicar algo.' };
    return (
      <div className="surface">
        <EmptyState icon={e.icon} title={e.title} description={e.description} action={e.action} />
      </div>
    );
  }

  return (
    <div>
      {compact ? (
        <div className="surface divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800/80">
          {posts.map((p) => (
            <PostCompactRow key={p.id} post={p} showCommunity={showCommunity} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} showCommunity={showCommunity} />
          ))}
        </div>
      )}
      <div ref={sentinel} className="flex h-16 items-center justify-center text-sm text-zinc-400">
        {query.isFetchingNextPage ? (
          <Spinner />
        ) : query.isFetchNextPageError ? (
          <button type="button" className="font-medium text-brand-600 hover:underline" onClick={() => void query.fetchNextPage()}>
            Error al cargar más. Reintentar
          </button>
        ) : !query.hasNextPage && posts.length > 5 ? (
          <span>Llegaste al final · {posts.length} posts</span>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------- Controles de orden ---------------- */

const SORTS: { value: PostSort; label: string; icon: LucideIcon }[] = [
  { value: 'hot', label: 'Hot', icon: Flame },
  { value: 'new', label: 'Nuevos', icon: Sparkles },
  { value: 'top', label: 'Top', icon: TrendingUp },
  { value: 'comments', label: 'Más comentados', icon: MessagesSquare },
];

export const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'day', label: 'Hoy' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
  { value: 'year', label: 'Este año' },
  { value: 'all', label: 'Siempre' },
];

const SORT_VALUES = SORTS.map((s) => s.value);
const TIME_VALUES = TIME_RANGES.map((t) => t.value);

/** Lee/escribe `sort`, `t` y `tag` en la URL. */
export function useFeedParams(defaultSort: PostSort = 'hot') {
  const [params, setParams] = useSearchParams();
  const rawSort = params.get('sort') as PostSort | null;
  const rawT = params.get('t') as TimeRange | null;
  const sort: PostSort = rawSort && SORT_VALUES.includes(rawSort) ? rawSort : defaultSort;
  const t: TimeRange = rawT && TIME_VALUES.includes(rawT) ? rawT : sort === 'top' ? 'week' : 'all';
  const tag = params.get('tag') ?? undefined;

  const update = (patch: Record<string, string | undefined>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v === undefined) next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true },
    );
  };

  return {
    sort,
    t,
    tag,
    setSort: (s: PostSort) => update({ sort: s === defaultSort ? undefined : s, t: undefined }),
    setT: (v: TimeRange) => update({ t: v }),
    setTag: (v: string | undefined) => update({ tag: v }),
  };
}

export function FeedControls({
  sort,
  t,
  onSort,
  onT,
  className,
  sorts = SORTS.map((s) => s.value),
  right,
}: {
  sort: PostSort;
  t: TimeRange;
  onSort: (s: PostSort) => void;
  onT: (t: TimeRange) => void;
  className?: string;
  sorts?: PostSort[];
  right?: ReactNode;
}) {
  const [view, setView] = useFeedView();
  const showTime = sort === 'top' || sort === 'comments';
  const timeLabel = TIME_RANGES.find((r) => r.value === t)?.label ?? 'Siempre';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="no-scrollbar -mx-1 flex min-w-0 items-center gap-2 overflow-x-auto px-1 py-0.5">
        {sorts.length > 0 && (
          <Segmented
            ariaLabel="Ordenar posts"
            items={SORTS.filter((s) => sorts.includes(s.value))}
            value={sort}
            onChange={onSort}
            iconOnlyMobile
          />
        )}
        {showTime && (
          <Menu>
            <MenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 text-[13px] font-medium text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                aria-label={`Período: ${timeLabel}`}
              >
                <CalendarRange className="size-4 text-zinc-400" />
                {timeLabel}
                <ChevronDown className="size-3.5 text-zinc-400" />
              </button>
            </MenuTrigger>
            <MenuContent align="start" className="min-w-40">
              <MenuRadioGroup value={t} onValueChange={(v) => onT(v as TimeRange)}>
                {TIME_RANGES.map((r) => (
                  <MenuRadioItem key={r.value} value={r.value}>
                    {r.label}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuContent>
          </Menu>
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {right}
        <div className="inline-flex rounded-xl border border-zinc-200 bg-zinc-100/70 p-0.5 dark:border-zinc-800 dark:bg-zinc-900/80" role="group" aria-label="Vista del feed">
          {(
            [
              { v: 'card', icon: LayoutList, label: 'Vista tarjeta' },
              { v: 'compact', icon: Rows3, label: 'Vista compacta' },
            ] as const
          ).map((o) => (
            <Tooltip key={o.v} content={o.label}>
              <button
                type="button"
                aria-label={o.label}
                aria-pressed={view === o.v}
                onClick={() => setView(o.v)}
                className={cn(
                  'grid size-8 place-items-center rounded-[10px] transition-colors',
                  view === o.v
                    ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700/80'
                    : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200',
                )}
              >
                <o.icon className="size-4" />
              </button>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  );
}
