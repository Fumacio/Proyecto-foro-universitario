import { Check, ChartColumn, Clock, Lock } from 'lucide-react';
import type { Poll } from '@/lib/types';
import { relative } from '@/lib/time';
import { cn, plural } from '@/lib/utils';
import { useRequireUser } from '@/queries/auth';
import { usePollVote } from '@/queries/posts';

export function PollWidget({ postId, poll, compact }: { postId: number; poll: Poll; compact?: boolean }) {
  const requireUser = useRequireUser();
  const vote = usePollVote(postId);
  const voted = poll.myOptionId != null;
  const showResults = voted || poll.isClosed;
  const max = Math.max(1, ...poll.options.map((o) => o.votes));
  const options = compact ? poll.options.slice(0, 4) : poll.options;
  const hidden = poll.options.length - options.length;

  const choose = (optionId: number) => {
    if (poll.isClosed || optionId === poll.myOptionId) return;
    if (!requireUser()) return;
    vote.mutate(optionId);
  };

  return (
    <div className="relative z-10 rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="space-y-1.5" role={showResults ? undefined : 'radiogroup'} aria-label="Opciones de la encuesta">
        {options.map((o) => {
          const pct = poll.totalVotes ? Math.round((o.votes / poll.totalVotes) * 100) : 0;
          const mine = o.id === poll.myOptionId;
          const leading = showResults && o.votes === max && o.votes > 0;
          if (!showResults) {
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={false}
                onClick={(e) => {
                  e.preventDefault();
                  choose(o.id);
                }}
                disabled={vote.isPending}
                className="group flex w-full items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-zinc-800 transition-colors hover:border-brand-400 hover:bg-brand-50/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10"
              >
                <span className="grid size-4 shrink-0 place-items-center rounded-full border-2 border-zinc-300 transition-colors group-hover:border-brand-500 dark:border-zinc-600" />
                <span className="min-w-0 flex-1">{o.text}</span>
              </button>
            );
          }
          return (
            <button
              key={o.id}
              type="button"
              disabled={poll.isClosed || vote.isPending}
              onClick={(e) => {
                e.preventDefault();
                choose(o.id);
              }}
              title={poll.isClosed ? undefined : mine ? 'Tu voto' : 'Cambiar mi voto a esta opción'}
              className={cn(
                'relative flex w-full items-center gap-3 overflow-hidden rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-default disabled:opacity-100',
                mine
                  ? 'border-brand-300 dark:border-brand-500/50'
                  : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700',
                'bg-white dark:bg-zinc-900',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'absolute inset-y-0 left-0 rounded-r-md transition-[width] duration-500 ease-out',
                  mine ? 'bg-brand-500/15 dark:bg-brand-500/25' : leading ? 'bg-zinc-200/80 dark:bg-zinc-700/50' : 'bg-zinc-100 dark:bg-zinc-800/70',
                )}
                style={{ width: `${pct}%` }}
              />
              <span className={cn('relative min-w-0 flex-1 font-medium', mine ? 'text-brand-700 dark:text-brand-300' : 'text-zinc-800 dark:text-zinc-200')}>
                {o.text}
                {mine && <Check className="ml-1.5 inline size-4 -translate-y-px" strokeWidth={2.5} />}
              </span>
              <span className={cn('relative shrink-0 text-[13px] font-semibold tabular-nums', leading ? 'text-zinc-900 dark:text-white' : 'text-zinc-500')}>
                {pct}%
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1">
          <ChartColumn className="size-3.5" />
          {plural(poll.totalVotes, 'voto')}
        </span>
        {poll.isClosed ? (
          <span className="inline-flex items-center gap-1 font-medium text-zinc-600 dark:text-zinc-300">
            <Lock className="size-3.5" />
            Encuesta cerrada
          </span>
        ) : poll.closesAt ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            Cierra {relative(poll.closesAt)}
          </span>
        ) : null}
        {hidden > 0 && <span>+{hidden} opciones más</span>}
        {voted && !poll.isClosed && !compact && <span className="ml-auto">Podés cambiar tu voto tocando otra opción</span>}
      </div>
    </div>
  );
}
