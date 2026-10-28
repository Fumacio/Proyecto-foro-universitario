import { useState } from 'react';
import { cn, displayName, gradientFor, initials } from '@/lib/utils';
import type { UserSummary } from '@/lib/types';

const sizes = {
  xs: 'size-5 text-[9px]',
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
  xl: 'size-14 text-lg',
  '2xl': 'size-24 text-3xl',
} as const;

export type AvatarSize = keyof typeof sizes;

export function Avatar({
  user,
  size = 'md',
  className,
}: {
  user: Pick<UserSummary, 'username' | 'displayName' | 'avatarUrl'> | null | undefined;
  size?: AvatarSize;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const name = displayName(user);
  const seed = user?.username ?? 'deleted';
  const [a, b] = gradientFor(seed);
  const src = user?.avatarUrl && failed !== user.avatarUrl ? user.avatarUrl : null;

  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 select-none place-items-center overflow-hidden rounded-full font-semibold text-white ring-1 ring-black/5 dark:ring-white/10',
        sizes[size],
        !user && 'bg-zinc-300 dark:bg-zinc-700',
        className,
      )}
      style={user && !src ? { backgroundImage: `linear-gradient(135deg, ${a}, ${b})` } : undefined}
      aria-hidden="true"
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailed(user?.avatarUrl ?? null)}
        />
      ) : user ? (
        initials(name)
      ) : (
        '?'
      )}
    </span>
  );
}
