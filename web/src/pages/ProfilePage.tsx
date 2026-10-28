import {
  Ban,
  Bookmark,
  BookOpen,
  CalendarDays,
  FileText,
  MessageCircle,
  MessageSquare,
  Pencil,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { CommunityChip, RoleBadge, TimeAgo } from '@/components/common';
import { PageLayout } from '@/components/layout/AppShell';
import { PopularCommunities } from '@/components/layout/RightRail';
import { Markdown } from '@/components/markdown/Markdown';
import { PostFeed } from '@/components/posts/PostFeed';
import { Avatar } from '@/components/ui/Avatar';
import { Button, buttonVariants } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/Popover';
import { Segmented, UnderlineTabs } from '@/components/ui/Segmented';
import { Spinner } from '@/components/ui/Spinner';
import { useDocumentTitle, useInfiniteScroll } from '@/hooks';
import { isApiError } from '@/lib/api';
import { flattenPages } from '@/lib/cache';
import { monthYear } from '@/lib/time';
import type { UserProfile } from '@/lib/types';
import { cn, displayName, formatCount, formatNumber, gradientFor, postPath } from '@/lib/utils';
import { useMe, useRequireUser } from '@/queries/auth';
import { useStartConversation } from '@/queries/messages';
import { useBookmarks, useUserPosts } from '@/queries/posts';
import { useFollow, useFollowList, useProfile, useUserComments } from '@/queries/users';

type Tab = 'posts' | 'comments' | 'saved';

function FollowListDialog({ username, kind, open, onOpenChange }: { username: string; kind: 'followers' | 'following'; open: boolean; onOpenChange: (o: boolean) => void }) {
  const q = useFollowList(username, kind, open);
  const users = flattenPages(q.data);
  const sentinel = useInfiniteScroll<HTMLDivElement>({ hasMore: !!q.hasNextPage, loading: q.isFetchingNextPage, onLoadMore: () => void q.fetchNextPage(), rootMargin: '100px' });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={kind === 'followers' ? 'Seguidores' : 'Siguiendo'} size="sm">
      {q.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <Skeleton className="h-3.5 w-32" />
            </div>
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState compact error={q.error} onRetry={() => void q.refetch()} />
      ) : users.length === 0 ? (
        <EmptyState compact icon={Users} tone="zinc" title={kind === 'followers' ? 'Todavía no tiene seguidores' : 'Todavía no sigue a nadie'} />
      ) : (
        <div className="-mx-2 space-y-0.5">
          {users.map((u) => (
            <Link key={u.id} to={`/u/${u.username}`} onClick={() => onOpenChange(false)} className="flex items-center gap-3 rounded-xl p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
              <Avatar user={u} size="lg" />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {displayName(u)} <RoleBadge role={u.role} />
                </p>
                <p className="text-xs text-zinc-500">@{u.username}</p>
              </div>
            </Link>
          ))}
          <div ref={sentinel} className="flex h-8 items-center justify-center">
            {q.isFetchingNextPage && <Spinner className="size-4 text-zinc-400" />}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function ProfileHeader({ user, isMe }: { user: UserProfile; isMe: boolean }) {
  const navigate = useNavigate();
  const requireUser = useRequireUser();
  const follow = useFollow();
  const start = useStartConversation();
  const [hover, setHover] = useState(false);
  const [list, setList] = useState<'followers' | 'following' | null>(null);
  const [a, b] = gradientFor(user.username);

  const onFollow = () => {
    if (!requireUser()) return;
    follow.mutate(
      { username: user.username, follow: !user.isFollowing },
      { onSuccess: (r) => r.isFollowing && toast.success(`Ahora seguís a ${displayName(user)}`) },
    );
  };

  const onMessage = () => {
    if (!requireUser()) return;
    start.mutate(user.username, { onSuccess: ({ conversation }) => navigate(`/messages/${conversation.id}`) });
  };

  const stats = [
    { label: 'Karma', value: user.karma.total, tip: `${formatNumber(user.karma.post)} de posts · ${formatNumber(user.karma.comment)} de comentarios` },
    { label: 'Posts', value: user.postCount },
    { label: 'Comentarios', value: user.commentCount },
    { label: 'Seguidores', value: user.followerCount, onClick: () => setList('followers') },
    { label: 'Siguiendo', value: user.followingCount, onClick: () => setList('following') },
  ];

  return (
    <div className="surface mb-4 overflow-hidden">
      <div className="relative h-28 sm:h-36" style={{ background: `linear-gradient(120deg, ${a}, ${b})` }}>
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,.7) 1px, transparent 0)', backgroundSize: '14px 14px' }} />
        <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent" />
      </div>
      <div className="px-4 pb-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="-mt-12 rounded-full bg-white p-1 shadow-md sm:-mt-14 dark:bg-zinc-900">
            <Avatar user={user} size="2xl" className="size-20 text-2xl sm:size-24 sm:text-3xl" />
          </div>
          <div className="flex gap-2 pt-3">
            {isMe ? (
              <Link to="/settings" className={buttonVariants({ variant: 'secondary' })}>
                <Pencil />
                Editar perfil
              </Link>
            ) : (
              <>
                <Button variant="secondary" onClick={onMessage} loading={start.isPending}>
                  <MessageCircle />
                  Mensaje
                </Button>
                <Button
                  variant={user.isFollowing ? 'secondary' : 'primary'}
                  onClick={onFollow}
                  onMouseEnter={() => setHover(true)}
                  onMouseLeave={() => setHover(false)}
                  aria-pressed={user.isFollowing}
                  className={cn('min-w-[8.5rem]', user.isFollowing && hover && 'text-rose-600 dark:text-rose-400')}
                >
                  {user.isFollowing ? (
                    hover ? (
                      <>
                        <UserX /> Dejar de seguir
                      </>
                    ) : (
                      <>
                        <UserCheck /> Siguiendo
                      </>
                    )
                  ) : (
                    <>
                      <UserPlus /> Seguir
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">{displayName(user)}</h1>
            <RoleBadge role={user.role} size="md" />
            {user.isBanned && (
              <Badge tone="rose" icon={Ban}>
                Suspendido
              </Badge>
            )}
          </div>
          <p className="text-sm text-zinc-500">@{user.username}</p>
          {user.bio && <p className="mt-3 max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">{user.bio}</p>}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            {user.career && (
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="size-4" />
                {user.career}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" />
              Se unió en {monthYear(user.createdAt)}
            </span>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {stats.map((s) => {
            const inner = (
              <>
                <dd className="text-lg font-bold tabular-nums tracking-tight text-zinc-950 dark:text-white">{formatCount(s.value)}</dd>
                <dt className="text-xs text-zinc-500">{s.label}</dt>
              </>
            );
            const cls = 'flex flex-col-reverse rounded-xl bg-zinc-50 px-3 py-2.5 text-left dark:bg-zinc-800/40';
            const node = s.onClick ? (
              <button key={s.label} type="button" onClick={s.onClick} className={cn(cls, 'transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800')}>
                {inner}
              </button>
            ) : (
              <div key={s.label} className={cls}>
                {inner}
              </div>
            );
            return s.tip ? (
              <Tooltip key={s.label} content={s.tip}>
                {node}
              </Tooltip>
            ) : (
              node
            );
          })}
        </dl>
      </div>
      {list && <FollowListDialog username={user.username} kind={list} open={!!list} onOpenChange={(o) => !o && setList(null)} />}
    </div>
  );
}

function UserComments({ username }: { username: string }) {
  const q = useUserComments(username);
  const items = flattenPages(q.data);
  const sentinel = useInfiniteScroll<HTMLDivElement>({ hasMore: !!q.hasNextPage, loading: q.isFetchingNextPage, onLoadMore: () => void q.fetchNextPage() });

  if (q.isPending) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="surface space-y-2.5 p-4">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        ))}
      </div>
    );
  }
  if (q.isError) return <div className="surface"><ErrorState error={q.error} onRetry={() => void q.refetch()} /></div>;
  if (items.length === 0) return <div className="surface"><EmptyState icon={MessageSquare} title="Todavía no comentó nada" /></div>;

  return (
    <div className="space-y-3">
      {items.map((c) => (
        <article key={c.id} className="surface relative p-4 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            <CommunityChip community={c.post.community} />
            <span aria-hidden>·</span>
            <span>comentó en</span>
            <Link to={postPath(c.post, c.id)} className="min-w-0 truncate font-medium text-zinc-800 after:absolute after:inset-0 after:content-[''] hover:underline dark:text-zinc-200">
              {c.post.title}
            </Link>
          </div>
          <div className="mt-2 line-clamp-6">
            <Markdown size="sm">{c.body}</Markdown>
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
            <span className={cn('font-semibold tabular-nums', c.score > 0 ? 'text-orange-600' : c.score < 0 ? 'text-indigo-600' : '')}>{formatCount(c.score)} puntos</span>
            <TimeAgo date={c.createdAt} />
            {c.isAccepted && <Badge tone="emerald">Respuesta aceptada</Badge>}
          </div>
        </article>
      ))}
      <div ref={sentinel} className="flex h-12 items-center justify-center">
        {q.isFetchingNextPage && <Spinner className="text-zinc-400" />}
      </div>
    </div>
  );
}

function UserPosts({ username }: { username: string }) {
  const [sort, setSort] = useState<'new' | 'top'>('new');
  const q = useUserPosts(username, sort);
  return (
    <>
      <Segmented
        size="sm"
        className="mb-3"
        value={sort}
        onChange={setSort}
        items={[
          { value: 'new', label: 'Recientes' },
          { value: 'top', label: 'Más votados' },
        ]}
      />
      <PostFeed query={q} empty={{ icon: FileText, title: 'Todavía no publicó nada' }} />
    </>
  );
}

function SavedTab() {
  const q = useBookmarks();
  return <PostFeed query={q} empty={{ icon: Bookmark, title: 'No guardaste nada todavía', description: 'Tocá “Guardar” en cualquier post para encontrarlo acá.' }} />;
}

export function ProfilePage() {
  const { username = '' } = useParams();
  const { me } = useMe();
  const q = useProfile(username);
  const [params, setParams] = useSearchParams();
  const isMe = !!me && me.username.toLowerCase() === username.toLowerCase();
  const rawTab = params.get('tab') as Tab | null;
  const tab: Tab = rawTab === 'comments' || (rawTab === 'saved' && isMe) ? rawTab : 'posts';
  useDocumentTitle(q.data ? `${displayName(q.data)} (@${q.data.username})` : 'Perfil');

  if (q.isError) {
    const notFound = isApiError(q.error) && q.error.status === 404;
    return (
      <div className="surface">
        {notFound ? (
          <EmptyState icon={UserX} tone="zinc" title="Este usuario no existe" description={`No encontramos a @${username}.`} action={<Link to="/" className={buttonVariants()}>Ir al inicio</Link>} />
        ) : (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        )}
      </div>
    );
  }

  const tabs = [
    { value: 'posts' as Tab, label: 'Posts', icon: FileText, count: q.data?.postCount },
    { value: 'comments' as Tab, label: 'Comentarios', icon: MessageSquare, count: q.data?.commentCount },
    ...(isMe ? [{ value: 'saved' as Tab, label: 'Guardados', icon: Bookmark }] : []),
  ];

  return (
    <PageLayout aside={<PopularCommunities />}>
      {q.isPending ? (
        <div className="surface mb-4 overflow-hidden">
          <Skeleton className="h-28 rounded-none sm:h-36" />
          <div className="px-6 pb-6">
            <Skeleton className="-mt-12 size-24 rounded-full ring-4 ring-white dark:ring-zinc-900" />
            <Skeleton className="mt-4 h-6 w-48" />
            <Skeleton className="mt-2 h-4 w-28" />
            <Skeleton className="mt-4 h-4 w-2/3" />
          </div>
        </div>
      ) : (
        <ProfileHeader user={q.data} isMe={isMe} />
      )}
      <UnderlineTabs
        className="mb-4"
        items={tabs}
        value={tab}
        onChange={(t) =>
          setParams(
            (p) => {
              const n = new URLSearchParams(p);
              if (t === 'posts') n.delete('tab');
              else n.set('tab', t);
              return n;
            },
            { replace: true },
          )
        }
      />
      {tab === 'posts' && <UserPosts username={username} />}
      {tab === 'comments' && <UserComments username={username} />}
      {tab === 'saved' && isMe && <SavedTab />}
    </PageLayout>
  );
}
