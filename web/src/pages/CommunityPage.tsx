import { ChevronDown, Paperclip, PenLine, SearchX, Sparkles, Users, FileText } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { CommunityIcon } from '@/components/common';
import { JoinButton } from '@/components/communities/JoinButton';
import { PageLayout } from '@/components/layout/AppShell';
import { CommunityAbout, CommunityRules, TrendingTags } from '@/components/layout/RightRail';
import { FeedControls, PostFeed, useFeedParams } from '@/components/posts/PostFeed';
import { buttonVariants } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';
import { useDocumentTitle } from '@/hooks';
import { isApiError } from '@/lib/api';
import { formatCount } from '@/lib/utils';
import { useCommunity } from '@/queries/communities';
import { usePostsFeed } from '@/queries/posts';

export function CommunityPage() {
  const { slug = '' } = useParams();
  const q = useCommunity(slug);
  const { sort, t, setSort, setT, withFiles, setWithFiles } = useFeedParams();
  const feed = usePostsFeed({ community: slug, sort, t, hasAttachments: withFiles });
  /** En la comunidad de apuntes el filtro "Con archivos" se destaca con un aviso. */
  const isResources = slug === 'apuntes';
  const c = q.data;
  useDocumentTitle(c ? c.name : 'Comunidad');

  if (q.isError) {
    const notFound = isApiError(q.error) && q.error.status === 404;
    return (
      <div className="surface">
        {notFound ? (
          <EmptyState
            icon={SearchX}
            tone="zinc"
            title="Esta comunidad no existe"
            description={`No encontramos c/${slug}. Puede que la hayan renombrado o borrado.`}
            action={
              <Link to="/c" className={buttonVariants()}>
                Ver comunidades
              </Link>
            }
          />
        ) : (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        )}
      </div>
    );
  }

  return (
    <PageLayout aside={c ? <><CommunityAbout community={c} /><TrendingTags limit={10} /></> : undefined}>
      {/* Encabezado */}
      <div className="surface mb-4 overflow-hidden">
        <div
          className="relative h-24 sm:h-32"
          style={{
            background: c
              ? `linear-gradient(120deg, ${c.color}, color-mix(in oklab, ${c.color} 50%, #1e1b4b) 70%, color-mix(in oklab, ${c.color} 30%, #0f0a2e))`
              : undefined,
          }}
        >
          {!c && <Skeleton className="size-full rounded-none" />}
          <div
            className="absolute inset-0 opacity-25"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,.7) 1px, transparent 0)', backgroundSize: '14px 14px' }}
          />
          {c && <span className="absolute -bottom-6 right-6 select-none text-[7rem] leading-none opacity-20 blur-[1px]">{c.icon}</span>}
        </div>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3 px-4 pb-4 sm:px-5">
          <span className="-mt-10 rounded-[1.6rem] bg-white p-1.5 shadow-md sm:-mt-12 dark:bg-zinc-900">
            {c ? <CommunityIcon community={c} size="xl" className="size-16 text-3xl sm:size-20 sm:text-4xl" /> : <Skeleton className="size-16 rounded-3xl sm:size-20" />}
          </span>
          <div className="min-w-0 flex-1 pt-2">
            {c ? (
              <>
                <h1 className="truncate text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">{c.name}</h1>
                <p className="flex flex-wrap items-center gap-x-3 text-sm text-zinc-500 dark:text-zinc-400">
                  <span>c/{c.slug}</span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" /> {formatCount(c.memberCount)} miembros
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <FileText className="size-3.5" /> {formatCount(c.postCount)} posts
                  </span>
                </p>
              </>
            ) : (
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            )}
          </div>
          {c && (
            <div className="flex w-full gap-2 sm:w-auto">
              <JoinButton community={c} size="md" className="flex-1 sm:flex-none" />
              <Link to={`/submit?community=${c.slug}`} className={buttonVariants({ variant: 'secondary', className: 'flex-1 sm:flex-none' })}>
                <PenLine />
                Crear post
              </Link>
            </div>
          )}
        </div>
        {c?.description && <p className="px-4 pb-4 text-sm leading-relaxed text-zinc-600 sm:px-5 xl:hidden dark:text-zinc-400">{c.description}</p>}
        {c && c.rules.length > 0 && (
          <details className="group border-t border-zinc-100 xl:hidden dark:border-zinc-800">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-zinc-700 sm:px-5 dark:text-zinc-300 [&::-webkit-details-marker]:hidden">
              Reglas de la comunidad ({c.rules.length})
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            </summary>
            <CommunityRules community={c} />
          </details>
        )}
      </div>

      {isResources && !withFiles && (
        <button
          type="button"
          onClick={() => setWithFiles(true)}
          className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-brand-200/70 bg-linear-to-r from-brand-50 to-white p-3 text-left transition-colors hover:border-brand-300 dark:border-brand-500/20 dark:from-brand-500/10 dark:to-transparent dark:hover:border-brand-500/40"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-brand-600 ring-1 ring-brand-200 dark:bg-zinc-900 dark:text-brand-300 dark:ring-brand-500/30">
            <Paperclip className="size-4" />
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="block font-semibold text-zinc-900 dark:text-zinc-100">¿Buscás apuntes para descargar?</span>
            <span className="block text-[13px] text-zinc-500 dark:text-zinc-400">Mostrá solo los posts con PDF, resúmenes y otros archivos.</span>
          </span>
          <span className="hidden shrink-0 text-[13px] font-semibold text-brand-600 sm:inline dark:text-brand-400">Ver con archivos</span>
        </button>
      )}
      <FeedControls sort={sort} t={t} onSort={setSort} onT={setT} withFiles={withFiles} onWithFiles={setWithFiles} className="mb-4" />
      <PostFeed
        query={feed}
        showCommunity={false}
        empty={withFiles ? {
          icon: Paperclip,
          title: 'Todavía no hay posts con archivos acá',
          description: 'Compartí tus apuntes o resúmenes: adjuntá PDF, Word, Excel y más al crear un post.',
          action: c && (
            <Link to={`/submit?community=${c.slug}`} className={buttonVariants()}>
              <PenLine />
              Compartir apuntes
            </Link>
          ),
        } : {
          icon: Sparkles,
          title: 'Esta comunidad está esperando su primer post',
          description: 'Arrancá la conversación: compartí un apunte o hacé una pregunta.',
          action: c && (
            <Link to={`/submit?community=${c.slug}`} className={buttonVariants()}>
              <PenLine />
              Crear post
            </Link>
          ),
        }}
      />
    </PageLayout>
  );
}
