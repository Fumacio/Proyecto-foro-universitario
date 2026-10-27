import { ArrowBigDown, ArrowBigUp } from 'lucide-react';
import { cn, formatCount } from '@/lib/utils';

interface Props {
  score: number;
  myVote: -1 | 0 | 1;
  onVote: (value: -1 | 0 | 1) => void;
  orientation?: 'vertical' | 'horizontal';
  size?: 'sm' | 'md';
  className?: string;
  label?: string;
}

/** Botones de voto. `onVote` recibe el valor final (0 = quitar). */
export function VoteControl({ score, myVote, onVote, orientation = 'vertical', size = 'md', className, label = 'post' }: Props) {
  const vertical = orientation === 'vertical';
  const iconSize = size === 'sm' ? 'size-[18px]' : 'size-5';
  const btn = cn(
    'grid place-items-center rounded-lg transition-[color,background-color,transform] duration-150 active:scale-90',
    size === 'sm' ? 'size-7' : 'size-8',
  );
  return (
    <div
      className={cn(
        'relative z-10 flex items-center',
        vertical ? 'flex-col gap-0.5' : 'gap-0.5 rounded-full bg-zinc-100/80 p-0.5 dark:bg-zinc-800/70',
        !vertical && myVote === 1 && 'bg-orange-500/10 dark:bg-orange-500/15',
        !vertical && myVote === -1 && 'bg-indigo-500/10 dark:bg-indigo-500/15',
        className,
      )}
    >
      <button
        type="button"
        aria-label={myVote === 1 ? `Quitar voto positivo del ${label}` : `Votar positivo el ${label}`}
        aria-pressed={myVote === 1}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onVote(myVote === 1 ? 0 : 1);
        }}
        className={cn(
          btn,
          !vertical && 'rounded-full',
          myVote === 1
            ? 'text-orange-500 hover:bg-orange-500/15'
            : 'text-zinc-400 hover:bg-orange-500/10 hover:text-orange-500 dark:text-zinc-500',
        )}
      >
        <ArrowBigUp className={cn(iconSize, myVote === 1 && 'animate-bump fill-current')} strokeWidth={1.75} />
      </button>
      <span
        aria-live="polite"
        className={cn(
          'min-w-[2ch] text-center font-semibold tabular-nums',
          size === 'sm' ? 'text-xs' : 'text-[13px]',
          myVote === 1 ? 'text-orange-600 dark:text-orange-400' : myVote === -1 ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-700 dark:text-zinc-300',
        )}
      >
        {formatCount(score)}
      </span>
      <button
        type="button"
        aria-label={myVote === -1 ? `Quitar voto negativo del ${label}` : `Votar negativo el ${label}`}
        aria-pressed={myVote === -1}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onVote(myVote === -1 ? 0 : -1);
        }}
        className={cn(
          btn,
          !vertical && 'rounded-full',
          myVote === -1
            ? 'text-indigo-500 hover:bg-indigo-500/15'
            : 'text-zinc-400 hover:bg-indigo-500/10 hover:text-indigo-500 dark:text-zinc-500',
        )}
      >
        <ArrowBigDown className={cn(iconSize, myVote === -1 && 'animate-bump fill-current')} strokeWidth={1.75} />
      </button>
    </div>
  );
}
