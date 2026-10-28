import {
  ArrowDown,
  CircleCheckBig,
  CircleMinus,
  CirclePlus,
  Ellipsis,
  Flag,
  Link2,
  Lock,
  MessageSquare,
  MessagesSquare,
  Pencil,
  Reply,
  Trash,
} from 'lucide-react';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { toast } from 'sonner';
import { useMediaQuery } from '@/hooks';
import { isApiError } from '@/lib/api';
import { ATTACHMENT_LIMITS } from '@/lib/attachments';
import { countComments, findComment } from '@/lib/cache';
import { loginPath } from '@/lib/navigation';
import type { Attachment, Comment, CommentSort, Me, PostDetail } from '@/lib/types';
import { cn, displayName, plural, postPath } from '@/lib/utils';
import { useMe, useRequireUser } from '@/queries/auth';
import { useComments, useCreateComment, useDeleteComment, useEditComment, useVoteComment } from '@/queries/comments';
import { useAcceptAnswer } from '@/queries/posts';
import { AttachmentList } from '../attachments/AttachmentList';
import { AttachButton, FileDropTarget, UploadList } from '../attachments/AttachmentPicker';
import { sameIds, useAttachmentUploads } from '../attachments/useAttachmentUploads';
import { TimeAgo, UserLink } from '../common';
import { Markdown } from '../markdown/Markdown';
import { MarkdownEditor } from '../markdown/MarkdownEditor';
import { ReportDialog } from '../posts/ReportDialog';
import { shareLink } from '../posts/usePostActions';
import { VoteControl } from '../posts/VoteControl';
import { AddReactionButton, ReactionBar, ReactionPicker, useReactionToggle } from '../reactions/ReactionBar';
import { Avatar } from '../ui/Avatar';
import { Button, buttonVariants } from '../ui/Button';
import { ConfirmDialog } from '../ui/Dialog';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '../ui/Menu';
import { Badge, EmptyState, ErrorState, Skeleton } from '../ui/misc';
import { Segmented } from '../ui/Segmented';

const MAX_COMMENT = 10000;

interface Ctx {
  post: PostDetail;
  me: Me | null;
  canAccept: boolean;
  canReply: boolean;
  highlightId: number | null;
  maxDepth: number;
}
const CommentsCtx = createContext<Ctx | null>(null);
const useCtx = () => useContext(CommentsCtx)!;

/* ---------------- Borrador local del composer ---------------- */

interface LocalCommentDraft {
  body: string;
  attachments?: Attachment[];
  savedAt: number;
}

/** Los adjuntos sueltos se limpian a las 24 h en el server: no restauramos los más viejos. */
const ATTACHMENT_TTL = 20 * 60 * 60 * 1000;

const draftKey = (postId: number, parentId?: number) => `foro:comment-draft:${postId}:${parentId ?? 'root'}`;

function readCommentDraft(postId: number, parentId?: number): LocalCommentDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(postId, parentId));
    if (!raw) return null;
    const d = JSON.parse(raw) as LocalCommentDraft;
    if (!d?.body && !d?.attachments?.length) return null;
    if (d.attachments?.length && Date.now() - (d.savedAt ?? 0) > ATTACHMENT_TTL) d.attachments = [];
    return d;
  } catch {
    return null;
  }
}

function writeCommentDraft(postId: number, parentId: number | undefined, d: Omit<LocalCommentDraft, 'savedAt'> | null) {
  try {
    if (!d || (!d.body.trim() && !d.attachments?.length)) localStorage.removeItem(draftKey(postId, parentId));
    else localStorage.setItem(draftKey(postId, parentId), JSON.stringify({ ...d, savedAt: Date.now() }));
  } catch {
    /* storage bloqueado */
  }
}

function hasCommentDraft(postId: number, parentId?: number) {
  return !!readCommentDraft(postId, parentId);
}

/* ---------------- Composer ---------------- */

