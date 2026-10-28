import {
  ArrowLeft,
  Bookmark,
  Ellipsis,
  Eye,
  Flag,
  Lock,
  LockOpen,
  MessageSquare,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  SearchX,
  Share2,
  ShieldCheck,
  Trash,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { AttachmentList } from '@/components/attachments/AttachmentList';
import { AttachmentPicker } from '@/components/attachments/AttachmentPicker';
import { sameIds, useAttachmentUploads } from '@/components/attachments/useAttachmentUploads';
import { CommentSection } from '@/components/comments/CommentSection';
import { CommunityChip, TagChip, TimeAgo, UserLink } from '@/components/common';
import { ImageDropzone } from '@/components/ImageDropzone';
import { ImageLightbox } from '@/components/ImageLightbox';
import { PageLayout } from '@/components/layout/AppShell';
import { CommunityAbout } from '@/components/layout/RightRail';
import { Markdown } from '@/components/markdown/Markdown';
import { MarkdownEditor } from '@/components/markdown/MarkdownEditor';
import { PollWidget } from '@/components/posts/PollWidget';
import { LinkCard, PostBadges } from '@/components/posts/PostBits';
import { ReportDialog } from '@/components/posts/ReportDialog';
import { TagPicker } from '@/components/posts/TagPicker';
import { usePostActions } from '@/components/posts/usePostActions';
import { VoteControl } from '@/components/posts/VoteControl';
import { ReactionBar } from '@/components/reactions/ReactionBar';
import { Avatar } from '@/components/ui/Avatar';
import { Button, buttonVariants } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Input';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/Menu';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/Popover';
import { useDocumentTitle } from '@/hooks';
import { isApiError } from '@/lib/api';
import { ATTACHMENT_LIMITS } from '@/lib/attachments';
import { fullDate } from '@/lib/time';
import type { PostDetail } from '@/lib/types';
import { cn, formatCount, slugify } from '@/lib/utils';
import { useMe, useRequireUser } from '@/queries/auth';
import { useCommunity } from '@/queries/communities';
import { useDeletePost, useLockPost, usePinPost, usePost, useUpdatePost } from '@/queries/posts';

function PostSkeleton() {
  return (
    <div className="surface p-5">
      <div className="flex items-center gap-2">
        <Skeleton className="size-6 rounded-lg" />
        <Skeleton className="h-3.5 w-40" />
      </div>
      <Skeleton className="mt-4 h-7 w-4/5" />
      <Skeleton className="mt-2 h-7 w-1/2" />
      <div className="mt-6 space-y-2.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="mt-6 flex gap-2">
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
    </div>
  );
}

function EditPost({ post, onDone }: { post: PostDetail; onDone: () => void }) {
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [tagIds, setTagIds] = useState(post.tags.map((t) => t.id));
  const [imageUrl, setImageUrl] = useState<string | null>(post.imageUrl);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const update = useUpdatePost(post.id);
  const bodyRequired = post.type === 'TEXT' || post.type === 'QUESTION';
  const initialIds = (post.attachments ?? []).map((a) => a.id);
  const uploads = useAttachmentUploads({ max: ATTACHMENT_LIMITS.post, initial: post.attachments });

  const cancel = () => {
    uploads.discard();
    onDone();
  };

  const save = () => {
    if (uploads.isUploading) return;
    const errs: Record<string, string> = {};
    if (uploads.hasErrors) errs.attachmentIds = 'Hay archivos que no se pudieron subir: reintentá o quitalos.';
    const t = title.trim();
    if (t.length < 3 || t.length > 200) errs.title = 'El título tiene que tener entre 3 y 200 caracteres.';
    if (bodyRequired && !body.trim()) errs.body = 'El contenido no puede estar vacío.';
    if (body.length > 40000) errs.body = 'Máximo 40.000 caracteres.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    update.mutate(
      { title: t, body, tagIds, imageUrl, ...(sameIds(uploads.ids, initialIds) ? {} : { attachmentIds: uploads.ids }) },
      {
        onSuccess: () => {
          toast.success('Cambios guardados');
          onDone();
        },
        onError: (e) => {
          if (isApiError(e) && e.details) setErrors(e.details);
        },
      },
    );
  };

  return (
    <div className="mt-3 space-y-4">
      <Field label="Título" error={errors.title} labelRight={<span className="tabular-nums text-zinc-400">{title.length}/200</span>}>
        {(p) => <Input {...p} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className="h-11 text-base font-semibold" />}
      </Field>
      <div>
        <p className="mb-1.5 text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Contenido</p>
        <MarkdownEditor value={body} onChange={setBody} maxLength={40000} minRows={8} invalid={!!errors.body} onSubmit={save} onAttachFiles={uploads.add} />
        {errors.body && <p className="mt-1.5 text-[13px] text-rose-600">{errors.body}</p>}
      </div>
      <div>
        <p className="mb-1.5 text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Archivos adjuntos</p>
        <AttachmentPicker uploads={uploads} />
        {errors.attachmentIds && <p className="mt-1.5 text-[13px] text-rose-600">{errors.attachmentIds}</p>}
      </div>
      <div>
        <p className="mb-1.5 text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Imagen de portada</p>
        <ImageDropzone value={imageUrl} onChange={setImageUrl} />
      </div>
      <div>
        <p className="mb-2 text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Etiquetas</p>
        <TagPicker value={tagIds} onChange={setTagIds} />
      </div>
      <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <Button variant="secondary" onClick={cancel} disabled={update.isPending}>
          Cancelar
        </Button>
        <Button onClick={save} loading={update.isPending} disabled={uploads.isUploading}>
          {uploads.isUploading ? 'Subiendo archivos…' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  );
}

function ActionPill({ icon: Icon, label, onClick, active, children }: { icon: typeof Share2; label: string; onClick: () => void; active?: boolean; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors',
        active
          ? 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20'
          : 'bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white',
      )}
    >
      <Icon className={cn('size-4', active && 'fill-current')} />
      {children}
    </button>
  );
}

