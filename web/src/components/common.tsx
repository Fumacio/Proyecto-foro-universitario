import { GraduationCap, Shield, ShieldCheck } from 'lucide-react';
import { useId, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { fullDate, timeAgo } from '@/lib/time';
import type { CommunityRef, Role, Tag, UserSummary } from '@/lib/types';
import { cn, displayName } from '@/lib/utils';
import { Avatar, type AvatarSize } from './ui/Avatar';
import { Tooltip } from './ui/Popover';

/* ---------------- Logo ---------------- */

export function LogoMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn('size-8', className)} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#818cf8" />
          <stop offset="0.55" stopColor="#6a46ea" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id={`${id}-s`} x1="16" y1="0" x2="16" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id}-g)`} />
      <rect width="32" height="32" rx="9" fill={`url(#${id}-s)`} />
      <path
        d="M10 7.5h12a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4h-7.2l-4.6 3.6c-.5.4-1.2 0-1.2-.6v-3.1A4 4 0 0 1 6 18.5v-7a4 4 0 0 1 4-4Z"
        fill="#fff"
      />
      <path d="M12.4 11v3.6a3.6 3.6 0 0 0 7.2 0V11" stroke="#6a46ea" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <Link to="/" className={cn('group inline-flex items-center gap-2.5 rounded-lg', className)} aria-label="Foro UTN — Inicio">
      <LogoMark className="size-8 transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-105" />
      {!compact && (
        <span className="text-[17px] font-bold tracking-tight text-zinc-950 dark:text-white">
          Foro <span className="bg-linear-to-r from-brand-600 to-violet-500 bg-clip-text text-transparent dark:from-brand-400 dark:to-violet-400">UTN</span>
        </span>
      )}
    </Link>
  );
}

/* ---------------- Roles ---------------- */

const ROLE_META: Partial<Record<Role, { label: string; icon: typeof Shield; className: string; title: string }>> = {
  ADMIN: {
    label: 'Admin',
    icon: Shield,
    title: 'Administrador',
    className: 'bg-rose-50 text-rose-600 ring-rose-200/70 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/25',
  },
  MODERATOR: {
    label: 'Mod',
    icon: ShieldCheck,
    title: 'Moderador/a',
    className:
      'bg-emerald-50 text-emerald-600 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25',
  },
  PROFESSOR: {
    label: 'Profe',
    icon: GraduationCap,
    title: 'Docente',
    className: 'bg-amber-50 text-amber-700 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25',
  },
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrador',
  MODERATOR: 'Moderador',
  PROFESSOR: 'Docente',
  STUDENT: 'Estudiante',
};

export function RoleBadge({ role, className, size = 'sm' }: { role: Role | undefined; className?: string; size?: 'sm' | 'md' }) {
  const meta = role ? ROLE_META[role] : undefined;
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <span
      title={meta.title}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-md font-semibold ring-1 ring-inset',
        size === 'sm' ? 'h-[18px] px-1.5 text-[10.5px] [&_svg]:size-3' : 'h-6 px-2 text-xs [&_svg]:size-3.5',
        meta.className,
      )}
    >
      <Icon strokeWidth={2.25} />
      {meta.label}
    </span>
  );
}

/* ---------------- Usuarios ---------------- */

export function UserLink({
  user,
  showAvatar,
  avatarSize = 'xs',
  showRole = true,
  prefix,
  className,
}: {
  user: UserSummary | null;
  showAvatar?: boolean;
  avatarSize?: AvatarSize;
  showRole?: boolean;
  prefix?: boolean;
  className?: string;
}) {
  if (!user) {
    return <span className={cn('italic text-zinc-400 dark:text-zinc-500', className)}>[eliminado]</span>;
  }
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <Link
        to={`/u/${user.username}`}
        className="relative z-10 inline-flex min-w-0 items-center gap-1.5 font-medium text-zinc-700 hover:text-brand-600 hover:underline hover:underline-offset-2 dark:text-zinc-300 dark:hover:text-brand-400"
      >
        {showAvatar && <Avatar user={user} size={avatarSize} />}
        <span className="truncate">{prefix ? `u/${user.username}` : displayName(user)}</span>
      </Link>
      {showRole && <RoleBadge role={user.role} />}
    </span>
  );
}

/* ---------------- Tiempo ---------------- */

export function TimeAgo({ date, className, prefix }: { date: string; className?: string; prefix?: string }) {
  return (
    <Tooltip content={fullDate(date)}>
      <time dateTime={date} className={cn('whitespace-nowrap', className)}>
        {prefix}
        {timeAgo(date)}
      </time>
    </Tooltip>
  );
}

/* ---------------- Comunidades y etiquetas ---------------- */

export function CommunityIcon({
  community,
  size = 'md',
  className,
}: {
  community: Pick<CommunityRef, 'icon' | 'color'>;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const s = {
    xs: 'size-5 text-[11px] rounded-md',
    sm: 'size-6 text-sm rounded-lg',
    md: 'size-8 text-base rounded-xl',
    lg: 'size-11 text-xl rounded-xl',
    xl: 'size-20 text-4xl rounded-3xl',
  }[size];
  return (
    <span
      aria-hidden
      className={cn('chip-tint inline-grid shrink-0 place-items-center leading-none', s, className)}
      style={{ '--chip': community.color } as CSSProperties}
    >
      {community.icon || '💬'}
    </span>
  );
}

export function CommunityChip({ community, className }: { community: CommunityRef; className?: string }) {
  return (
    <Link
      to={`/c/${community.slug}`}
      className={cn(
        'relative z-10 inline-flex min-w-0 items-center gap-1.5 font-semibold text-zinc-800 hover:text-brand-600 dark:text-zinc-200 dark:hover:text-brand-400',
        className,
      )}
    >
      <CommunityIcon community={community} size="xs" />
      <span className="truncate">{community.name}</span>
    </Link>
  );
}

export function TagChip({
  tag,
  className,
  asLink = true,
  active,
  onClick,
}: {
  tag: Pick<Tag, 'name' | 'slug' | 'color'>;
  className?: string;
  asLink?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const cls = cn(
    'chip-tint relative z-10 inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition-[filter,box-shadow] hover:brightness-95 dark:hover:brightness-125',
    active && 'ring-2 ring-current/40',
    className,
  );
  const style = { '--chip': tag.color } as CSSProperties;
  const content = (
    <>
      <span className="opacity-60">#</span>
      {tag.name}
    </>
  );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls} style={style} aria-pressed={active}>
        {content}
      </button>
    );
  if (!asLink)
    return (
      <span className={cls} style={style}>
        {content}
      </span>
    );
  return (
    <Link to={`/t/${tag.slug}`} className={cls} style={style}>
      {content}
    </Link>
  );
}
