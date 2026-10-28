import {
  ChartColumn,
  Check,
  ChevronDown,
  CircleQuestionMark,
  CloudCheck,
  CloudOff,
  FilePen,
  FilePlus,
  FileText,
  Lightbulb,
  Link2,
  Plus,
  Search,
  Send,
  Trash,
  WifiOff,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { AttachmentPicker } from '@/components/attachments/AttachmentPicker';
import { useAttachmentUploads } from '@/components/attachments/useAttachmentUploads';
import { CommunityIcon } from '@/components/common';
import { DraftList } from '@/components/drafts/DraftList';
import { ImageDropzone } from '@/components/ImageDropzone';
import { PageLayout } from '@/components/layout/AppShell';
import { CommunityAbout } from '@/components/layout/RightRail';
import { MarkdownEditor } from '@/components/markdown/MarkdownEditor';
import { MAX_TAGS, TagPicker } from '@/components/posts/TagPicker';
import { Button, buttonVariants } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { FieldError, Input, Select, inputClass } from '@/components/ui/Input';
import { Card, ErrorState, Skeleton } from '@/components/ui/misc';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { Spinner } from '@/components/ui/Spinner';
import { useDocumentTitle, useNow } from '@/hooks';
import { isApiError } from '@/lib/api';
import { ATTACHMENT_LIMITS } from '@/lib/attachments';
import { timeAgo } from '@/lib/time';
import type { Attachment, Community, CreatePostInput, Draft, DraftInput, PostType } from '@/lib/types';
import { cn, formatCount, postPath } from '@/lib/utils';
import { useMe } from '@/queries/auth';
import { useCommunities } from '@/queries/communities';
import { useDeleteDraft, useDraft, useDrafts, useSaveDraft } from '@/queries/drafts';
import { useCreatePost } from '@/queries/posts';

const TYPES: { value: PostType; label: string; icon: LucideIcon; hint: string }[] = [
  { value: 'TEXT', label: 'Texto', icon: FileText, hint: 'Compartí apuntes, novedades o ideas.' },
  { value: 'QUESTION', label: 'Pregunta', icon: CircleQuestionMark, hint: 'Podés marcar la mejor respuesta como solución.' },
  { value: 'POLL', label: 'Encuesta', icon: ChartColumn, hint: 'Entre 2 y 6 opciones. Se puede cambiar el voto.' },
  { value: 'LINK', label: 'Link', icon: Link2, hint: 'Compartí un recurso externo.' },
];

const DURATIONS: { value: string; label: string }[] = [
  { value: '', label: 'Sin límite' },
  { value: '1', label: '1 día' },
  { value: '3', label: '3 días' },
  { value: '7', label: '1 semana' },
  { value: '14', label: '2 semanas' },
  { value: '30', label: '30 días' },
];

const AUTOSAVE_MS = 1500;
const MAX_FILES = ATTACHMENT_LIMITS.post;

/* ---------------- Respaldo local (si el server no está disponible) ---------------- */

const LOCAL_KEY = 'foro:draft';

/** Copia local del borrador: se escribe solo cuando no se pudo guardar en el server (o al cerrar la pestaña). */
interface LocalDraft {
  draftId?: number | null;
  communityId?: number | null;
  type: PostType;
  title: string;
  body: string;
  url: string;
  imageUrl?: string | null;
  tagIds?: number[];
  options?: string[];
  duration?: string;
  attachments?: Attachment[];
  savedAt?: number;
}

function readLocalDraft(): LocalDraft | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as LocalDraft;
    return d && typeof d === 'object' && (d.title || d.body || d.url || d.attachments?.length) ? d : null;
  } catch {
    return null;
  }
}

function writeLocalDraft(d: LocalDraft) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...d, savedAt: Date.now() }));
  } catch {
    /* storage lleno o bloqueado */
  }
}

function clearLocalDraft() {
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* ignorar */
  }
}

/* ---------------- Estado inicial del formulario ---------------- */

interface FormInit {
  draftId: number | null;
  communityId: number | null;
  type: PostType;
  title: string;
  body: string;
  url: string;
  imageUrl: string | null;
  tagIds: number[];
  options: string[];
  duration: string;
  attachments: Attachment[];
  savedAt: number | null;
  restoredLocal: boolean;
}

