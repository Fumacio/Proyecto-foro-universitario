import * as RT from '@radix-ui/react-tooltip';
import { FaceSlightlySmilingPlus } from 'lucide-react';
import { forwardRef, useEffect, useRef, useState, type ComponentPropsWithoutRef, type KeyboardEvent, type ReactNode } from 'react';
import { REACTIONS, type ReactionEmoji, type ReactionSummary, type UserSummary } from '@/lib/types';
import { cn, displayName, formatCount } from '@/lib/utils';
import { useMe, useRequireUser } from '@/queries/auth';
import { useReactionUsers, useToggleReaction, type ReactionTarget } from '@/queries/reactions';
import { Popover, PopoverContent, PopoverTrigger, tooltipContentClass } from '../ui/Popover';

export const REACTION_LABEL: Record<ReactionEmoji, string> = {
  '👍': 'Me gusta',
  '❤️': 'Me encanta',
  '😂': 'Me divierte',
  '😮': 'Me sorprende',
  '😢': 'Me entristece',
  '🎉': '¡Bien ahí!',
  '🤔': 'Me hace pensar',
  '🔥': 'Está buenísimo',
};

/** "Lucía, Tomás y 3 más" (con "Vos" primero si reaccionaste). */
export function whoReacted(users: UserSummary[], total: number, meId?: number | null) {
  const sorted = [...users].sort((a, b) => Number(b.id === meId) - Number(a.id === meId));
  const names = sorted.map((u) => (u.id === meId ? 'Vos' : displayName(u)));
  const count = Math.max(total, names.length);
  if (names.length === 0) return count === 1 ? '1 persona' : `${count} personas`;
  const shown = count <= 3 ? names.slice(0, count) : names.slice(0, 2);
  const rest = count - shown.length;
  if (rest > 0) return `${shown.join(', ')} y ${rest} más`;
  if (shown.length === 1) return shown[0];
  return `${shown.slice(0, -1).join(', ')} y ${shown[shown.length - 1]}`;
}

/* ---------------- Selector de emojis ---------------- */