function PostView({ post }: { post: PostDetail }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { me } = useMe();
  const requireUser = useRequireUser();
  const { vote, toggleBookmark, share } = usePostActions(post);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reporting, setReporting] = useState(false);
  const del = useDeletePost();
  const pin = usePinPost();
  const lock = useLockPost();
  const isAuthor = !!me && post.author?.id === me.id;

  // #comentarios → scroll a la sección
  useEffect(() => {
    if (location.hash === '#comentarios' || location.hash === '#adjuntos') {
      const id = location.hash.slice(1);
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [location.hash]);

  // Normaliza la URL con el slug del título
  useEffect(() => {
    const expected = `/p/${post.id}/${slugify(post.title)}`;
    if (slugify(post.title) && location.pathname !== expected) {
      navigate({ pathname: expected, search: location.search, hash: location.hash }, { replace: true });
    }
  }, [post.id, post.title, location.pathname, location.search, location.hash, navigate]);

  return (
    <>
      <article className="surface mb-6 overflow-hidden">
        <div className="flex">
          <div className="hidden w-14 shrink-0 justify-center pt-5 sm:flex">
            <VoteControl score={post.score} myVote={post.myVote} onVote={vote} />
          </div>
          <div className="min-w-0 flex-1 p-4 sm:py-5 sm:pl-1 sm:pr-6">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              <CommunityChip community={post.community} />
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1.5">
                <Avatar user={post.author} size="xs" />
                <UserLink user={post.author} />
              </span>
              <span aria-hidden>·</span>
              <TimeAgo date={post.createdAt} />
              {post.editedAt && (
                <Tooltip content={`Editado el ${fullDate(post.editedAt)}`}>
                  <span className="italic">(editado)</span>
                </Tooltip>
              )}
              <span className="ml-auto inline-flex items-center gap-1 text-zinc-400" title="Vistas">
                <Eye className="size-3.5" /> {formatCount(post.viewCount)}
              </span>
            </div>

            {editing ? (
              <EditPost post={post} onDone={() => setEditing(false)} />
            ) : (
              <>
                <h1 className="mt-2.5 text-[22px] font-bold leading-tight tracking-tight text-zinc-950 [overflow-wrap:anywhere] sm:text-2xl dark:text-white">{post.title}</h1>
                {(post.isPinned || post.isLocked || post.type !== 'TEXT') && <PostBadges post={post} className="mt-2.5" />}
                {post.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {post.tags.map((t) => (
                      <TagChip key={t.id} tag={t} />
                    ))}
                  </div>
                )}
                {post.type === 'LINK' && post.url && <LinkCard url={post.url} className="mt-4" />}
                {post.imageUrl && (
                  <ImageLightbox src={post.imageUrl} alt={post.title} className="mt-4 w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
                    <img src={post.imageUrl} alt="" className="max-h-[32rem] w-full object-cover transition-transform duration-300 group-hover/img:scale-[1.01]" />
                  </ImageLightbox>
                )}
                {post.body.trim() && <Markdown className="mt-4">{post.body}</Markdown>}
                {post.poll && (
                  <div className="mt-5">
                    <PollWidget postId={post.id} poll={post.poll} />
                  </div>
                )}
                {(post.attachments?.length ?? 0) > 0 && (
                  <section id="adjuntos" aria-labelledby="adjuntos-title" className="mt-6 scroll-mt-24">
                    <h2 id="adjuntos-title" className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      <Paperclip className="size-4 text-zinc-400" />
                      Archivos adjuntos
                      <span className="font-normal text-zinc-400">({post.attachments!.length})</span>
                    </h2>
                    <AttachmentList attachments={post.attachments} />
                  </section>
                )}
                <ReactionBar target={{ type: 'post', id: post.id }} reactions={post.reactions} className="mt-5" />
              </>
            )}

            {!editing && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <VoteControl score={post.score} myVote={post.myVote} onVote={vote} orientation="horizontal" size="sm" className="sm:hidden" />
                <a
                  href="#comentarios"
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-zinc-100/80 px-3 text-[13px] font-medium text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                >
                  <MessageSquare className="size-4" />
                  {formatCount(post.commentCount)} <span className="hidden sm:inline">{post.commentCount === 1 ? 'comentario' : 'comentarios'}</span>
                </a>
                <ActionPill icon={Share2} label="Compartir" onClick={share}>
                  <span className="hidden sm:inline">Compartir</span>
                </ActionPill>
                <ActionPill icon={Bookmark} label={post.isBookmarked ? 'Quitar de guardados' : 'Guardar'} onClick={toggleBookmark} active={post.isBookmarked}>
                  <span className="hidden sm:inline">{post.isBookmarked ? 'Guardado' : 'Guardar'}</span>
                </ActionPill>

                <div className="ml-auto flex items-center gap-1.5">
                  {post.canEdit && (
                    <ActionPill icon={Pencil} label="Editar" onClick={() => setEditing(true)}>
                      <span className="hidden sm:inline">Editar</span>
                    </ActionPill>
                  )}
                  <Menu>
                    <MenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Más opciones"
                        className="grid size-8 place-items-center rounded-full bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        <Ellipsis className="size-4" />
                      </button>
                    </MenuTrigger>
                    <MenuContent>
                      {!isAuthor && (
                        <MenuItem icon={<Flag />} onSelect={() => requireUser() && setReporting(true)}>
                          Reportar
                        </MenuItem>
                      )}
                      {(post.canEdit || post.canModerate) && !isAuthor && <MenuSeparator />}
                      {post.canEdit && (
                        <MenuItem icon={<Pencil />} onSelect={() => setEditing(true)}>
                          Editar post
                        </MenuItem>
                      )}
                      {post.canModerate && (
                        <>
                          <MenuLabel className="flex items-center gap-1">
                            <ShieldCheck className="size-3" /> Moderación
                          </MenuLabel>
                          <MenuItem
                            icon={post.isPinned ? <PinOff /> : <Pin />}
                            onSelect={() =>
                              pin.mutate(
                                { id: post.id, pinned: !post.isPinned },
                                { onSuccess: (r) => toast.success(r.isPinned ? 'Post fijado en la comunidad' : 'Post desfijado') },
                              )
                            }
                          >
                            {post.isPinned ? 'Desfijar' : 'Fijar en la comunidad'}
                          </MenuItem>
                          <MenuItem
                            icon={post.isLocked ? <LockOpen /> : <Lock />}
                            onSelect={() =>
                              lock.mutate(
                                { id: post.id, locked: !post.isLocked },
                                { onSuccess: (r) => toast.success(r.isLocked ? 'Post cerrado: no se aceptan comentarios nuevos' : 'Post reabierto') },
                              )
                            }
                          >
                            {post.isLocked ? 'Reabrir comentarios' : 'Cerrar comentarios'}
                          </MenuItem>
                        </>
                      )}
                      {(post.canEdit || post.canModerate) && (
                        <>
                          <MenuSeparator />
                          <MenuItem icon={<Trash />} danger onSelect={() => setDeleting(true)}>
                            Borrar post
                          </MenuItem>
                        </>
                      )}
                      {!post.canEdit && !post.canModerate && isAuthor && (
                        <MenuItem icon={<Share2 />} onSelect={share}>
                          Copiar link
                        </MenuItem>
                      )}
                    </MenuContent>
                  </Menu>
                </div>
              </div>
            )}
          </div>
        </div>
      </article>

      <CommentSection post={post} />

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="¿Borrar este post?"
        description="Se va a borrar el post junto con sus comentarios. Esta acción no se puede deshacer."
        confirmLabel="Borrar post"
        onConfirm={() =>
          del.mutateAsync(post.id).then(() => {
            toast.success('Post borrado');
            navigate(`/c/${post.community.slug}`, { replace: true });
          })
        }
      />
      <ReportDialog open={reporting} onOpenChange={setReporting} target={{ postId: post.id }} />
    </>
  );
}

