import { Check, Search } from 'lucide-react';
import { useMemo, useState, type CSSProperties } from 'react';
import type { Tag } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useTags } from '@/queries/communities';
import { Skeleton } from '../ui/misc';

export const MAX_TAGS = 5;

export function TagPicker({ value, onChange, max = MAX_TAGS }: { value: number[]; onChange: (ids: number[]) => void; max?: number }) {
  const tags = useTags();
  const [filter, setFilter] = useState('');
  const list = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return (tags.data ?? []).filter((t) => !f || t.name.toLowerCase().includes(f));
  }, [tags.data, filter]);
  const full = value.length >= max;

  const toggle = (t: Tag) => {
    if (value.includes(t.id)) onChange(value.filter((id) => id !== t.id));
    else if (!full) onChange([...value, t.id]);
  };

  if (tags.isPending) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
    );
  }
  if (tags.isError) return <p className="text-sm text-zinc-400">No se pudieron cargar las etiquetas.</p>;
  if (!tags.data.length) return <p className="text-sm text-zinc-400">No hay etiquetas disponibles.</p>;

  return (
    <div>
      {tags.data.length > 12 && (
        <div className="relative mb-2.5 max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar etiqueta…"
            aria-label="Buscar etiqueta"
            className="h-8 w-full rounded-lg border border-zinc-200 bg-white pl-8 pr-3 text-[13px] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-800 dark:bg-zinc-900"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Etiquetas">
        {list.map((t) => {
          const on = value.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => toggle(t)}
              style={{ '--chip': t.color } as CSSProperties}
              className={cn(
                'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40',
                on
                  ? 'chip-tint border-transparent ring-2 ring-[color-mix(in_oklab,var(--chip)_45%,transparent)]'
                  : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800',
              )}
            >
              {on ? <Check className="size-3" strokeWidth={3} /> : <span className="size-2 rounded-full" style={{ background: t.color }} />}
              {t.name}
            </button>
          );
        })}
        {list.length === 0 && <p className="text-sm text-zinc-400">Ninguna etiqueta coincide.</p>}
      </div>
      <p className={cn('mt-2 text-xs', full ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500')}>
        {value.length}/{max} etiquetas{full && ' · llegaste al máximo'}
      </p>
    </div>
  );
}
