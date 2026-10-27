import { useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ActivityPoint } from '@/lib/types';
import { cn, formatCount, formatNumber } from '@/lib/utils';

const SERIES = [
  { key: 'posts', label: 'Posts', color: 'var(--series-1)' },
  { key: 'comments', label: 'Comentarios', color: 'var(--series-2)' },
  { key: 'users', label: 'Usuarios nuevos', color: 'var(--series-3)' },
] as const;

type SeriesKey = (typeof SERIES)[number]['key'];

function niceMax(v: number) {
  if (v <= 4) return 4;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Gráfico de líneas hecho a mano (SVG): 3 series, un solo eje, crosshair + tooltip, etiquetas directas. */
export function ActivityChart({ data }: { data: ActivityPoint[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 240;
  const m = { top: 14, right: width < 480 ? 16 : 124, bottom: 28, left: 36 };
  const iw = Math.max(0, width - m.left - m.right);
  const ih = height - m.top - m.bottom;
  const n = data.length;

  const max = useMemo(() => niceMax(Math.max(1, ...data.flatMap((d) => [d.posts, d.comments, d.users]))), [data]);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f * 100) / 100);
  const x = (i: number) => m.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => m.top + ih - (v / max) * ih;

  const paths = SERIES.map((s) => ({
    ...s,
    d: data.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[s.key as SeriesKey]).toFixed(1)}`).join(' '),
  }));

  // Etiquetas directas al final de cada línea, separadas para que no choquen
  const endLabels = (() => {
    if (!n) return [];
    const last = data[n - 1];
    const items = SERIES.map((s) => ({ key: s.key, label: s.label, color: s.color, value: last[s.key as SeriesKey], y: y(last[s.key as SeriesKey]) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < items.length; i++) if (items[i].y - items[i - 1].y < 15) items[i].y = items[i - 1].y + 15;
    const overflow = items.length ? items[items.length - 1].y - (m.top + ih) : 0;
    if (overflow > 0) items.forEach((it) => (it.y -= overflow));
    return items;
  })();

  const labelEvery = iw / Math.max(1, n - 1) < 38 ? 2 : 1;
  const hp = hover != null ? data[hover] : null;

  return (
    <div ref={ref} className="viz relative w-full select-none" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Actividad diaria de los últimos 14 días: posts, comentarios y usuarios nuevos">
          {/* grilla + eje Y */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={m.left + iw} y1={y(t)} y2={y(t)} stroke="var(--viz-grid)" strokeWidth={1} />
              <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-zinc-400 text-[11px] tabular-nums dark:fill-zinc-500">
                {formatCount(t)}
              </text>
            </g>
          ))}
          {/* eje X */}
          {data.map((p, i) =>
            i % labelEvery === (n - 1) % labelEvery ? (
              <text key={p.date} x={x(i)} y={height - 8} textAnchor="middle" className="fill-zinc-400 text-[11px] tabular-nums dark:fill-zinc-500">
                {format(parseISO(p.date), 'd/M')}
              </text>
            ) : null,
          )}
          {/* crosshair */}
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + ih} stroke="currentColor" className="text-zinc-300 dark:text-zinc-600" strokeWidth={1} />}
          {/* líneas */}
          {paths.map((p) => (
            <path key={p.key} d={p.d} fill="none" stroke={p.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {/* puntos en hover / último punto */}
          {SERIES.map((s) => {
            const i = hover ?? n - 1;
            const v = data[i]?.[s.key as SeriesKey];
            if (v == null) return null;
            return <circle key={s.key} cx={x(i)} cy={y(v)} r={4} fill={s.color} stroke="var(--viz-surface)" strokeWidth={2} />;
          })}
          {/* etiquetas directas */}
          {width >= 480 &&
            endLabels.map((l) => (
              <g key={l.key} transform={`translate(${m.left + iw + 10}, ${l.y})`}>
                <line x1={0} x2={10} y1={0} y2={0} stroke={l.color} strokeWidth={2} strokeLinecap="round" />
                <text x={15} dy="0.32em" className="fill-zinc-600 text-[11.5px] font-medium dark:fill-zinc-300">
                  {l.label.split(' ')[0]} <tspan className="fill-zinc-400 tabular-nums dark:fill-zinc-500">{formatNumber(l.value)}</tspan>
                </text>
              </g>
            ))}
          {/* zonas de hover (más grandes que la marca) */}
          {data.map((p, i) => {
            const step = n > 1 ? iw / (n - 1) : iw;
            return (
              <rect
                key={p.date}
                x={x(i) - step / 2}
                y={m.top}
                width={step}
                height={ih}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onTouchStart={() => setHover(i)}
              />
            );
          })}
        </svg>
      )}
      {hp && hover != null && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-44 rounded-xl border border-zinc-200 bg-white/95 p-2.5 text-xs shadow-pop backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95"
          style={{ left: Math.min(Math.max(8, x(hover) + 12), width - 184), ...(x(hover) + 196 > width ? { left: Math.max(8, x(hover) - 188) } : {}) }}
        >
          <p className="mb-1.5 font-semibold capitalize text-zinc-900 dark:text-zinc-100">{format(parseISO(hp.date), "EEEE d 'de' MMM", { locale: es })}</p>
          {SERIES.map((s) => (
            <p key={s.key} className="flex items-center gap-2 py-0.5 text-zinc-600 dark:text-zinc-300">
              <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
              {s.label}
              <span className="ml-auto font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatNumber(hp[s.key as SeriesKey])}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChartLegend({ className }: { className?: string }) {
  return (
    <div className={cn('viz flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400', className)}>
      {SERIES.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 rounded-full" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export function ActivityTable({ data }: { data: ActivityPoint[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-800/40 dark:text-zinc-400">
          <tr>
            <th className="px-3 py-2 font-medium">Día</th>
            {SERIES.map((s) => (
              <th key={s.key} className="px-3 py-2 text-right font-medium">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {[...data].reverse().map((d) => (
            <tr key={d.date}>
              <td className="px-3 py-1.5 capitalize text-zinc-700 dark:text-zinc-300">{format(parseISO(d.date), "EEE d 'de' MMM", { locale: es })}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(d.posts)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(d.comments)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(d.users)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