function PostAside({ slug }: { slug: string }) {
  const c = useCommunity(slug);
  if (!c.data) return null;
  return <CommunityAbout community={c.data} showJoin />;
}

export function PostPage() {
  const { id } = useParams();
  const postId = Number(id);
  const q = usePost(postId);
  const post = q.data?.post;
  const navigate = useNavigate();
  useDocumentTitle(post ? post.title : 'Post');

  const back = (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
      className="mb-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      <ArrowLeft className="size-4" />
      Volver
    </button>
  );

  if (!Number.isFinite(postId) || postId <= 0 || (q.isError && isApiError(q.error) && q.error.status === 404)) {
    return (
      <div className="surface">
        <EmptyState
          icon={SearchX}
          tone="zinc"
          title="Este post no existe"
          description="Puede que lo hayan borrado o que el link esté mal."
          action={
            <Link to="/" className={buttonVariants()}>
              Ir al inicio
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <PageLayout aside={post ? <PostAside slug={post.community.slug} /> : undefined}>
      {back}
      {q.isPending ? (
        <PostSkeleton />
      ) : q.isError ? (
        <div className="surface">
          <ErrorState error={q.error} onRetry={() => void q.refetch()} title="No pudimos cargar el post" />
        </div>
      ) : (
        post && <PostView post={post} />
      )}
    </PageLayout>
  );
}
