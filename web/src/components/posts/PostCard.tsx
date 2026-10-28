import { Bookmark, ChartColumn, CircleQuestionMark, Ellipsis, FaceSlightlySmilingPlus, Flag, Link2, MessageSquare, Paperclip, Share2, FileText } from 'lucide-react';
import { forwardRef, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { PostListItem } from '@/lib/types';
import { cn, formatCount, hostname, postPath } from '@/lib/utils';
import { useRequireUser } from '@/queries/auth';
import { CommunityChip, TagChip, TimeAgo, UserLink } from '../common';
import { ReactionBar, ReactionPicker, useReactionToggle } from '../reactions/ReactionBar';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '../ui/Menu';
import { Dot, Skeleton } from '../ui/misc';
import { PollWidget } from './PollWidget';
import { PostBadges } from './PostBits';
import { ReportDialog } from './ReportDialog';
import { usePostActions } from './usePostActions';
import { VoteControl } from './VoteControl';

interface CardProps {
  post: PostListItem;
  showCommunity?: boolean;
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  active,
  children,
  to,
}: {
  icon: typeof MessageSquare;
  label: string;
  onClick?: () => void;
  active?: boolean;
  children?: ReactNode;
  to?: string;
}) {
  const cls = cn(
    'relative z-10 inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium transition-colors',
    active
      ? 'text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10'
      : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
  );
  const content = (
    <>
      <Icon className={cn('size-[17px]', active && 'fill-current')} strokeWidth={1.9} />
      {children ?? <span className="sr-only">{label}</span>}
    </>
  );
  if (to)
    return (
      <Link to={to} className={cls} aria-label={label}>
        {content}
      </Link>
    );
  return (
    <button
      type="button"
      className={cls}
      aria-label={label}
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
    >
      {content}
    </button>
  );
}

const actionCls = (active?: boolean) =>
  cn(
    'relative z-10 inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium transition-colors',
    active
      ? 'text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10'
      : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 data-[state=open]:bg-zinc-100 data-[state=open]:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:data-[state=open]:bg-zinc-800 dark:data-[state=open]:text-zinc-100',
  );

/** Botón "Reaccionar" de la barra de acciones (cuando el post todavía no tiene reacciones). */
const ReactActionButton = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'>>(function ReactActionButton(props, ref) {
  return (
    <button ref={ref} type="button" aria-label="Reaccionar" {...props} className={actionCls()}>
      <FaceSlightlySmilingPlus className="size-[17px]" strokeWidth={1.9} />
      <span className="hidden sm:inline">Reaccionar</span>
    </button>
  );
});

function PostMoreMenu({ post }: { post: PostListItem }) {
  const [reporting, setReporting] = useState(false);
  const requireUser = useRequireUser();
  const { share } = usePostActions(post);
  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label="Más opciones"
            className="relative z-10 grid size-8 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <Ellipsis className="size-[18px]" />
          </button>
        </MenuTrigger>
        <MenuContent>
          <MenuItem icon={<Link2 />} onSelect={share}>
            Copiar link
          </MenuItem>
          <MenuItem
            icon={<Flag />}
            danger
            onSelect={() => {
              if (requireUser()) setReporting(true);
            }}
          >
            Reportar
          </MenuItem>
        </MenuContent>
      </Menu>
      <ReportDialog open={reporting} onOpenChange={setReporting} target={{ postId: post.id }} />
    </>
  );
}

function MetaLine({ post, showCommunity }: CardProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
      {showCommunity && (
        <>
          <CommunityChip community={post.community} className="max-w-[12rem]" />
          <Dot />
        </>
      )}
      <UserLink user={post.author} showAvatar={!showCommunity} className="max-w-[14rem]" />
      <Dot />
      <TimeAgo date={post.createdAt} />
      {post.editedAt && <span className="italic">(editado)</span>}
      <PostBadges post={post} className="ml-1" />
    </div>
  );
}

