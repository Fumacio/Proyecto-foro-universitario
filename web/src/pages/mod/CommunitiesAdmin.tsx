import { ArrowDown, ArrowUp, LayoutGrid, Pencil, Plus, Trash, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { CommunityIcon } from '@/components/common';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Field, FieldError, Input, Textarea } from '@/components/ui/Input';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';
import { useDocumentTitle } from '@/hooks';
import { isApiError } from '@/lib/api';
import type { Community, CommunityInput } from '@/lib/types';
import { cn, formatNumber, slugify } from '@/lib/utils';
import { useCommunities, useDeleteCommunity, useSaveCommunity } from '@/queries/communities';

export const EMOJIS = ['💬', '💻', '🧮', '📐', '📊', '⚡', '🔌', '⚙️', '🧪', '🏗️', '🏭', '🤖', '🧠', '📚', '📝', '🎓', '🗓️', '📢', '💼', '🎮', '🎵', '⚽', '☕', '🌎', '🔬', '🛰️', '📡', '🧬', '💡', '🔧', '🚀', '🏆'];
export const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#64748b'];

function CommunityForm({ community, open, onOpenChange }: { community: Community | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const editing = !!community;
  const [form, setForm] = useState<CommunityInput>(() =>
    community
      ? { name: community.name, slug: community.slug, description: community.description, icon: community.icon, color: community.color, rules: [...community.rules] }
      : { name: '', slug: '', description: '', icon: '💬', color: '#6366f1', rules: [] },
  );
  const [slugTouched, setSlugTouched] = useState(editing);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useSaveCommunity();

  const set = <K extends keyof CommunityInput>(k: K, v: CommunityInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = 'Ingresá un nombre.';
    if (!/^[a-z0-9-]{2,40}$/.test(form.slug)) e.slug = 'Solo minúsculas, números y guiones (2–40).';
    if (!/^#[0-9a-fA-F]{6}$/.test(form.color)) e.color = 'Color inválido.';
    if (!form.icon.trim()) e.icon = 'Elegí un emoji.';
    setErrors(e);
    if (Object.keys(e).length) return;
    save.mutate(
      { slug: community?.slug, input: { ...form, name: form.name.trim(), description: form.description.trim(), rules: form.rules.map((r) => r.trim()).filter(Boolean) } },
      {
        onSuccess: ({ community: c }) => {
          toast.success(editing ? 'Comunidad actualizada' : `Comunidad ${c.icon} ${c.name} creada`);
          onOpenChange(false);
        },
        onError: (err) => isApiError(err) && err.details && setErrors(err.details),
      },
    );
  };

  const moveRule = (i: number, d: -1 | 1) => {
    const r = [...form.rules];
    const j = i + d;
    if (j < 0 || j >= r.length) return;
    [r[i], r[j]] = [r[j], r[i]];
    set('rules', r);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={editing ? `Editar ${community.name}` : 'Nueva comunidad'}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            {editing ? 'Guardar cambios' : 'Crear comunidad'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <CommunityIcon community={form} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{form.name || 'Nombre de la comunidad'}</p>
            <p className="text-xs text-zinc-500">c/{form.slug || 'slug'}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" error={errors.name}>
            {(p) => (
              <Input
                {...p}
                value={form.name}
                maxLength={60}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name, 40) }));
                }}
                placeholder="Análisis Matemático I"
              />
            )}
          </Field>
          <Field label="Slug (URL)" error={errors.slug} hint={editing ? 'El slug no se puede cambiar.' : undefined}>
            {(p) => (
              <Input
                {...p}
                value={form.slug}
                disabled={editing}
                maxLength={40}
                onChange={(e) => {
                  setSlugTouched(true);
                  set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                }}
                placeholder="analisis-1"
              />
            )}
          </Field>
        </div>
        <Field label="Descripción" error={errors.description}>
          {(p) => <Textarea {...p} rows={3} maxLength={500} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="¿De qué se trata esta comunidad?" />}
        </Field>
        <div>
          <p className="mb-2 text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Ícono</p>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => set('icon', em)}
                aria-pressed={form.icon === em}
                aria-label={`Ícono ${em}`}
                className={cn('grid size-9 place-items-center rounded-lg text-lg transition-all', form.icon === em ? 'bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-500/15' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800')}
              >
                {em}
              </button>
            ))}
            <Input value={form.icon} onChange={(e) => set('icon', [...e.target.value].slice(-2).join(''))} className="h-9 w-16 text-center text-lg" aria-label="Emoji personalizado" />
          </div>
          <FieldError>{errors.icon}</FieldError>
        </div>
        <div>
          <p className="mb-2 text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Color</p>
          <div className="flex flex-wrap items-center gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set('color', c)}
                aria-label={`Color ${c}`}
                aria-pressed={form.color.toLowerCase() === c}
                className={cn('size-8 rounded-full ring-offset-2 transition-transform hover:scale-110 dark:ring-offset-zinc-900', form.color.toLowerCase() === c && 'ring-2 ring-zinc-900 dark:ring-white')}
                style={{ background: c }}
              />
            ))}
            <label className="relative grid size-8 cursor-pointer place-items-center overflow-hidden rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-600" title="Color personalizado">
              <input type="color" value={form.color} onChange={(e) => set('color', e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Color personalizado" />
              <Plus className="size-3.5 text-zinc-400" />
            </label>
            <span className="font-mono text-xs text-zinc-500">{form.color}</span>
          </div>
          <FieldError>{errors.color}</FieldError>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Reglas</p>
            <Button size="xs" variant="outline" onClick={() => set('rules', [...form.rules, ''])} disabled={form.rules.length >= 15}>
              <Plus /> Agregar regla
            </Button>
          </div>
          {form.rules.length === 0 ? (
            <p className="rounded-xl border border-dashed border-zinc-200 px-3 py-4 text-center text-sm text-zinc-400 dark:border-zinc-800">Sin reglas. Agregá las normas de convivencia de la comunidad.</p>
          ) : (
            <ol className="space-y-2">
              {form.rules.map((r, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-500 dark:bg-zinc-800">{i + 1}</span>
                  <Input
                    value={r}
                    maxLength={200}
                    onChange={(e) => {
                      const next = [...form.rules];
                      next[i] = e.target.value;
                      set('rules', next);
                    }}
                    placeholder="Ej.: Respetá a los demás"
                    aria-label={`Regla ${i + 1}`}
                  />
                  <Button size="icon-xs" variant="ghost" aria-label="Subir" disabled={i === 0} onClick={() => moveRule(i, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button size="icon-xs" variant="ghost" aria-label="Bajar" disabled={i === form.rules.length - 1} onClick={() => moveRule(i, 1)}>
                    <ArrowDown />
                  </Button>
                  <Button size="icon-xs" variant="ghost" aria-label="Quitar regla" onClick={() => set('rules', form.rules.filter((_, j) => j !== i))}>
                    <X />
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Dialog>
  );
}

export function CommunitiesAdmin() {
  useDocumentTitle('Comunidades · Moderación');
  const q = useCommunities();
  const del = useDeleteCommunity();
  const [editing, setEditing] = useState<Community | null | 'new'>(null);
  const [deleting, setDeleting] = useState<Community | null>(null);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{q.data ? `${q.data.length} comunidades` : ' '}</p>
        <Button onClick={() => setEditing('new')}>
          <Plus /> Nueva comunidad
        </Button>
      </div>
      <div className="surface overflow-hidden">
        {q.isPending ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="size-11 rounded-xl" />
                <Skeleton className="h-4 w-48" />
              </div>
            ))}
          </div>
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : q.data.length === 0 ? (
          <EmptyState icon={LayoutGrid} title="No hay comunidades" action={<Button onClick={() => setEditing('new')}>Crear la primera</Button>} />
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {q.data.map((c) => (
              <li key={c.id} className="flex items-center gap-3 p-4">
                <CommunityIcon community={c} size="lg" />
                <div className="min-w-0 flex-1">
                  <Link to={`/c/${c.slug}`} className="block truncate font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                    {c.name}
                  </Link>
                  <p className="truncate text-xs text-zinc-500">
                    c/{c.slug} · {formatNumber(c.memberCount)} miembros · {formatNumber(c.postCount)} posts · {c.rules.length} reglas
                  </p>
                </div>
                <span className="hidden size-4 shrink-0 rounded-full sm:block" style={{ background: c.color }} title={c.color} />
                <Button size="icon-sm" variant="ghost" aria-label={`Editar ${c.name}`} onClick={() => setEditing(c)}>
                  <Pencil />
                </Button>
                <Button size="icon-sm" variant="danger-ghost" aria-label={`Borrar ${c.name}`} onClick={() => setDeleting(c)}>
                  <Trash />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {editing && (
        <CommunityForm
          key={editing === 'new' ? 'new' : editing.id}
          community={editing === 'new' ? null : editing}
          open
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`¿Borrar ${deleting?.name ?? 'la comunidad'}?`}
        description="Se borran también todos sus posts y comentarios. Esta acción no se puede deshacer."
        confirmLabel="Borrar comunidad"
        onConfirm={() => deleting && del.mutateAsync(deleting.slug).then(() => toast.success('Comunidad borrada'))}
      />
    </div>
  );
}
