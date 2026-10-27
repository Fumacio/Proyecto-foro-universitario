import { AtSign, CircleCheckBig, MessageSquare, Reply, ShieldAlert, UserPlus, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { timeAgo, fullDate } from '@/lib/time';
import type { Notification, NotificationType } from '@/lib/types';
import { cn, displayName, postPath } from '@/lib/utils';
import { Avatar } from '../ui/Avatar';

const TYPE_META: Record<NotificationType, { icon: LucideIcon; className: string }> = {
  POST_REPLY: { icon: MessageSquare, className: 'bg-sky-500' },
  COMMENT_REPLY: { icon: Reply, className: 'bg-brand-500' },
  MENTION: { icon: AtSign, className: 'bg-violet-500' },
  FOLLOW: { icon: UserPlus, className: 'bg-pink-500' },
  ANSWER_ACCEPTED: { icon: CircleCheckBig, className: 'bg-emerald-500' },
  MOD: { icon: ShieldAlert, className: 'bg-amber-500' },
};

export function notificationTarget(n: Notification): string {
  if (n.type === 'FOLLOW' && n.actor) return `/u/${n.actor.username}`;
  if (n.post) return postPath(n.post, n.comment?.id);
  if (n.actor) return `/u/${n.actor.username}`;
  return '/notifications';
}

export function notificationText(n: Notification): ReactNode {
  const who = <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{displayName(n.actor)}</strong>;
  const title = n.post ? <span className="font-medium text-zinc-800 dark:text-zinc-200">“{n.post.title}”</span> : null;
  switch (n.type) {
    case 'POST_REPLY':
      return <>{who} comentó en tu post {title}</>;
    case 'COMMENT_REPLY':
      return <>{who} respondió tu comentario{title && <> en {title}</>}</>;
    case 'MENTION':
      return <>{who} te mencionó{title && <> en {title}</>}</>;
    case 'FOLLOW':
      return <>{who} empezó a seguirte</>;
    case 'ANSWER_ACCEPTED':
      return <>{who} marcó tu comentario como la respuesta{title && <> en {title}</>}</>;
    case 'MOD':
      return <>{n.message ?? 'Aviso del equipo de moderación'}{title && <> · {title}</>}</>;
    default:
      return n.message ?? 'Nueva notificación';
  }
}

export function notificationPlainText(n: Notification): string {
  const who = displayName(n.actor);
  const t = n.post ? ` “${n.post.title}”` : '';
  switch (n.type) {
    case 'POST_REPLY':
      return `${who} comentó en tu post${t}`;
    case 'COMMENT_REPLY':
      return `${who} respondió tu comentario`;
    case 'MENTION':
      return `${who} te mencionó${n.post ? ` en${t}` : ''}`;
    case 'FOLLOW':
      return `${who} empezó a seguirte`;
    case 'ANSWER_ACCEPTED':
      return `${who} aceptó tu respuesta`;
    case 'MOD':
      return n.message ?? 'Aviso del equipo de moderación';
    default:
      return n.message ?? 'Nueva notificación';
  }
}

export function NotificationIcon({ n, size = 'lg' }: { n: Notification; size?: 'md' | 'lg' }) {
  const meta = TYPE_META[n.type] ?? TYPE_META.MOD;
  const Icon = meta.icon;
  return (
    <span className="relative flex shrink-0 self-start">
      {n.actor && n.type !== 'MOD' ? (
        <Avatar user={n.actor} size={size} />
      ) : (
        <span className={cn('grid place-items-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', size === 'lg' ? 'size-10' : 'size-8')}>
          <ShieldAlert className="size-5" />
        </span>
      )}
      {n.type !== 'MOD' && (
        <span className={cn('absolute -bottom-0.5 -right-0.5 grid size-[18px] place-items-center rounded-full text-white ring-2 ring-white dark:ring-zinc-900', meta.className)}>
          <Icon className="size-2.5" strokeWidth={2.75} />
        </span>
      )}
    </span>
  );
}

export function NotificationItem({ n, onOpen, dense }: { n: Notification; onOpen: (n: Notification) => void; dense?: boolean }) {
  return (
    <Link
      to={notificationTarget(n)}
      onClick={() => onOpen(n)}
      className={cn(
        'group relative flex gap-3 rounded-xl transition-colors hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60',
        dense ? 'px-2.5 py-2.5' : 'px-3 py-3',
        !n.read && 'bg-brand-50/60 dark:bg-brand-500/[0.07]',
      )}
    >
      <NotificationIcon n={n} size={dense ? 'md' : 'lg'} />
      <div className="min-w-0 flex-1">
        <p className={cn('text-zinc-600 dark:text-zinc-400', dense ? 'line-clamp-2 text-[13px]' : 'text-sm')}>{notificationText(n)}</p>
        {n.comment?.excerpt && (
          <p className={cn('mt-1 line-clamp-2 border-l-2 border-zinc-200 pl-2 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400', dense ? 'text-xs' : 'text-[13px]')}>
            {n.comment.excerpt}
          </p>
        )}
        <time dateTime={n.createdAt} title={fullDate(n.createdAt)} className={cn('mt-1 block text-xs', n.read ? 'text-zinc-400' : 'font-medium text-brand-600 dark:text-brand-400')}>
          {timeAgo(n.createdAt)}
        </time>
      </div>
      {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" aria-label="Sin leer" />}
    </Link>
  );
}