export function PostCard({ post, showCommunity = true }: CardProps) {
  const { vote, toggleBookmark, share } = usePostActions(post);
  const href = postPath(post);
  const reactions = post.reactions ?? [];
  const files = post.attachmentCount ?? 0;
  const react = useReactionToggle({ type: 'post', id: post.id });
  return (
    <article
      className={cn(
        'group/card surface relative flex transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-px hover:border-zinc-300 hover:shadow-lift dark:hover:border-zinc-700',
        post.isPinned && 'ring-1 ring-emerald-500/20',
      )}
    >
      <div className="hidden w-12 shrink-0 justify-center pt-3 sm:flex">
        <VoteControl score={post.score} myVote={post.myVote} onVote={vote} />
      </div>
      <div className="min-w-0 flex-1 px-4 pb-2 pt-3.5 sm:pl-1">
        <MetaLine post={post} showCommunity={showCommunity} />
        <h2 className="mt-1.5 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-zinc-950 [overflow-wrap:anywhere] dark:text-zinc-50">
          <Link to={href} className="outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-brand-500">
            {post.title}
          </Link>
        </h2>
        {post.type === 'LINK' && post.url && (
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="relative z-10 mt-1 inline-flex max-w-full items-center gap-1 truncate text-[13px] font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            <Link2 className="size-3.5 shrink-0" />
            <span className="truncate">{hostname(post.url)}</span>
          </a>
        )}
        {post.excerpt && !post.imageUrl && (
          <p className="mt-1.5 line-clamp-3 text-[14.5px] leading-relaxed text-zinc-600 [overflow-wrap:anywhere] dark:text-zinc-400">
            {post.excerpt}
          </p>
        )}
        {post.excerpt && post.imageUrl && (
          <p className="mt-1.5 line-clamp-2 text-[14.5px] leading-relaxed text-zinc-600 [overflow-wrap:anywhere] dark:text-zinc-400">
            {post.excerpt}
          </p>
        )}
        {post.imageUrl && (
          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
            <img src={post.imageUrl} alt="" loading="lazy" className="max-h-[22rem] w-full object-cover" />
          </div>
        )}
        {post.poll && (
          <div className="mt-3">
            <PollWidget postId={post.id} poll={post.poll} compact />
          </div>
        )}
        {post.tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {post.tags.map((t) => (
              <TagChip key={t.id} tag={t} />
            ))}
          </div>
        )}
        {reactions.length > 0 && <ReactionBar target={{ type: 'post', id: post.id }} reactions={reactions} size="sm" className="mt-2.5" />}
        <div className="-ml-2.5 mt-2 flex items-center gap-0.5 sm:-ml-2.5">
          <VoteControl score={post.score} myVote={post.myVote} onVote={vote} orientation="horizontal" size="sm" className="mr-1 sm:hidden" />
          <ActionButton icon={MessageSquare} label="Comentarios" to={`${href}#comentarios`}>
            <span className="tabular-nums">{formatCount(post.commentCount)}</span>
            <span className="hidden sm:inline">{post.commentCount === 1 ? 'comentario' : 'comentarios'}</span>
          </ActionButton>
          {files > 0 && (
            <ActionButton icon={Paperclip} label={files === 1 ? '1 archivo adjunto' : `${files} archivos adjuntos`} to={`${href}#adjuntos`}>
              <span className="tabular-nums">{files}</span>
              <span className="hidden md:inline">{files === 1 ? 'archivo' : 'archivos'}</span>
            </ActionButton>
          )}
          {reactions.length === 0 && <ReactionPicker reactions={reactions} onPick={react} trigger={<ReactActionButton />} />}
          <ActionButton icon={Share2} label="Compartir" onClick={share}>
            <span className="hidden sm:inline">Compartir</span>
          </ActionButton>
          <ActionButton icon={Bookmark} label={post.isBookmarked ? 'Quitar de guardados' : 'Guardar'} onClick={toggleBookmark} active={post.isBookmarked}>
            <span className="hidden sm:inline">{post.isBookmarked ? 'Guardado' : 'Guardar'}</span>
          </ActionButton>
          <div className="ml-auto">
            <PostMoreMenu post={post} />
          </div>
        </div>
      </div>
    </article>
  );
}

const TYPE_ICON = { TEXT: FileText, QUESTION: CircleQuestionMark, POLL: ChartColumn, LINK: Link2 };

export function PostCompactRow({ post, showCommunity = true }: CardProps) {
  const { vote, toggleBookmark } = usePostActions(post);
  const href = postPath(post);
  const Icon = TYPE_ICON[post.type];
  return (
    <article className="group/row relative flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-zinc-50 sm:px-4 dark:hover:bg-zinc-800/40">
      <VoteControl score={post.score} myVote={post.myVote} onVote={vote} size="sm" className="hidden sm:flex" />
      <div className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-zinc-100 text-zinc-400 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:ring-zinc-700/70">
        {post.imageUrl ? <img src={post.imageUrl} alt="" loading="lazy" className="size-full object-cover" /> : <Icon className="size-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug text-zinc-900 sm:line-clamp-1 dark:text-zinc-100">
          <Link to={href} className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-brand-500">
            {post.title}
          </Link>
        </h2>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {showCommunity && (
            <>
              <CommunityChip community={post.community} className="max-w-[10rem] font-medium" />
              <Dot />
            </>
          )}
          <UserLink user={post.author} showRole={false} className="max-w-[9rem]" />
          <Dot />
          <TimeAgo date={post.createdAt} />
          <span className="sm:hidden">
            <Dot /> {formatCount(post.score)} pts
          </span>
          {(post.attachmentCount ?? 0) > 0 && (
            <span className="inline-flex items-center gap-0.5 font-medium text-zinc-500 dark:text-zinc-400" title={`${post.attachmentCount} archivos adjuntos`}>
              <Dot /> <Paperclip className="ml-1 size-3" />
              {post.attachmentCount}
            </span>
          )}
          <PostBadges post={post} className="ml-0.5" />
          {(post.reactions?.length ?? 0) > 0 && (
            <ReactionBar target={{ type: 'post', id: post.id }} reactions={post.reactions} size="xs" max={3} showAdd={false} className="ml-0.5 gap-1" />
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Link
          to={`${href}#comentarios`}
          className="relative z-10 inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label={`${post.commentCount} comentarios`}
        >
          <MessageSquare className="size-4" />
          <span className="tabular-nums">{formatCount(post.commentCount)}</span>
        </Link>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            toggleBookmark();
          }}
          aria-label={post.isBookmarked ? 'Quitar de guardados' : 'Guardar'}
          aria-pressed={post.isBookmarked}
          className={cn(
            'relative z-10 hidden size-8 place-items-center rounded-full transition-colors sm:grid',
            post.isBookmarked
              ? 'text-brand-600 dark:text-brand-400'
              : 'text-zinc-400 opacity-0 hover:bg-zinc-100 hover:text-zinc-900 group-hover/row:opacity-100 focus-visible:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
          )}
        >
          <Bookmark className={cn('size-4', post.isBookmarked && 'fill-current')} />
        </button>
      </div>
    </article>
  );
}

export function PostCardSkeleton({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="hidden h-14 w-7 sm:block" />
        <Skeleton className="size-12 shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    );
  }
  return (
    <div className="surface flex p-4 sm:pl-0">
      <div className="hidden w-12 flex-col items-center gap-2 sm:flex">
        <Skeleton className="size-6" />
        <Skeleton className="h-3 w-5" />
        <Skeleton className="size-6" />
      </div>
      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-5 rounded-md" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-5 w-4/5" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}
