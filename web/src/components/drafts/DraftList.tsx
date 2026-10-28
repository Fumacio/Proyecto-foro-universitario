import { ChartColumn, CircleQuestionMark, FilePen, FileText, Link2, Paperclip, PenLine, Trash, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { Draft, PostType } from '@/lib/types';
import { cn, POST_TYPE_LABEL } from '@/lib/utils';
import { useCommunities } from '@/queries/communities';
import { useDeleteDraft } from '@/queries/drafts';
import { CommunityIcon, TimeAgo } from '../common';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/Dialog';
import { Badge, EmptyState, ErrorState, Skeleton } from '../ui/misc';
import { Tooltip } from '../ui/Popover';

const TYPE_ICON: Record<PostType, LucideIcon> = { TEXT: FileText, QUESTION: CircleQuestionMark, POLL: ChartColumn, LINK: Link2 };

function excerpt(d: Draft) {
  const text = d.body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text) return text.slice(0, 160);
  if (d.type === 'POLL' && d.poll?.options.some((o) => o.trim())) return `Opciones: ${d.poll.options.filter((o) => o.trim()).join(' · ')}`;
  if (d.url) return d.url;
  return '';
}

const sep = <span aria-hidden className="text-zinc-300 dark:text-zinc-700">·</span>;

function DraftRow({ d, current, onOpen, compact }: { d: Draft; current?: boolean; onOpen: (d: Draft) => void; compact?: boolean }) {
  const communities = useCommunities();
  const community = d.communityId != null ? communities.data?.find((c) => c.id === d.communityId) : undefined;
  const del = useDeleteDraft();
  const [confirm, setConfirm] = useState(false);
  const Icon = TYPE_ICON[d.type] ?? FileText;
  const files = d.attachments?.length ?? 0;
  const preview = excerpt(d);

  return (
    <li className={cn('group relative flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/30', current && 'bg-brand-50/50 dark:bg-brand-500/[0.06]')}>
      <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-500 ring-1 ring-inset ring-zinc-200/70 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700/60">
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => onOpen(d)} className="block w-full text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-brand-500">
          <span className={cn('line-clamp-1 text-[15px] font-semibold', d.title.trim() ? 'text-zinc-900 dark:text-zinc-100' : 'italic text-zinc-400 dark:text-zinc-500')}>
            {d.title.trim() || 'Sin título'}
          </span>
        </button>
        {preview && <p className="mt-0.5 line-clamp-1 text-[13px] text-zinc-500 dark:text-zinc-400">{preview}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          {community ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-300">
              <CommunityIcon community={community} size="xs" />
              {community.name}
            </span>
          ) : (
            <span className="italic">Sin comunidad</span>
          )}
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            {sep}
            {POST_TYPE_LABEL[d.type]}
          </span>
          {files > 0 && (
            <span className="inline-flex items-center gap-2 whitespace-nowrap" title={`${files} adjunto${files === 1 ? '' : 's'}`}>
              {sep}
              <span className="inline-flex items-center gap-1">
                <Paperclip className="size-3" /> {files}
              </span>
            </span>
          )}
          <span className="inline-flex basis-full items-center gap-2 whitespace-nowrap sm:basis-auto">
            <span className="hidden sm:inline">{sep}</span>
            <TimeAgo date={d.updatedAt} prefix="Editado " />
          </span>
          {current && (
            <Badge tone="brand" className="ml-0.5">
              Editando ahora
            </Badge>
          )}
        </div>
      </div>
      <div className="relative z-10 flex shrink-0 items-center gap-1 self-center">
        {!current && !compact && (
          <Button size="sm" variant="secondary" onClick={() => onOpen(d)} className="hidden sm:inline-flex">
            <PenLine />
            Continuar
          </Button>
        )}
        <Tooltip content="Borrar borrador">
          <Button size="icon-sm" variant="danger-ghost" aria-label={`Borrar borrador ${d.title || 'sin título'}`} onClick={() => setConfirm(true)}>
            <Trash />
          </Button>
        </Tooltip>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="¿Borrar este borrador?"
        description={files > 0 ? `También se borran sus ${files} archivo${files === 1 ? '' : 's'} adjunto${files === 1 ? '' : 's'}. No se puede deshacer.` : 'No se puede deshacer.'}
        confirmLabel="Borrar"
        onConfirm={() => del.mutateAsync(d.id).then(() => toast.success('Borrador borrado'))}
      />
    </li>
  );
}

export function DraftListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="size-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DraftList({
  drafts,
  loading,
  error,
  onRetry,
  currentId,
  onOpen,
  emptyAction,
  compact,
}: {
  drafts: Draft[] | undefined;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  currentId?: number | null;
  onOpen: (d: Draft) => void;
  emptyAction?: ReactNode;
  /** Sin botón "Continuar" (la fila entera abre el borrador): para el diálogo. */
  compact?: boolean;
}) {
  if (loading) return <DraftListSkeleton />;
  if (error) return <ErrorState compact error={error} onRetry={onRetry} title="No pudimos cargar tus borradores" />;
  if (!drafts?.length)
    return (
      <EmptyState
        compact
        icon={FilePen}
        tone="zinc"
        title="No tenés borradores"
        description="Lo que empieces a escribir en “Crear post” se guarda solo y lo vas a encontrar acá."
        action={emptyAction}
      />
    );
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {drafts.map((d) => (
        <DraftRow key={d.id} d={d} current={d.id === currentId} onOpen={onOpen} compact={compact} />
      ))}
    </ul>
  );
}
