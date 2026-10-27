import {
  ChartColumn,
  Check,
  ChevronDown,
  CircleQuestionMark,
  FileText,
  Lightbulb,
  Link2,
  Plus,
  Search,
  Send,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { CommunityIcon } from '@/components/common';
import { ImageDropzone } from '@/components/ImageDropzone';
import { PageLayout } from '@/components/layout/AppShell';
import { CommunityAbout } from '@/components/layout/RightRail';
import { MarkdownEditor } from '@/components/markdown/MarkdownEditor';
import { MAX_TAGS, TagPicker } from '@/components/posts/TagPicker';
import { Button, buttonVariants } from '@/components/ui/Button';
import { FieldError, Input, Select, inputClass } from '@/components/ui/Input';
import { Card, Skeleton } from '@/components/ui/misc';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { useDocumentTitle } from '@/hooks';
import { isApiError } from '@/lib/api';
import type { Community, CreatePostInput, PostType } from '@/lib/types';
import { cn, formatCount, postPath } from '@/lib/utils';
import { useCommunities } from '@/queries/communities';
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

const DRAFT_KEY = 'foro:draft';

interface Draft {
  type: PostType;
  title: string;
  body: string;
  url: string;
  options: string[];
}

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
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

  useEffect(() => setActive(0), [filter]);

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

export default function SubmitPage() {
  useDocumentTitle('Crear post');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const communities = useCommunities();
  const create = useCreatePost();
  const draft = useMemo(readDraft, []);

  const [community, setCommunity] = useState<Community | undefined>();
  const [type, setType] = useState<PostType>(draft?.type ?? 'TEXT');
  const [title, setTitle] = useState(draft?.title ?? '');
  const [body, setBody] = useState(draft?.body ?? '');
  const [url, setUrl] = useState(draft?.url ?? '');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [options, setOptions] = useState<string[]>(draft?.options?.length ? draft.options : ['', '']);
  const [duration, setDuration] = useState('7');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [restored, setRestored] = useState(!!draft && !!(draft.title || draft.body));

  // Preselección por ?community=slug
  useEffect(() => {
    if (community || !communities.data) return;
    const slug = params.get('community');
    const found = slug ? communities.data.find((c) => c.slug === slug) : undefined;
    if (found) setCommunity(found);
  }, [communities.data, params, community]);

  // Autoguardado del borrador (solo en este navegador)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (title || body || url) localStorage.setItem(DRAFT_KEY, JSON.stringify({ type, title, body, url, options } satisfies Draft));
        else localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignorar */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [type, title, body, url, options]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignorar */
    }
  };

  const discardDraft = () => {
    setTitle('');
    setBody('');
    setUrl('');
    setOptions(['', '']);
    setRestored(false);
    clearDraft();
  };

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
    return e;
  };

  const submit = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error('Revisá los campos marcados');
      return;
    }
    const input: CreatePostInput = {
      communityId: community!.id,
      type,
      title: title.trim(),
      ...(body.trim() ? { body } : {}),
      ...(type === 'LINK' ? { url: url.trim() } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(tagIds.length ? { tagIds } : {}),
      ...(type === 'POLL'
        ? { poll: { options: options.map((o) => o.trim()).filter(Boolean), closesInDays: duration ? Number(duration) : null } }
        : {}),
    };
    create.mutate(input, {
      onSuccess: ({ post }) => {
        clearDraft();
        toast.success('¡Publicado! 🎉');
        navigate(postPath(post), { replace: true });
      },
      onError: (err) => {
        if (isApiError(err) && err.details) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(err.details)) mapped[k.startsWith('poll') ? 'poll' : k.startsWith('tag') ? 'tags' : k] = v;
          setErrors(mapped);
          toast.error(err.message || 'Revisá los campos marcados');
        }
      },
    });
  };

  const typeMeta = TYPES.find((t) => t.value === type)!;

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
              <li>• Mencioná a alguien con <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">@usuario</code>.</li>
              <li>• Agregá etiquetas para que lo encuentren más fácil.</li>
              <li>• Respetá las reglas de la comunidad.</li>
            </ul>
          </Card>
        </>
      }
    >
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">Crear post</h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{typeMeta.hint}</p>
        </div>
      </div>

      {restored && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/70 px-3.5 py-2.5 text-sm text-brand-800 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-200">
          <span>Recuperamos el borrador que dejaste sin publicar.</span>
          <button type="button" onClick={discardDraft} className="shrink-0 font-semibold hover:underline">
            Descartar
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
                'relative flex h-12 flex-1 shrink-0 items-center justify-center gap-2 px-4 text-sm font-medium transition-colors',
                type === t.value
                  ? 'text-brand-700 dark:text-brand-300'
                  : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/40 dark:hover:text-zinc-200',
              )}
            >
              <t.icon className="size-4" />
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
              onSubmit={submit}
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

        <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 bg-zinc-50/60 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-end sm:px-5 dark:border-zinc-800 dark:bg-zinc-900/40">
          <Link to={community ? `/c/${community.slug}` : '/'} className={buttonVariants({ variant: 'ghost' })}>
            Cancelar
          </Link>
          <Button onClick={submit} loading={create.isPending} size="lg" className="sm:min-w-36">
            <Send />
            Publicar
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