function Composer({
  postId,
  parentId,
  initial = '',
  initialAttachments,
  onDone,
  onCancel,
  autoFocus,
  submitLabel = 'Comentar',
  placeholder,
  editId,
}: {
  postId: number;
  parentId?: number;
  initial?: string;
  initialAttachments?: Attachment[];
  onDone?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  submitLabel?: string;
  placeholder?: string;
  editId?: number;
}) {
  // Borrador local (solo al crear, no al editar): se restaura al volver al post.
  const local = useMemo(() => (editId ? null : readCommentDraft(postId, parentId)), [editId, postId, parentId]);
  const [body, setBody] = useState(local?.body ?? initial);
  const [error, setError] = useState<string | null>(null);
  const uploads = useAttachmentUploads({ max: ATTACHMENT_LIMITS.comment, initial: editId ? initialAttachments : local?.attachments });
  const initialIds = useRef((initialAttachments ?? []).map((a) => a.id));
  const create = useCreateComment(postId);
  const edit = useEditComment(postId);
  const requireUser = useRequireUser();
  const pending = create.isPending || edit.isPending;
  const trimmed = body.trim();

  useEffect(() => {
    if (editId) return;
    const t = setTimeout(() => writeCommentDraft(postId, parentId, { body, attachments: uploads.attachments }), 400);
    return () => clearTimeout(t);
  }, [editId, postId, parentId, body, uploads.attachments]);

  const submit = () => {
    if (!trimmed || pending || uploads.isUploading) return;
    if (trimmed.length > MAX_COMMENT) return setError(`Máximo ${MAX_COMMENT.toLocaleString('es-AR')} caracteres.`);
    if (uploads.hasErrors) return setError('Hay archivos que no se pudieron subir: reintentá o quitalos.');
    if (!requireUser()) return;
    setError(null);
    const opts = {
      onSuccess: () => {
        setBody('');
        uploads.reset([]);
        if (!editId) writeCommentDraft(postId, parentId, null);
        onDone?.();
      },
      onError: (e: unknown) => {
        if (isApiError(e) && e.status === 400) setError(e.details?.body ?? e.details?.attachmentIds ?? e.message);
      },
    };
    if (editId) {
      const changed = !sameIds(uploads.ids, initialIds.current);
      edit.mutate({ id: editId, body: trimmed, ...(changed ? { attachmentIds: uploads.ids } : {}) }, opts);
    } else create.mutate({ body: trimmed, parentId, attachmentIds: uploads.ids }, opts);
  };

  const cancel = () => {
    // Al editar, lo que se subió y no se guardó se borra. Al crear, el borrador local se conserva.
    if (editId) uploads.discard();
    onCancel?.();
  };

  return (
    <FileDropTarget uploads={uploads}>
      <MarkdownEditor
        value={body}
        onChange={setBody}
        onSubmit={submit}
        autoFocus={autoFocus}
        minRows={3}
        maxLength={MAX_COMMENT}
        invalid={!!error}
        onAttachFiles={uploads.add}
        attachments={uploads.count > 0 ? <UploadList uploads={uploads} dense /> : undefined}
        footerStart={<AttachButton uploads={uploads} label="Adjuntar archivos" />}
        placeholder={placeholder ?? '¿Qué opinás? Podés mencionar a alguien con @usuario'}
        footer={
          <div className="flex items-center gap-2">
            {onCancel && (
              <Button size="sm" variant="ghost" onClick={cancel} disabled={pending}>
                Cancelar
              </Button>
            )}
            <Button size="sm" onClick={submit} disabled={!trimmed || uploads.isUploading} loading={pending}>
              {uploads.isUploading ? 'Subiendo…' : submitLabel}
            </Button>
          </div>
        }
      />
      {error && <p className="mt-1.5 text-[13px] text-rose-600 dark:text-rose-400">{error}</p>}
    </FileDropTarget>
  );
}

/* ---------------- Ítem ---------------- */

function flattenReplies(list: Comment[], parent: Comment): { comment: Comment; replyTo: string }[] {
  const out: { comment: Comment; replyTo: string }[] = [];
  for (const c of list) {
    out.push({ comment: c, replyTo: parent.isDeleted ? '[eliminado]' : displayName(parent.author) });
    out.push(...flattenReplies(c.replies, c));
  }
  return out;
}

