import { Bookmark, CircleQuestionMark, Compass, LayoutGrid, Rss, Sparkles, X } from 'lucide-react';
import { Link } from 'react-router';
import { TagChip } from '@/components/common';
import { HomeRail, PopularCommunities, TrendingTags } from '@/components/layout/RightRail';
import { PageHeader, PageLayout } from '@/components/layout/AppShell';
import { FeedControls, PostFeed, useFeedParams } from '@/components/posts/PostFeed';
import { buttonVariants } from '@/components/ui/Button';
import { useDocumentTitle } from '@/hooks';
import { loginPath } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { useMe } from '@/queries/auth';
import { useTags } from '@/queries/communities';
import { useBookmarks, usePostsFeed } from '@/queries/posts';

function TagFilter({ selected, onSelect }: { selected?: string; onSelect: (slug: string | undefined) => void }) {
  const tags = useTags();
  if (!tags.data?.length) return null;
  const list = tags.data.slice(0, 14);
  const selectedTag = selected && !list.some((t) => t.slug === selected) ? tags.data.find((t) => t.slug === selected) : undefined;
  return (
    <div className="no-scrollbar -mx-3 mb-4 flex items-center gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0">
      <button
        type="button"
        onClick={() => onSelect(undefined)}
        aria-pressed={!selected}
        className={cn(
          'inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold transition-colors',
          !selected
            ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700',
        )}
      >
        Todo
      </button>
      {selectedTag && <TagChip tag={selectedTag} active onClick={() => onSelect(undefined)} className="shrink-0" />}
      {list.map((t) => (
        <TagChip
          key={t.id}
          tag={t}
          active={selected === t.slug}
          onClick={() => onSelect(selected === t.slug ? undefined : t.slug)}
          className={cn('shrink-0', selected && selected !== t.slug && 'opacity-60 hover:opacity-100')}
        />
      ))}
      {selected && (
        <button
          type="button"
          onClick={() => onSelect(undefined)}
          className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <X className="size-3" /> Quitar filtro
        </button>
      )}
    </div>
  );
}

function WelcomeStrip() {
  const { me, isLoading } = useMe();
  if (me || isLoading) return null;
  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl bg-linear-to-br from-brand-600 via-violet-600 to-indigo-700 p-5 text-white shadow-lg shadow-brand-900/10 xl:hidden">
      <div
        className="absolute inset-0 opacity-25"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,.6) 1px, transparent 0)', backgroundSize: '16px 16px' }}
      />
      <div className="absolute -right-10 -top-10 size-40 rounded-full bg-fuchsia-400/30 blur-2xl" />
      <div className="relative">
        <h1 className="text-lg font-bold tracking-tight">Bienvenido al Foro UTN 👋</h1>
        <p className="mt-1 max-w-md text-sm text-white/80">Apuntes, dudas de parciales y todo lo que pasa en la UTN FRT. Sumate para publicar, comentar y votar.</p>
        <div className="mt-4 flex gap-2">
          <Link to="/register" className="inline-flex h-9 items-center rounded-xl bg-white px-4 text-sm font-semibold text-brand-700 shadow-sm hover:bg-brand-50">
            Crear cuenta
          </Link>
          <Link to={loginPath('/')} className="inline-flex h-9 items-center rounded-xl bg-white/15 px-4 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur hover:bg-white/25">
            Iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  useDocumentTitle('Inicio');
  const { sort, t, tag, setSort, setT, setTag } = useFeedParams();
  const query = usePostsFeed({ sort, t, tag });
  return (
    <PageLayout aside={<HomeRail />}>
      <WelcomeStrip />
      <FeedControls sort={sort} t={t} onSort={setSort} onT={setT} className="mb-3" />
      <TagFilter selected={tag} onSelect={setTag} />
      <PostFeed
        query={query}
        empty={
          tag
            ? { icon: Sparkles, title: 'No hay posts con esta etiqueta', description: 'Probá con otra etiqueta o quitá el filtro.' }
            : { icon: Sparkles, title: 'Todavía no hay posts', description: 'Sé la primera persona en publicar algo.', action: <Link to="/submit" className={buttonVariants()}>Crear post</Link> }
        }
      />
    </PageLayout>
  );
}

export function FollowingPage() {
  useDocumentTitle('Siguiendo');
  const { sort, t, setSort, setT } = useFeedParams('new');
  const query = usePostsFeed({ sort, t, feed: 'following' });
  return (
    <PageLayout aside={<><PopularCommunities /><TrendingTags /></>}>
      <PageHeader
        title="Siguiendo"
        description="Posts de tus comunidades y de la gente que seguís."
        icon={
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
            <Rss className="size-5" />
          </span>
        }
      />
      <FeedControls sort={sort} t={t} onSort={setSort} onT={setT} className="mb-4" />
      <PostFeed
        query={query}
        empty={{
          icon: Compass,
          title: 'Tu feed está vacío',
          description: 'Unite a comunidades o seguí a otras personas para ver sus posts acá.',
          action: (
            <Link to="/c" className={buttonVariants()}>
              <LayoutGrid />
              Explorar comunidades
            </Link>
          ),
        }}
      />
    </PageLayout>
  );
}

export function UnansweredPage() {
  useDocumentTitle('Sin responder');
  const { sort, t, setSort, setT } = useFeedParams('new');
  const query = usePostsFeed({ sort, t, type: 'QUESTION', unanswered: true });
  return (
    <PageLayout aside={<><PopularCommunities /><TrendingTags /></>}>
      <PageHeader
        title="Sin responder"
        description="Preguntas que todavía esperan una respuesta aceptada. ¡Dale una mano a alguien!"
        icon={
          <span className="grid size-11 place-items-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
            <CircleQuestionMark className="size-5" />
          </span>
        }
      />
      <FeedControls sort={sort} t={t} onSort={setSort} onT={setT} sorts={['new', 'hot', 'top']} className="mb-4" />
      <PostFeed query={query} empty={{ icon: CircleQuestionMark, title: '¡Todas las preguntas tienen respuesta!', description: 'Volvé más tarde o hacé tu propia pregunta.' }} />
    </PageLayout>
  );
}

export function SavedPage() {
  useDocumentTitle('Guardados');
  const query = useBookmarks();
  return (
    <PageLayout aside={<PopularCommunities />}>
      <PageHeader
        title="Guardados"
        description="Los posts que guardaste para leer después. Solo vos los podés ver."
        icon={
          <span className="grid size-11 place-items-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            <Bookmark className="size-5" />
          </span>
        }
      />
      <FeedControls sort="new" t="all" onSort={() => undefined} onT={() => undefined} sorts={[]} className="mb-4" />
      <PostFeed
        query={query}
        empty={{ icon: Bookmark, title: 'No guardaste nada todavía', description: 'Tocá “Guardar” en cualquier post para encontrarlo después acá.' }}
      />
    </PageLayout>
  );
}