const EMPTY_INIT: FormInit = {
  draftId: null,
  communityId: null,
  type: 'TEXT',
  title: '',
  body: '',
  url: '',
  imageUrl: null,
  tagIds: [],
  options: ['', ''],
  duration: '7',
  attachments: [],
  savedAt: null,
  restoredLocal: false,
};

function fromDraft(d: Draft): FormInit {
  const opts = d.poll?.options?.length ? d.poll.options : ['', ''];
  return {
    draftId: d.id,
    communityId: d.communityId,
    type: d.type ?? 'TEXT',
    title: d.title ?? '',
    body: d.body ?? '',
    url: d.url ?? '',
    imageUrl: d.imageUrl ?? null,
    tagIds: d.tagIds ?? [],
    options: opts.length >= 2 ? opts : [...opts, ''],
    duration: d.poll ? (d.poll.closesInDays == null ? '' : String(d.poll.closesInDays)) : '7',
    attachments: d.attachments ?? [],
    savedAt: Date.parse(d.updatedAt) || null,
    restoredLocal: false,
  };
}

function fromLocal(d: LocalDraft): FormInit {
  return {
    draftId: d.draftId ?? null,
    communityId: d.communityId ?? null,
    type: d.type ?? 'TEXT',
    title: d.title ?? '',
    body: d.body ?? '',
    url: d.url ?? '',
    imageUrl: d.imageUrl ?? null,
    tagIds: d.tagIds ?? [],
    options: d.options?.length ? d.options : ['', ''],
    duration: d.duration ?? '7',
    attachments: d.attachments ?? [],
    savedAt: null,
    restoredLocal: true,
  };
}

/* ---------------- Estado del autoguardado ---------------- */

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

function SaveIndicator({ status, savedAt, onRetry, className }: { status: SaveStatus; savedAt: number | null; onRetry: () => void; className?: string }) {
  useNow(20_000);
  const base = cn('flex min-w-0 items-center gap-1.5 text-xs', className);
  if (status === 'saving')
    return (
      <p className={cn(base, 'text-zinc-500 dark:text-zinc-400')} aria-live="polite">
        <Spinner className="size-3.5" label="Guardando" />
        Guardando…
      </p>
    );
  if (status === 'error')
    return (
      <p className={cn(base, 'text-rose-600 dark:text-rose-400')} role="status">
        <CloudOff className="size-3.5 shrink-0" />
        <span className="truncate">No se pudo guardar el borrador.</span>
        <button type="button" onClick={onRetry} className="shrink-0 font-semibold underline-offset-2 hover:underline">
          Reintentar
        </button>
      </p>
    );
  if (status === 'offline')
    return (
      <p className={cn(base, 'text-amber-700 dark:text-amber-400')} role="status">
        <WifiOff className="size-3.5 shrink-0" />
        <span className="truncate">Sin conexión: lo guardamos en este dispositivo.</span>
      </p>
    );
  if (status === 'saved' && savedAt) {
    const ago = timeAgo(new Date(savedAt));
    return (
      <p className={cn(base, 'text-zinc-500 dark:text-zinc-400')} aria-live="polite">
        <CloudCheck className="size-3.5 shrink-0 text-emerald-500" />
        <span className="truncate">{ago === 'ahora' ? 'Borrador guardado' : `Borrador guardado ${ago}`}</span>
      </p>
    );
  }
  return (
    <p className={cn(base, 'text-zinc-400 dark:text-zinc-500')}>
      <CloudCheck className="size-3.5 shrink-0" />
      <span className="truncate">Se guarda solo como borrador mientras escribís</span>
    </p>
  );
}

/* ---------------- Diálogo de borradores ---------------- */

