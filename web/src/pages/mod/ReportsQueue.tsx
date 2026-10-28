import { Check, CircleCheckBig, ExternalLink, FileText, Flag, MessageSquare, Trash, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { TimeAgo, UserLink } from '@/components/common';
import { REPORT_REASON_LABEL } from '@/components/posts/ReportDialog';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';
import { Segmented } from '@/components/ui/Segmented';
import { Spinner } from '@/components/ui/Spinner';
import { useDocumentTitle, useInfiniteScroll } from '@/hooks';
import { flattenPages } from '@/lib/cache';
import type { Report, ReportReason, ReportStatus } from '@/lib/types';
import { postPath } from '@/lib/utils';
import { useReports, useResolveReport } from '@/queries/admin';

const REASON_TONE: Record<ReportReason, 'rose' | 'amber' | 'sky' | 'zinc' | 'brand'> = {
  SPAM: 'amber',
  HARASSMENT: 'rose',
  INAPPROPRIATE: 'rose',
  OFF_TOPIC: 'sky',
  OTHER: 'zinc',
};

function ReportCard({ r }: { r: Report }) {
  const resolve = useResolveReport();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const target = r.post ? 'post' : 'comentario';
  const link = r.post ? postPath(r.post) : r.comment ? postPath({ id: r.comment.postId }, r.comment.id) : null;
  const author = r.post?.author ?? r.comment?.author ?? null;

  const act = (status: 'RESOLVED' | 'DISMISSED', deleteContent?: boolean) =>
    resolve.mutateAsync({ id: r.id, status, deleteContent }).then(() =>
      toast.success(status === 'DISMISSED' ? 'Reporte descartado' : deleteContent ? `Reporte resuelto y ${target} borrado` : 'Reporte resuelto'),
    );

  return (
    <article className="surface p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <Badge tone={REASON_TONE[r.reason]} icon={Flag}>
          {REPORT_REASON_LABEL[r.reason]}
        </Badge>
        <span className="inline-flex items-center gap-1">
          {r.post ? <FileText className="size-3.5" /> : <MessageSquare className="size-3.5" />}
          {r.post ? 'Post' : 'Comentario'}
        </span>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          por <UserLink user={r.reporter} showRole={false} />
        </span>
        <span aria-hidden>·</span>
        <TimeAgo date={r.createdAt} />
      </div>

      {r.details && <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">“{r.details}”</p>}

      <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1">
            Autor: <UserLink user={author} />
          </span>
          {link && (
            <Link to={link} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline dark:text-brand-400">
              Ver <ExternalLink className="size-3" />
            </Link>
          )}
        </div>
        {r.post ? (
          <p className="font-medium text-zinc-900 dark:text-zinc-100">{r.post.title}</p>
        ) : r.comment ? (
          <p className="line-clamp-4 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">{r.comment.body || <em className="text-zinc-400">[eliminado]</em>}</p>
        ) : (
          <p className="text-sm italic text-zinc-400">El contenido ya no existe.</p>
        )}
      </div>

      {r.status === 'PENDING' ? (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => void act('DISMISSED')} disabled={resolve.isPending}>
            <X />
            Descartar
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void act('RESOLVED')} disabled={resolve.isPending}>
            <Check />
            Resolver
          </Button>
          {(r.post || r.comment) && (
            <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)} disabled={resolve.isPending}>
              <Trash />
              Resolver y borrar
            </Button>
          )}
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
          <CircleCheckBig className="size-3.5 text-emerald-500" />
          {r.status === 'RESOLVED' ? 'Resuelto' : 'Descartado'} por <UserLink user={r.resolvedBy} showRole={false} />
          {r.resolvedAt && (
            <>
              {' · '}
              <TimeAgo date={r.resolvedAt} />
            </>
          )}
        </p>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`¿Borrar el ${target}?`}
        description={`El reporte se marca como resuelto y el ${target} se borra. No se puede deshacer.`}
        confirmLabel="Resolver y borrar"
        onConfirm={() => act('RESOLVED', true)}
      />
    </article>
  );
}

export function ReportsQueue() {
  useDocumentTitle('Reportes · Moderación');
  const [status, setStatus] = useState<ReportStatus>('PENDING');
  const q = useReports(status);
  const items = flattenPages(q.data);
  const sentinel = useInfiniteScroll<HTMLDivElement>({ hasMore: !!q.hasNextPage, loading: q.isFetchingNextPage, onLoadMore: () => void q.fetchNextPage() });

  return (
    <div>
      <Segmented
        className="mb-4"
        value={status}
        onChange={setStatus}
        ariaLabel="Estado de los reportes"
        items={[
          { value: 'PENDING', label: 'Pendientes' },
          { value: 'RESOLVED', label: 'Resueltos' },
          { value: 'DISMISSED', label: 'Descartados' },
        ]}
      />
      {q.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="surface space-y-3 p-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : q.isError ? (
        <div className="surface"><ErrorState error={q.error} onRetry={() => void q.refetch()} /></div>
      ) : items.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon={status === 'PENDING' ? CircleCheckBig : Flag}
            tone={status === 'PENDING' ? 'emerald' : 'zinc'}
            title={status === 'PENDING' ? '¡No hay reportes pendientes!' : 'No hay reportes en esta lista'}
            description={status === 'PENDING' ? 'La comunidad está tranquila. Buen trabajo 💪' : undefined}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <ReportCard key={r.id} r={r} />
          ))}
          <div ref={sentinel} className="flex h-12 items-center justify-center">
            {q.isFetchingNextPage && <Spinner className="text-zinc-400" />}
          </div>
        </div>
      )}
    </div>
  );
}
