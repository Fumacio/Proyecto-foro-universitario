import { ChartColumn, CircleCheckBig, CircleQuestionMark, ExternalLink, Globe, Link2, Lock, Pin } from 'lucide-react';
import type { PostListItem } from '@/lib/types';
import { cn, hostname } from '@/lib/utils';
import { Badge } from '../ui/misc';

export function PostBadges({ post, showType = true, className }: { post: PostListItem; showType?: boolean; className?: string }) {
  const solved = post.type === 'QUESTION' && post.acceptedCommentId != null;
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
      {post.isPinned && (
        <Badge tone="emerald" icon={Pin}>
          Fijado
        </Badge>
      )}
      {post.isLocked && (
        <Badge tone="amber" icon={Lock}>
          Cerrado
        </Badge>
      )}
      {solved && (
        <Badge tone="emerald" icon={CircleCheckBig}>
          Resuelta ✓
        </Badge>
      )}
      {showType && post.type === 'QUESTION' && !solved && (
        <Badge tone="sky" icon={CircleQuestionMark}>
          Pregunta
        </Badge>
      )}
      {showType && post.type === 'POLL' && (
        <Badge tone="brand" icon={ChartColumn}>
          Encuesta
        </Badge>
      )}
      {showType && post.type === 'LINK' && (
        <Badge tone="zinc" icon={Link2}>
          Link
        </Badge>
      )}
    </span>
  );
}

export function LinkCard({ url, className }: { url: string; className?: string }) {
  const host = hostname(url);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={cn(
        'group/link relative z-10 flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 transition-colors hover:border-brand-300 hover:bg-brand-50/40 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/5',
        className,
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-brand-600 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-brand-400 dark:ring-zinc-700">
        <Globe className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{host}</span>
        <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{url}</span>
      </span>
      <ExternalLink className="size-4 shrink-0 text-zinc-400 transition-transform group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5 group-hover/link:text-brand-600" />
    </a>
  );
}