function DraftsDialog({ open, onOpenChange, currentId, onOpenDraft }: { open: boolean; onOpenChange: (o: boolean) => void; currentId: number | null; onOpenDraft: (id: number | null) => void }) {
  const q = useDrafts(open);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Tus borradores"
      description="Se guardan solos mientras escribís. Elegí uno para seguir."
      size="lg"
      bodyClassName="px-0 pb-2 pt-3"
      footer={
        <>
          <Link to="/drafts" onClick={() => onOpenChange(false)} className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'mr-auto' })}>
            Ver todos
          </Link>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              onOpenDraft(null);
            }}
          >
            <FilePlus />
            Empezar uno nuevo
          </Button>
        </>
      }
    >
      <DraftList
        drafts={q.data}
        loading={q.isPending}
        error={q.isError ? q.error : null}
        onRetry={() => void q.refetch()}
        currentId={currentId}
        onOpen={(d) => {
          onOpenChange(false);
          if (d.id !== currentId) onOpenDraft(d.id);
        }}
      />
    </Dialog>
  );
}

function CommunityPicker({
  communities,
  value,
  onChange,
  invalid,
}: {
  communities: Community[];
  value: Community | undefined;
  onChange: (c: Community) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const list = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const sorted = [...communities].sort((a, b) => Number(b.isMember) - Number(a.isMember) || b.memberCount - a.memberCount);
    return sorted.filter((c) => !f || c.name.toLowerCase().includes(f) || c.slug.includes(f));
  }, [communities, filter]);

  useEffect(() => {
    setActive(0);
  }, [filter]);

  const choose = (c: Community) => {
    onChange(c);
    setOpen(false);
    setFilter('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-invalid={invalid || undefined}
          className={cn(inputClass, 'flex h-11 w-full items-center gap-2.5 text-left sm:w-80')}
        >
          {value ? (
            <>
              <CommunityIcon community={value} size="sm" />
              <span className="min-w-0 flex-1 truncate font-medium">{value.name}</span>
            </>
          ) : (
            <>
              <span className="grid size-6 place-items-center rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600" />
              <span className="flex-1 text-zinc-400">Elegí una comunidad</span>
            </>
          )}
          <ChevronDown className="size-4 text-zinc-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] overflow-hidden">
        <div className="border-b border-zinc-100 p-2 dark:border-zinc-800">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((i) => Math.min(list.length - 1, i + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((i) => Math.max(0, i - 1));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (list[active]) choose(list[active]);
                }
              }}
              placeholder="Buscar comunidad…"
              aria-label="Buscar comunidad"
              className="h-9 w-full rounded-lg bg-zinc-100 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:bg-zinc-800"
            />
          </div>
        </div>
        <div ref={listRef} role="listbox" className="max-h-72 overflow-y-auto p-1.5">
          {list.length === 0 && <p className="px-3 py-6 text-center text-sm text-zinc-400">Sin resultados</p>}
          {list.map((c, i) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={value?.id === c.id}
              onMouseMove={() => setActive(i)}
              onClick={() => choose(c)}
              className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left', i === active ? 'bg-zinc-100 dark:bg-zinc-800' : '')}
            >
              <CommunityIcon community={c} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{c.name}</span>
                <span className="block text-xs text-zinc-500">
                  {formatCount(c.memberCount)} miembros{c.isMember && ' · Sos miembro'}
                </span>
              </span>
              {value?.id === c.id && <Check className="size-4 text-brand-600" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ---------------- Editor ---------------- */

function SubmitEditor({
  init,
  onDraftCreated,
  onOpenDraft,
}: {
  init: FormInit;
  onDraftCreated: (id: number) => void;
  onOpenDraft: (id: number | null) => void;
}) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { me } = useMe();
  const communities = useCommunities();
  const create = useCreatePost();
  const saveDraft = useSaveDraft();
  const deleteDraft = useDeleteDraft();
  const drafts = useDrafts();

  const [community, setCommunity] = useState<Community | undefined>();
  const [type, setType] = useState<PostType>(init.type);
  const [title, setTitle] = useState(init.title);
  const [body, setBody] = useState(init.body);
  const [url, setUrl] = useState(init.url);
  const [imageUrl, setImageUrl] = useState<string | null>(init.imageUrl);
  const [tagIds, setTagIds] = useState<number[]>(init.tagIds);
  const [options, setOptions] = useState<string[]>(init.options);
  const [duration, setDuration] = useState(init.duration);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [restored, setRestored] = useState(init.restoredLocal);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const uploads = useAttachmentUploads({ max: MAX_FILES, initial: init.attachments, deleteOnRemove: 'all' });

  // Autoguardado
  const draftIdRef = useRef<number | null>(init.draftId);
  const [draftId, setDraftId] = useState<number | null>(init.draftId);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(init.draftId && !init.restoredLocal ? 'saved' : 'idle');
  const [savedAt, setSavedAt] = useState<number | null>(init.savedAt);
  const inFlight = useRef<Promise<void> | null>(null);
  const publishing = useRef(false);

  // Preselección: la comunidad del borrador, o ?community=slug
  const initialCommunityResolved = useRef(false);
  useEffect(() => {
    if (initialCommunityResolved.current || !communities.data) return;
    initialCommunityResolved.current = true;
    const slug = params.get('community');
    const found =
      init.communityId != null ? communities.data.find((c) => c.id === init.communityId) : slug ? communities.data.find((c) => c.slug === slug) : undefined;
    if (found) setCommunity(found);
  }, [communities.data, params, init.communityId]);

  const closesInDays = duration ? Number(duration) : null;
  const snapshot = (): DraftInput => ({
    communityId: community?.id ?? init.communityId ?? null,
    type,
    title,
    body,
    url: url.trim() ? url : null,
    imageUrl,
    tagIds,
    poll: type === 'POLL' ? { options, closesInDays } : null,
    attachmentIds: uploads.ids,
  });
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const fieldsKey = JSON.stringify([community?.id ?? init.communityId, type, title, body, url, imageUrl, tagIds, options, duration, uploads.ids]);
  const keyRef = useRef(fieldsKey);
  keyRef.current = fieldsKey;
  const savedKey = useRef(init.restoredLocal ? '' : fieldsKey);
  const hasContent = !!(title.trim() || body.trim() || url.trim() || uploads.count > 0);

  const localCopy = useCallback(
    (): LocalDraft => {
      const s = snapshotRef.current();
      return {
        draftId: draftIdRef.current,
        communityId: s.communityId ?? null,
        type: s.type ?? 'TEXT',
        title: s.title ?? '',
        body: s.body ?? '',
        url: s.url ?? '',
        imageUrl: s.imageUrl ?? null,
        tagIds: s.tagIds ?? [],
        options,
        duration,
        attachments: uploads.attachments,
      };
    },
    [options, duration, uploads.attachments],
  );
  const localCopyRef = useRef(localCopy);
  localCopyRef.current = localCopy;

  const hasContentRef = useRef(hasContent);
  hasContentRef.current = hasContent;
  /** false después de desmontar: no tocar la URL (el usuario ya está en otro borrador o página). */
  const alive = useRef(true);

  const flush = useCallback(async () => {
    while (inFlight.current) await inFlight.current;
    if (publishing.current) return;
    const key = keyRef.current;
    if (key === savedKey.current) return;
    const input = snapshotRef.current();
    const run = (async () => {
      setSaveStatus('saving');
      try {
        const { draft } = await saveDraft.mutateAsync({ id: draftIdRef.current, input });
        if (!draftIdRef.current) {
          draftIdRef.current = draft.id;
          setDraftId(draft.id);
          if (alive.current) onDraftCreated(draft.id);
        }
        savedKey.current = key;
        setSavedAt(Date.now());
        setSaveStatus('saved');
        clearLocalDraft();
      } catch (err) {
        if (isApiError(err) && err.status === 404 && draftIdRef.current) {
          // Lo borraron desde otra pestaña: el próximo guardado crea uno nuevo.
          draftIdRef.current = null;
          setDraftId(null);
        }
        writeLocalDraft(localCopyRef.current());
        setSaveStatus(isApiError(err) && (err.code === 'NETWORK' || err.status >= 500) ? 'offline' : 'error');
      }
    })();
    inFlight.current = run;
    try {
      await run;
    } finally {
      if (inFlight.current === run) inFlight.current = null;
    }
  }, [saveDraft, onDraftCreated]);
  const flushRef = useRef(flush);
  flushRef.current = flush;

  // Debounce: guarda ~1,5 s después del último cambio (recién cuando hay algo escrito).
  useEffect(() => {
    if (fieldsKey === savedKey.current) return;
    if (!hasContent && !draftIdRef.current) return;
    const t = setTimeout(() => void flushRef.current(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [fieldsKey, hasContent]);

  // Al volver la conexión, reintenta. Al cerrar la pestaña con cambios sin guardar, deja una copia local.
  useEffect(() => {
    const online = () => void flushRef.current();
    const hide = () => {
      if (!publishing.current && keyRef.current !== savedKey.current && (hasContentRef.current || draftIdRef.current)) writeLocalDraft(localCopyRef.current());
    };
    alive.current = true;
    window.addEventListener('online', online);
    window.addEventListener('pagehide', hide);
    return () => {
      alive.current = false;
      window.removeEventListener('online', online);
      window.removeEventListener('pagehide', hide);
      // Al salir de la página (navegación interna) guardamos lo pendiente.
      if (!publishing.current && keyRef.current !== savedKey.current && (hasContentRef.current || draftIdRef.current)) {
        writeLocalDraft(localCopyRef.current());
        void flushRef.current();
      }
    };
  }, []);

  const clearError = (k: string) => errors[k] && setErrors(({ [k]: _drop, ...rest }) => rest);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!community) e.communityId = 'Elegí en qué comunidad publicar.';
    const t = title.trim();
    if (t.length < 3) e.title = 'El título tiene que tener al menos 3 caracteres.';
    else if (t.length > 200) e.title = 'Máximo 200 caracteres.';
    if ((type === 'TEXT' || type === 'QUESTION') && !body.trim()) e.body = type === 'QUESTION' ? 'Contá tu pregunta con un poco más de detalle.' : 'Escribí el contenido del post.';
    if (body.length > 40000) e.body = 'Máximo 40.000 caracteres.';
    if (type === 'LINK') {
      try {
        const u = new URL(url.trim());
        if (!/^https?:$/.test(u.protocol)) throw new Error();
      } catch {
        e.url = 'Ingresá un link válido que empiece con http:// o https://';
      }
    }
    if (type === 'POLL') {
      const opts = options.map((o) => o.trim()).filter(Boolean);
      if (opts.length < 2) e.poll = 'La encuesta necesita al menos 2 opciones.';
      else if (opts.some((o) => o.length > 80)) e.poll = 'Cada opción puede tener hasta 80 caracteres.';
      else if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) e.poll = 'Hay opciones repetidas.';
    }
    if (tagIds.length > MAX_TAGS) e.tags = `Máximo ${MAX_TAGS} etiquetas.`;
    if (uploads.hasErrors) e.attachmentIds = 'Hay archivos que no se pudieron subir: reintentá o quitalos.';
    return e;
  };

  const submit = async () => {
    if (uploads.isUploading) {
      toast.info('Esperá a que terminen de subir los archivos');
      return;
    }
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error('Revisá los campos marcados');
      return;
    }
    publishing.current = true;
    // Si hay un autoguardado en curso, esperamos su id para que el server borre el borrador al publicar.
    while (inFlight.current) await inFlight.current;
    const input: CreatePostInput = {
      communityId: community!.id,
      type,
      title: title.trim(),
      ...(body.trim() ? { body } : {}),
      ...(type === 'LINK' ? { url: url.trim() } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(tagIds.length ? { tagIds } : {}),
      ...(type === 'POLL' ? { poll: { options: options.map((o) => o.trim()).filter(Boolean), closesInDays } } : {}),
      ...(uploads.ids.length ? { attachmentIds: uploads.ids } : {}),
      ...(draftIdRef.current ? { draftId: draftIdRef.current } : {}),
    };
    create.mutate(input, {
      onSuccess: ({ post }) => {
        clearLocalDraft();
        savedKey.current = keyRef.current;
        toast.success('¡Publicado! 🎉');
        navigate(postPath(post), { replace: true });
      },
      onError: (err) => {
        publishing.current = false;
        if (isApiError(err) && err.details) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(err.details))
            mapped[k.startsWith('poll') ? 'poll' : k.startsWith('tag') ? 'tags' : k.startsWith('attachment') ? 'attachmentIds' : k] = v;
          setErrors(mapped);
          toast.error(err.message || 'Revisá los campos marcados');
        }
      },
    });
  };

  const discard = async () => {
    publishing.current = true;
    while (inFlight.current) await inFlight.current;
    clearLocalDraft();
    if (draftIdRef.current) {
      try {
        await deleteDraft.mutateAsync(draftIdRef.current);
      } catch (err) {
        publishing.current = false;
        throw err;
      }
    } else {
      for (const it of uploads.items) uploads.remove(it.key);
    }
    savedKey.current = keyRef.current;
    toast.success('Borrador descartado');
    onOpenDraft(null);
  };

  const typeMeta = TYPES.find((t) => t.value === type)!;
  const draftCount = drafts.data?.length ?? me?.draftCount ?? 0;
  const canDiscard = !!draftId || hasContent;

  return (
    <PageLayout
      aside={
        <>
          {community && <CommunityAbout community={community} />}
          <Card className="p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <Lightbulb className="size-4 text-amber-500" />
              Consejos para un buen post
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li>• Usá un título claro y específico.</li>
              <li>• Si es una duda, contá qué probaste.</li>
              <li>• Adjuntá los apuntes en PDF o el enunciado del TP.</li>
              <li>• Mencioná a alguien con <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">@usuario</code>.</li>
              <li>• Agregá etiquetas para que lo encuentren más fácil.</li>
              <li>• Respetá las reglas de la comunidad.</li>
            </ul>
          </Card>
        </>
      }
    >
      <div className="mb-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">{draftId ? 'Continuar borrador' : 'Crear post'}</h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{typeMeta.hint}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setDraftsOpen(true)} className="shrink-0">
          <FilePen />
          Borradores
          {draftCount > 0 && (
            <span className="rounded-md bg-zinc-100 px-1.5 text-[11px] font-semibold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{draftCount}</span>
          )}
        </Button>
      </div>

      {restored && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/70 px-3.5 py-2.5 text-sm text-brand-800 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-200">
          <span>Recuperamos cambios que no se habían llegado a guardar.</span>
          <button type="button" onClick={() => setRestored(false)} className="shrink-0 font-semibold hover:underline">
            Entendido
          </button>
        </div>
      )}

      <div className="mb-4">
        {communities.isPending ? (
          <Skeleton className="h-11 w-full rounded-xl sm:w-80" />
        ) : (
          <CommunityPicker
            communities={communities.data ?? []}
            value={community}
            invalid={!!errors.communityId}
            onChange={(c) => {
              setCommunity(c);
              clearError('communityId');
            }}
          />
        )}
        <FieldError>{errors.communityId}</FieldError>
      </div>

      <div className="surface overflow-hidden">
        <div role="tablist" aria-label="Tipo de post" className="no-scrollbar flex overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={type === t.value}
              onClick={() => setType(t.value)}
              className={cn(
                'relative flex h-12 flex-1 shrink-0 items-center justify-center gap-2 px-2.5 text-[13px] font-medium transition-colors sm:px-4 sm:text-sm',
                type === t.value
                  ? 'text-brand-700 dark:text-brand-300'
                  : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/40 dark:hover:text-zinc-200',
              )}
            >
              <t.icon className="hidden size-4 min-[400px]:block" />
              {t.label}
              <span className={cn('absolute inset-x-3 bottom-0 h-0.5 rounded-full', type === t.value ? 'bg-brand-600 dark:bg-brand-400' : 'bg-transparent')} />
            </button>
          ))}
        </div>

        <div className="space-y-5 p-4 sm:p-5">
          <div>
            <div className="relative">
              <Input
                value={title}
                maxLength={200}
                onChange={(e) => {
                  setTitle(e.target.value);
                  clearError('title');
                }}
                placeholder={type === 'QUESTION' ? '¿Cuál es tu pregunta?' : type === 'POLL' ? '¿Qué querés preguntar?' : 'Título'}
                aria-label="Título"
                aria-invalid={!!errors.title || undefined}
                className="h-12 pr-16 text-base font-medium"
              />
              <span className={cn('pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs tabular-nums', title.length > 180 ? 'text-amber-600' : 'text-zinc-400')}>
                {title.length}/200
              </span>
            </div>
            <FieldError>{errors.title}</FieldError>
          </div>

          {type === 'LINK' && (
            <div>
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={url}
                  type="url"
                  inputMode="url"
                  onChange={(e) => {
                    setUrl(e.target.value);
                    clearError('url');
                  }}
                  placeholder="https://…"
                  aria-label="Link"
                  aria-invalid={!!errors.url || undefined}
                  className="h-11 pl-10"
                />
              </div>
              <FieldError>{errors.url}</FieldError>
            </div>
          )}

          <div>
            <MarkdownEditor
              value={body}
              onChange={(v) => {
                setBody(v);
                clearError('body');
              }}
              maxLength={40000}
              minRows={type === 'TEXT' || type === 'QUESTION' ? 8 : 4}
              invalid={!!errors.body}
              onSubmit={() => void submit()}
              onAttachFiles={uploads.add}
              placeholder={
                type === 'QUESTION'
                  ? 'Contá qué necesitás saber y qué probaste hasta ahora…'
                  : type === 'POLL' || type === 'LINK'
                    ? 'Descripción (opcional)'
                    : 'Escribí tu post… (soporta Markdown)'
              }
            />
            <FieldError>{errors.body}</FieldError>
          </div>

          {type === 'POLL' && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Opciones</p>
                <span className="text-xs text-zinc-400">{options.length}/6</span>
              </div>
              <div className="space-y-2">
                {options.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-500 dark:bg-zinc-800">{i + 1}</span>
                    <Input
                      value={o}
                      maxLength={80}
                      onChange={(e) => {
                        const next = [...options];
                        next[i] = e.target.value;
                        setOptions(next);
                        clearError('poll');
                      }}
                      placeholder={`Opción ${i + 1}`}
                      aria-label={`Opción ${i + 1}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Quitar opción ${i + 1}`}
                      disabled={options.length <= 2}
                      onClick={() => setOptions(options.filter((_, j) => j !== i))}
                    >
                      <X />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <Button variant="outline" size="sm" disabled={options.length >= 6} onClick={() => setOptions([...options, ''])}>
                  <Plus />
                  Agregar opción
                </Button>
                <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Duración
                  <Select value={duration} onChange={(e) => setDuration(e.target.value)} className="h-9 w-36">
                    {DURATIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
              <FieldError>{errors.poll}</FieldError>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                Archivos adjuntos <span className="font-normal text-zinc-400">(opcional)</span>
              </p>
              {uploads.count > 0 && (
                <span className="text-xs tabular-nums text-zinc-400">
                  {uploads.count}/{MAX_FILES}
                </span>
              )}
            </div>
            <AttachmentPicker uploads={uploads} />
            <FieldError>{errors.attachmentIds}</FieldError>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
              Imagen de portada <span className="font-normal text-zinc-400">(opcional)</span>
            </p>
            <ImageDropzone value={imageUrl} onChange={setImageUrl} />
            <FieldError>{errors.imageUrl}</FieldError>
          </div>

          <div>
            <p className="mb-2 text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
              Etiquetas <span className="font-normal text-zinc-400">(hasta {MAX_TAGS})</span>
            </p>
            <TagPicker value={tagIds} onChange={setTagIds} />
            <FieldError>{errors.tags}</FieldError>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-zinc-100 bg-zinc-50/60 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <SaveIndicator status={saveStatus} savedAt={savedAt} onRetry={() => void flush()} />
            {canDiscard && (
              <button
                type="button"
                onClick={() => setDiscardOpen(true)}
                className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-medium text-zinc-400 transition-colors hover:text-rose-600 sm:ml-0 dark:hover:text-rose-400"
              >
                <Trash className="size-3.5" />
                Descartar
              </button>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <Link to={community ? `/c/${community.slug}` : '/'} className={buttonVariants({ variant: 'ghost' })}>
              Cancelar
            </Link>
            <Button onClick={() => void submit()} loading={create.isPending} disabled={uploads.isUploading} size="lg" className="sm:min-w-36">
              {uploads.isUploading ? (
                <>
                  <Spinner className="size-4" label="Subiendo archivos" />
                  Subiendo archivos…
                </>
              ) : (
                <>
                  <Send />
                  Publicar
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <DraftsDialog open={draftsOpen} onOpenChange={setDraftsOpen} currentId={draftId} onOpenDraft={onOpenDraft} />
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="¿Descartar este borrador?"
        description={uploads.count > 0 ? 'Se borra lo que escribiste y los archivos que adjuntaste. No se puede deshacer.' : 'Se borra lo que escribiste. No se puede deshacer.'}
        confirmLabel="Descartar"
        onConfirm={discard}
      />
    </PageLayout>
  );
}

/* ---------------- Página ---------------- */

function SubmitSkeleton() {
  return (
    <PageLayout>
      <Skeleton className="mb-2 h-7 w-48" />
      <Skeleton className="mb-6 h-4 w-72" />
      <Skeleton className="mb-4 h-11 w-full rounded-xl sm:w-80" />
      <div className="surface space-y-4 p-5">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </PageLayout>
  );
}

/** Carga el borrador (?draft=id) o el respaldo local y arma el estado inicial del editor. */
function SubmitLoader({ draftId, onDraftCreated, onOpenDraft }: { draftId: number | null; onDraftCreated: (id: number) => void; onOpenDraft: (id: number | null) => void }) {
  const local = useMemo(readLocalDraft, []);
  const q = useDraft(draftId);
  const notFound = q.isError && isApiError(q.error) && (q.error.status === 404 || q.error.status === 403);

  useEffect(() => {
    if (!notFound) return;
    toast.error('Ese borrador ya no existe');
    onOpenDraft(null);
  }, [notFound, onOpenDraft]);

  const init = useMemo<FormInit | null>(() => {
    if (draftId == null) {
      // Sin ?draft: si quedó un respaldo local lo recuperamos (y si tenía id, seguimos ese borrador).
      return local ? fromLocal(local) : EMPTY_INIT;
    }
    if (q.data) {
      const serverAt = Date.parse(q.data.updatedAt) || 0;
      if (local?.draftId === draftId && (local.savedAt ?? 0) > serverAt) return { ...fromLocal(local), savedAt: serverAt };
      return fromDraft(q.data);
    }
    if (q.isError && !notFound && local?.draftId === draftId) return fromLocal(local);
    return null;
  }, [draftId, q.data, q.isError, notFound, local]);

  // Respaldo local con id → reflejarlo en la URL (sin remontar).
  const announced = useRef(false);
  useEffect(() => {
    if (announced.current || !init || draftId != null || init.draftId == null) return;
    announced.current = true;
    onDraftCreated(init.draftId);
  }, [init, draftId, onDraftCreated]);

  if (init) return <SubmitEditor init={init} onDraftCreated={onDraftCreated} onOpenDraft={onOpenDraft} />;
  if (q.isError && !notFound)
    return (
      <div className="surface">
        <ErrorState error={q.error} onRetry={() => void q.refetch()} title="No pudimos abrir el borrador" />
      </div>
    );
  return <SubmitSkeleton />;
}

function parseDraftParam(v: string | null) {
  const n = Number(v);
  return v && Number.isInteger(n) && n > 0 ? n : null;
}

export default function SubmitPage() {
  useDocumentTitle('Crear post');
  const [params, setParams] = useSearchParams();
  const paramId = parseDraftParam(params.get('draft'));
  // `key` cambia solo cuando el usuario abre otro borrador (no cuando el autoguardado crea uno).
  const [session, setSession] = useState({ key: 0, draftId: paramId });

  useEffect(() => {
    if (paramId !== session.draftId) setSession((s) => ({ key: s.key + 1, draftId: paramId }));
  }, [paramId, session.draftId]);

  const onDraftCreated = useCallback(
    (id: number) => {
      setSession((s) => ({ ...s, draftId: id }));
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('draft', String(id));
          next.delete('community');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const onOpenDraft = useCallback(
    (id: number | null) => {
      if (id == null) clearLocalDraft();
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id == null) next.delete('draft');
          else next.set('draft', String(id));
          next.delete('community');
          return next;
        },
        { replace: false },
      );
      window.scrollTo({ top: 0 });
    },
    [setParams],
  );

  return <SubmitLoader key={session.key} draftId={session.draftId} onDraftCreated={onDraftCreated} onOpenDraft={onOpenDraft} />;
}