function EmojiGrid({ reacted, onPick }: { reacted: Set<string>; onPick: (e: ReactionEmoji) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const move = (e: KeyboardEvent) => {
    const n = REACTIONS.length;
    let next = active;
    if (e.key === 'ArrowRight') next = (active + 1) % n;
    else if (e.key === 'ArrowLeft') next = (active - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else return;
    e.preventDefault();
    setActive(next);
    refs.current[next]?.focus();
  };

  return (
    <div className="p-1.5">
      <div role="toolbar" aria-label="Elegí una reacción" aria-orientation="horizontal" onKeyDown={move} className="flex gap-0.5">
        {REACTIONS.map((emoji, i) => {
          const on = reacted.has(emoji);
          return (
            <button
              key={emoji}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              tabIndex={i === active ? 0 : -1}
              aria-label={`${REACTION_LABEL[emoji]}${on ? ' (ya reaccionaste)' : ''}`}
              aria-pressed={on}
              onFocus={() => setActive(i)}
              onMouseEnter={() => setActive(i)}
              onClick={() => onPick(emoji)}
              className={cn(
                'grid size-9 place-items-center rounded-xl text-[22px] leading-none transition-[transform,background-color] duration-150 hover:scale-[1.18] hover:bg-zinc-100 focus-visible:scale-[1.18] focus-visible:bg-zinc-100 focus-visible:outline-none active:scale-95 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800',
                on && 'bg-brand-50 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/15 dark:ring-brand-500/30',
              )}
            >
              <span aria-hidden>{emoji}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-1 h-4 text-center text-[11.5px] font-medium text-zinc-500 dark:text-zinc-400" aria-hidden>
        {REACTION_LABEL[REACTIONS[active]]}
      </p>
    </div>
  );
}

export function ReactionPicker({
  reactions,
  onPick,
  trigger,
  align = 'start',
}: {
  reactions: ReactionSummary[];
  onPick: (e: ReactionEmoji) => void;
  /** Botón disparador (por defecto, un círculo con 🙂+). */
  trigger?: ReactNode;
  align?: 'start' | 'center' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const reacted = new Set(reactions.filter((r) => r.reacted).map((r) => r.emoji));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? <AddReactionButton />}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side="top"
        sideOffset={6}
        className="w-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
      >
        <EmojiGrid
          reacted={reacted}
          onPick={(emoji) => {
            setOpen(false);
            onPick(emoji);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Disparador del picker con el mismo estilo que los chips (círculo con 🙂+). */
export const AddReactionButton = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'> & { small?: boolean; label?: string }>(
  function AddReactionButton({ small, label = 'Agregar reacción', className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        {...props}
        className={cn(
          'relative z-10 grid shrink-0 place-items-center rounded-full text-zinc-400 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-100 hover:text-zinc-700 data-[state=open]:bg-zinc-100 data-[state=open]:text-zinc-700 dark:ring-zinc-700/80 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 dark:data-[state=open]:bg-zinc-800',
          small ? 'size-6' : 'size-7',
          className,
        )}
      >
        <FaceSlightlySmilingPlus className={small ? 'size-3.5' : 'size-4'} />
      </button>
    );
  },
);

/* ---------------- Chip ---------------- */

function ReactionChip({
  target,
  r,
  onToggle,
  size,
  bump,
}: {
  target: ReactionTarget;
  r: ReactionSummary;
  onToggle: (e: ReactionEmoji) => void;
  size: 'xs' | 'sm' | 'md';
  bump: number;
}) {
  const { me } = useMe();
  const [open, setOpen] = useState(false);
  const longPressAt = useRef(0);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const users = useReactionUsers(target, r.emoji, open);
  const label = REACTION_LABEL[r.emoji] ?? r.emoji;

  useEffect(
    () => () => {
      clearTimeout(pressTimer.current);
      clearTimeout(closeTimer.current);
    },
    [],
  );

  const cancelPress = () => clearTimeout(pressTimer.current);

  return (
    <RT.Root
      open={open}
      delayDuration={250}
      onOpenChange={(o) => {
        // Radix cierra el tooltip al soltar el dedo: lo dejamos abierto un rato tras un "long press".
        if (!o && Date.now() - longPressAt.current < 900) return;
        setOpen(o);
      }}
    >
      <RT.Trigger asChild>
        <button
          type="button"
          aria-pressed={r.reacted}
          aria-label={`${label}: ${r.count}. ${r.reacted ? 'Tocá para quitar tu reacción' : 'Tocá para reaccionar'}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (Date.now() - longPressAt.current < 900) return;
            onToggle(r.emoji);
          }}
          onTouchStart={() => {
            cancelPress();
            pressTimer.current = setTimeout(() => {
              longPressAt.current = Date.now();
              setOpen(true);
              navigator.vibrate?.(8);
              clearTimeout(closeTimer.current);
              closeTimer.current = setTimeout(() => setOpen(false), 2600);
            }, 420);
          }}
          onTouchEnd={cancelPress}
          onTouchMove={cancelPress}
          onTouchCancel={cancelPress}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            'relative z-10 inline-flex shrink-0 select-none items-center rounded-full font-semibold tabular-nums ring-1 ring-inset transition-[background-color,color,box-shadow,transform] duration-150 active:scale-95 [-webkit-touch-callout:none]',
            size === 'xs' ? 'h-5 gap-0.5 px-1.5 text-[11px]' : size === 'sm' ? 'h-6 gap-1 px-1.5 text-[11.5px]' : 'h-7 gap-1.5 px-2 text-[12.5px]',
            r.reacted
              ? 'bg-brand-50 text-brand-700 ring-brand-300/80 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-400/40 dark:hover:bg-brand-500/25'
              : 'bg-zinc-100/80 text-zinc-600 ring-transparent hover:bg-zinc-200/70 hover:text-zinc-900 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white',
          )}
        >
          <span key={bump} aria-hidden className={cn('leading-none', size === 'xs' ? 'text-[11.5px]' : size === 'sm' ? 'text-[13px]' : 'text-[15px]', bump > 0 && 'animate-bump')}>
            {r.emoji}
          </span>
          <span>{formatCount(r.count)}</span>
        </button>
      </RT.Trigger>
      <RT.Portal>
        <RT.Content side="top" sideOffset={6} collisionPadding={8} className={cn(tooltipContentClass, 'flex items-center gap-2 py-2')}>
          <span className="text-xl leading-none" aria-hidden>
            {r.emoji}
          </span>
          <span className="min-w-0">
            <span className="block font-semibold">{label}</span>
            <span className="block font-normal opacity-80">
              {users.isPending ? 'Cargando…' : users.isError ? whoReacted([], r.count) : whoReacted(users.data ?? [], r.count, me?.id)}
            </span>
          </span>
        </RT.Content>
      </RT.Portal>
    </RT.Root>
  );
}

/* ---------------- Barra ---------------- */

/**
 * Fila de reacciones (chips + botón para agregar). Toggle optimista en todos los caches.
 * `max` muestra solo las N con más reacciones (vista compacta del feed).
 */
export function ReactionBar({
  target,
  reactions,
  size = 'md',
  max,
  showAdd = true,
  disabled,
  className,
}: {
  target: ReactionTarget;
  reactions: ReactionSummary[] | undefined;
  size?: 'xs' | 'sm' | 'md';
  max?: number;
  showAdd?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const list = reactions ?? [];
  const requireUser = useRequireUser();
  const toggle = useToggleReaction();
  const [bumps, setBumps] = useState<Record<string, number>>({});

  const onToggle = (emoji: ReactionEmoji) => {
    if (disabled || !requireUser()) return;
    setBumps((b) => ({ ...b, [emoji]: (b[emoji] ?? 0) + 1 }));
    toggle.mutate({ target, emoji });
  };

  const shown = max ? [...list].sort((a, b) => b.count - a.count).slice(0, max) : list;
  const hidden = list.length - shown.length;
  if (shown.length === 0 && !showAdd) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {shown.map((r) => (
        <ReactionChip key={r.emoji} target={target} r={r} size={size} onToggle={onToggle} bump={bumps[r.emoji] ?? 0} />
      ))}
      {hidden > 0 && <span className="text-[11px] font-medium text-zinc-400">+{hidden}</span>}
      {showAdd && !disabled && (
        <ReactionPicker
          reactions={list}
          onPick={onToggle}
          trigger={size === 'md' ? undefined : <AddReactionButton small />}
        />
      )}
    </div>
  );
}

/** Hook para usar el picker desde otro botón (barra de acciones) con el mismo toggle. */
export function useReactionToggle(target: ReactionTarget, disabled?: boolean) {
  const requireUser = useRequireUser();
  const toggle = useToggleReaction();
  return (emoji: ReactionEmoji) => {
    if (disabled || !requireUser()) return;
    toggle.mutate({ target, emoji });
  };
}
