import { Hash, Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useParams } from 'react-router';
import { PageLayout } from '@/components/layout/AppShell';
import { PopularCommunities, TrendingTags } from '@/components/layout/RightRail';
import { FeedControls, PostFeed, useFeedParams } from '@/components/posts/PostFeed';
import { Skeleton } from '@/components/ui/misc';
import { useDocumentTitle } from '@/hooks';
import { plural } from '@/lib/utils';
import { useTags } from '@/queries/communities';
import { usePostsFeed } from '@/queries/posts';

export function TagPage() {
  const { slug = '' } = useParams();
  const tags = useTags();
  const tag = tags.data?.find((t) => t.slug === slug);
  const { sort, t, setSort, setT } = useFeedParams();
  const feed = usePostsFeed({ tag: slug, sort, t });
  useDocumentTitle(`#${tag?.name ?? slug}`);

  return (
    <PageLayout aside={<><TrendingTags /><PopularCommunities /></>}>
      <div className="surface relative mb-4 overflow-hidden p-5" style={{ '--chip': tag?.color ?? '#7d62f4' } as CSSProperties}>
        <div className="chip-tint absolute inset-0 opacity-60" />
        <div className="relative flex items-center gap-4">
          <span className="chip-tint grid size-14 shrink-0 place-items-center rounded-2xl">
            <Hash className="size-7" strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Etiqueta</p>
            <h1 className="truncate text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">{tag?.name ?? slug}</h1>
            {tags.isPending ? <Skeleton className="mt-1 h-4 w-20" /> : tag && <p className="text-sm text-zinc-500 dark:text-zinc-400">{plural(tag.postCount, 'post')}</p>}
          </div>
        </div>
      </div>
      <FeedControls sort={sort} t={t} onSort={setSort} onT={setT} className="mb-4" />
      <PostFeed query={feed} empty={{ icon: Sparkles, title: 'No hay posts con esta etiqueta', description: 'Cuando alguien publique con #' + (tag?.name ?? slug) + ' lo vas a ver acá.' }} />
    </PageLayout>
  );
}
