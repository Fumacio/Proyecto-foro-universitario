import { Plus, Tags, Trash } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { TagChip } from '@/components/common';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { FieldError, Input } from '@/components/ui/Input';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';
import { useDocumentTitle } from '@/hooks';
import { isApiError } from '@/lib/api';
import type { Tag } from '@/lib/types';
import { cn, plural } from '@/lib/utils';
import { useCreateTag, useDeleteTag, useTags } from '@/queries/communities';
import { COLORS } from './CommunitiesAdmin';

export function TagsAdmin() {
  useDocumentTitle('Etiquetas · Moderación');
  const q = useTags();
  const create = useCreateTag();
  const del = useDeleteTag();
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Tag | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 2 || n.length > 30) return setError('El nombre tiene que tener entre 2 y 30 caracteres.');
    setError(null);
    create.mutate(
      { name: n, color },
      {
        onSuccess: ({ tag }) => {
          toast.success(`Etiqueta #${tag.name} creada`);
          setName('');
        },
        onError: (err) => isApiError(err) && (err.status === 400 || err.status === 409) && setError(err.details?.name ?? err.message),
      },
    );
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
      <Card className="h-fit p-5">
        <h2 className="font-semibold text-zinc-950 dark:text-white">Nueva etiqueta</h2>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="tag-name" className="mb-1.5 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
              Nombre
            </label>
            <Input id="tag-name" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="parcial" aria-invalid={!!error || undefined} />
            <FieldError>{error}</FieldError>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Color</p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                  className={cn('size-7 rounded-full ring-offset-2 transition-transform hover:scale-110 dark:ring-offset-zinc-900', color === c && 'ring-2 ring-zinc-900 dark:ring-white')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/40">
            <span className="text-xs text-zinc-500">Vista previa</span>
            <TagChip tag={{ name: name.trim() || 'etiqueta', slug: '', color }} asLink={false} />
          </div>
          <Button type="submit" className="w-full" loading={create.isPending}>
            <Plus /> Crear etiqueta
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h2 className="font-semibold text-zinc-950 dark:text-white">Etiquetas {q.data && <span className="font-normal text-zinc-400">({q.data.length})</span>}</h2>
        </div>
        {q.isPending ? (
          <div className="flex flex-wrap gap-2 p-5">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="h-7 w-24 rounded-full" />
            ))}
          </div>
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : q.data.length === 0 ? (
          <EmptyState icon={Tags} title="No hay etiquetas" description="Creá la primera desde el formulario." />
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {q.data.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                <TagChip tag={t} />
                <span className="text-xs text-zinc-500">{plural(t.postCount, 'post')}</span>
                <Button size="icon-sm" variant="danger-ghost" className="ml-auto" aria-label={`Borrar #${t.name}`} onClick={() => setDeleting(t)}>
                  <Trash />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`¿Borrar #${deleting?.name ?? ''}?`}
        description="Se quita de todos los posts que la usan. Los posts no se borran."
        confirmLabel="Borrar etiqueta"
        onConfirm={() => deleting && del.mutateAsync(deleting.id).then(() => toast.success('Etiqueta borrada'))}
      />
    </div>
  );
}