function CommentItem({ c, depth, flat, replyTo }: { c: Comment; depth: number; flat?: boolean; replyTo?: string }) {
  const { post, me, canAccept, canReply, highlightId, maxDepth } = useCtx();
  const [collapsed, setCollapsed] = useState(false);
  const [replying, setReplying] = useState(() => !c.isDeleted && hasCommentDraft(post.id, c.id));
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reporting, setReporting] = useState(false);
  const requireUser = useRequireUser();
  const vote = useVoteComment(post.id);
  const del = useDeleteComment(post.id);
  const accept = useAcceptAnswer(post.id);
  const reactionTarget = { type: 'comment' as const, id: c.id, postId: post.id };
  const react = useReactionToggle(reactionTarget, c.isDeleted);
  const reactions = c.reactions ?? [];

  const isMine = !!me && c.author?.id === me.id;
  const isOp = !!c.author && c.author.id === post.author?.id;
  const canDelete = !c.isDeleted && (isMine || post.canModerate);
  const isAccepted = c.isAccepted || post.acceptedCommentId === c.id;
  const replyCount = useMemo(() => countComments(c.replies), [c.replies]);
  const hasChildren = !flat && c.replies.length > 0;

  const onVote = (value: -1 | 0 | 1) => {
    if (!requireUser()) return;
    vote.mutate({ id: c.id, value });
  };

  return (
    <div id={`comment-${c.id}`} className={cn('scroll-mt-24', highlightId === c.id && 'comment-highlight')}>
      <div className="flex gap-2 sm:gap-2.5">
        <div className="flex flex-col items-center">
          {collapsed ? (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="grid size-6 place-items-center rounded-full text-zinc-400 hover:text-brand-600 sm:size-7"
              aria-label="Expandir comentario"
            >
              <CirclePlus className="size-5" />
            </button>
          ) : (
            c.author && !c.isDeleted ? (
              <Link to={`/u/${c.author.username}`} aria-hidden tabIndex={-1}>
                <Avatar user={c.author} size="sm" className="sm:size-7" />
              </Link>
            ) : (
              <Avatar user={null} size="sm" className="sm:size-7" />
            )
          )}
          {!collapsed && (hasChildren || replying) && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label={`Colapsar hilo de ${displayName(c.author)}`}
              className="group/line mt-1.5 flex w-6 flex-1 cursor-pointer justify-center sm:w-7"
            >
              <span className="w-px rounded-full bg-zinc-200 transition-all group-hover/line:w-0.5 group-hover/line:bg-brand-500 dark:bg-zinc-800 dark:group-hover/line:bg-brand-400" />
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div
            className={cn(
              isAccepted && !collapsed && 'rounded-xl bg-emerald-50/70 p-2.5 ring-1 ring-emerald-200/80 -mx-1 dark:bg-emerald-500/[0.06] dark:ring-emerald-500/25',
            )}
          >
            <div className="flex min-h-6 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-zinc-500 sm:min-h-7 dark:text-zinc-400">
              {c.isDeleted ? <span className="italic text-zinc-400">[eliminado]</span> : <UserLink user={c.author} />}
              {isOp && !c.isDeleted && (
                <span className="rounded bg-brand-50 px-1 text-[10px] font-bold uppercase tracking-wide text-brand-600 dark:bg-brand-500/15 dark:text-brand-300" title="Autor del post">
                  OP
                </span>
              )}
              <span aria-hidden>·</span>
              <TimeAgo date={c.createdAt} />
              {c.editedAt && !c.isDeleted && <span className="italic">(editado)</span>}
              {isAccepted && (
                <Badge tone="emerald" icon={CircleCheckBig} className="ml-0.5">
                  Respuesta aceptada
                </Badge>
              )}
              {replyTo && <span className="text-zinc-400">· en respuesta a {replyTo}</span>}
              {collapsed && (
                <button type="button" onClick={() => setCollapsed(false)} className="ml-1 font-medium text-brand-600 hover:underline dark:text-brand-400">
                  {replyCount > 0 ? `+${plural(replyCount, 'respuesta')}` : 'Mostrar'}
                </button>
              )}
              {!collapsed && !hasChildren && (
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  className="ml-auto hidden rounded p-0.5 text-zinc-300 hover:text-zinc-600 sm:block dark:text-zinc-600 dark:hover:text-zinc-300"
                  aria-label="Colapsar comentario"
                >
                  <CircleMinus className="size-3.5" />
                </button>
              )}
            </div>

            {!collapsed && (
              <>
                {editing ? (
                  <div className="mt-2">
                    <Composer
                      postId={post.id}
                      editId={c.id}
                      initial={c.body}
                      initialAttachments={c.attachments}
                      autoFocus
                      submitLabel="Guardar"
                      onDone={() => {
                        setEditing(false);
                        toast.success('Comentario editado');
                      }}
                      onCancel={() => setEditing(false)}
                    />
                  </div>
                ) : c.isDeleted ? (
                  <p className="mt-1 text-sm italic text-zinc-400 dark:text-zinc-500">Este comentario fue eliminado.</p>
                ) : (
                  <>
                    <Markdown size="sm" className="mt-1">
                      {c.body}
                    </Markdown>
                    <AttachmentList attachments={c.attachments} variant="compact" className="mt-2.5" />
                    {reactions.length > 0 && <ReactionBar target={reactionTarget} reactions={reactions} size="sm" className="mt-2" />}
                  </>
                )}

                {!editing && (
                  <div className="-ml-1.5 mt-1.5 flex flex-wrap items-center gap-0.5">
                    {!c.isDeleted && <VoteControl score={c.score} myVote={c.myVote} onVote={onVote} orientation="horizontal" size="sm" label="comentario" className="mr-1 bg-transparent dark:bg-transparent" />}
                    {!c.isDeleted && reactions.length === 0 && (
                      <ReactionPicker
                        reactions={reactions}
                        onPick={react}
                        trigger={
                          <AddReactionButton
                            label="Reaccionar al comentario"
                            className="size-7 text-zinc-400 ring-0 hover:text-zinc-900 dark:hover:text-zinc-100"
                          />
                        }
                      />
                    )}
                    {canReply && depth < 50 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!requireUser()) return;
                          setReplying((r) => !r);
                        }}
                        className="inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      >
                        <Reply className="size-3.5" />
                        Responder
                      </button>
                    )}
                    {canAccept && !c.isDeleted && (
                      <button
                        type="button"
                        disabled={accept.isPending}
                        onClick={() =>
                          accept.mutate(isAccepted ? null : c.id, {
                            onSuccess: (r) => toast.success(r.acceptedCommentId ? '¡Marcaste la respuesta! La pregunta quedó resuelta ✓' : 'Quitaste la respuesta aceptada'),
                          })
                        }
                        className={cn(
                          'inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-xs font-medium transition-colors',
                          isAccepted
                            ? 'text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-500/15'
                            : 'text-zinc-500 hover:bg-emerald-50 hover:text-emerald-700 dark:text-zinc-400 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300',
                        )}
                      >
                        <CircleCheckBig className="size-3.5" />
                        {isAccepted ? 'Desmarcar respuesta' : 'Marcar como respuesta'}
                      </button>
                    )}
                    {!c.isDeleted && (
                      <Menu>
                        <MenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="Más opciones del comentario"
                            className="grid size-7 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                          >
                            <Ellipsis className="size-4" />
                          </button>
                        </MenuTrigger>
                        <MenuContent align="start">
                          <MenuItem icon={<Link2 />} onSelect={() => shareLink(postPath(post, c.id))}>
                            Copiar link
                          </MenuItem>
                          {isMine && (
                            <MenuItem icon={<Pencil />} onSelect={() => setEditing(true)}>
                              Editar
                            </MenuItem>
                          )}
                          {!isMine && (
                            <MenuItem icon={<Flag />} onSelect={() => requireUser() && setReporting(true)}>
                              Reportar
                            </MenuItem>
                          )}
                          {canDelete && (
                            <>
                              <MenuSeparator />
                              <MenuItem icon={<Trash />} danger onSelect={() => setDeleting(true)}>
                                Borrar
                              </MenuItem>
                            </>
                          )}
                        </MenuContent>
                      </Menu>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {!collapsed && replying && (
            <div className="mt-2">
              <Composer
                postId={post.id}
                parentId={c.id}
                autoFocus
                submitLabel="Responder"
                placeholder={`Respondé a ${displayName(c.author)}…`}
                onDone={() => setReplying(false)}
                onCancel={() => setReplying(false)}
              />
            </div>
          )}

          {!collapsed && hasChildren && (
            <div className="mt-3 space-y-4">
              {depth + 1 < maxDepth
                ? c.replies.map((r) => <CommentItem key={r.id} c={r} depth={depth + 1} />)
                : flattenReplies(c.replies, c).map(({ comment, replyTo: to }) => (
                    <CommentItem key={comment.id} c={comment} depth={depth + 1} flat replyTo={to} />
                  ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="¿Borrar comentario?"
        description="El comentario va a quedar como “[eliminado]” para conservar el hilo. No se puede deshacer."
        confirmLabel="Borrar"
        onConfirm={() => del.mutateAsync(c.id).then(() => toast.success('Comentario borrado'))}
      />
      <ReportDialog open={reporting} onOpenChange={setReporting} target={{ commentId: c.id }} />
    </div>
  );
}

/* ---------------- Sección ---------------- */

function AcceptedAnswer({ c }: { c: Comment }) {
  return (
    <div className="mb-6 rounded-2xl border border-emerald-300/70 bg-linear-to-br from-emerald-50 to-white p-4 dark:border-emerald-500/30 dark:from-emerald-500/[0.08] dark:to-transparent">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          <CircleCheckBig className="size-4" />
          Respuesta aceptada
        </p>
        <a href={`#comment-${c.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-300">
          Ver en el hilo <ArrowDown className="size-3" />
        </a>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
        <Avatar user={c.author} size="sm" />
        <UserLink user={c.author} />
        <span aria-hidden>·</span>
        <TimeAgo date={c.createdAt} />
      </div>
      <Markdown size="sm" className="mt-2">
        {c.body}
      </Markdown>
      <AttachmentList attachments={c.attachments} variant="compact" className="mt-2.5" />
    </div>
  );
}

function CommentSkeleton() {
  return (
    <div className="flex gap-2.5">
      <Skeleton className="size-7 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
    </div>
  );
}

export function CommentSection({ post }: { post: PostDetail }) {
  const { me } = useMe();
  const location = useLocation();
  const [sort, setSort] = useState<CommentSort>('best');
  const [composerOpen, setComposerOpen] = useState(() => hasCommentDraft(post.id));
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const q = useComments(post.id, sort);
  const wide = useMediaQuery('(min-width: 640px)');

  const locked = post.isLocked && !post.canModerate;
  const canReply = !locked;
  const canAccept = !!me && post.type === 'QUESTION' && (post.canEdit || post.canModerate);
  const accepted = post.acceptedCommentId && q.data ? findComment(q.data.items, post.acceptedCommentId) : undefined;
  const loaded = !!q.data;

  // Deep link #comment-123: scroll + resaltado
  useEffect(() => {
    const m = location.hash.match(/^#comment-(\d+)$/);
    if (!m || !loaded) return;
    const id = Number(m[1]);
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(`comment-${id}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightId(id);
    });
    const t = setTimeout(() => setHighlightId(null), 3000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [location.hash, loaded]);

  const ctx: Ctx = { post, me, canAccept, canReply, highlightId, maxDepth: wide ? 7 : 4 };
  const total = q.data?.total ?? post.commentCount;

  return (
    <section id="comentarios" className="scroll-mt-20" aria-labelledby="comments-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="comments-title" className="flex items-center gap-2 text-base font-semibold text-zinc-950 dark:text-white">
          <MessagesSquare className="size-[18px] text-zinc-400" />
          {plural(total, 'comentario')}
        </h2>
        <Segmented
          size="sm"
          ariaLabel="Ordenar comentarios"
          value={sort}
          onChange={setSort}
          items={[
            { value: 'best', label: 'Mejores' },
            { value: 'new', label: 'Nuevos' },
            { value: 'old', label: 'Antiguos' },
          ]}
        />
      </div>

      {post.isLocked && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">Este post está cerrado</p>
            <p className="mt-0.5 text-amber-800/80 dark:text-amber-200/75">
              {post.canModerate ? 'Los comentarios nuevos están desactivados para el resto. Como moderador/a todavía podés comentar.' : 'El equipo de moderación desactivó los comentarios nuevos.'}
            </p>
          </div>
        </div>
      )}

      {!locked &&
        (me ? (
          composerOpen ? (
            <div className="mb-6">
              <Composer postId={post.id} autoFocus onDone={() => setComposerOpen(false)} onCancel={() => setComposerOpen(false)} />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="mb-6 flex w-full items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm text-zinc-400 shadow-xs transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            >
              <Avatar user={me} size="md" />
              Sumate a la conversación…
            </button>
          )
        ) : (
          <div className="mb-6 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-zinc-300 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              <MessageSquare className="mr-1.5 inline size-4 -translate-y-px text-zinc-400" />
              Iniciá sesión para comentar y votar.
            </p>
            <div className="flex gap-2">
              <Link to={loginPath(location.pathname)} className={buttonVariants({ size: 'sm' })}>
                Iniciar sesión
              </Link>
              <Link to="/register" className={buttonVariants({ size: 'sm', variant: 'secondary' })}>
                Registrarse
              </Link>
            </div>
          </div>
        ))}

      {accepted && !accepted.isDeleted && <AcceptedAnswer c={accepted} />}

      {q.isPending ? (
        <div className="space-y-6">
          {Array.from({ length: 4 }, (_, i) => (
            <CommentSkeleton key={i} />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState compact error={q.error} onRetry={() => void q.refetch()} title="No pudimos cargar los comentarios" />
      ) : q.data.items.length === 0 ? (
        <EmptyState
          compact
          icon={MessagesSquare}
          title="Todavía no hay comentarios"
          description={post.type === 'QUESTION' ? '¿Sabés la respuesta? ¡Ayudá respondiendo!' : 'Sé la primera persona en comentar.'}
        />
      ) : (
        <CommentsCtx.Provider value={ctx}>
          <div className="space-y-5">
            {q.data.items.map((c) => (
              <CommentItem key={c.id} c={c} depth={0} />
            ))}
          </div>
        </CommentsCtx.Provider>
      )}
    </section>
  );
}
