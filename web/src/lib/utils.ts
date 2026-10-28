import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { PostType, Role, UserSummary } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string, max = 60) {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

export function postPath(post: { id: number; title?: string }, commentId?: number | null) {
  const slug = post.title ? slugify(post.title) : '';
  const base = slug ? `/p/${post.id}/${slug}` : `/p/${post.id}`;
  return commentId ? `${base}#comment-${commentId}` : base;
}

export function formatCount(n: number): string {
  const abs = Math.abs(n);
  if (abs < 1000) return String(n);
  if (abs < 1_000_000) {
    const v = n / 1000;
    return `${(abs < 10_000 ? v.toFixed(1) : Math.round(v).toString()).replace('.0', '').replace('.', ',')}k`;
  }
  return `${(n / 1_000_000).toFixed(1).replace('.0', '').replace('.', ',')}M`;
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat('es-AR').format(n);
}

export function plural(n: number, singular: string, pluralForm?: string) {
  return `${formatNumber(n)} ${n === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

export function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function displayName(user: Pick<UserSummary, 'username' | 'displayName'> | null | undefined) {
  if (!user) return '[eliminado]';
  return user.displayName?.trim() || user.username;
}

export function isStaff(role: Role | undefined | null) {
  return role === 'ADMIN' || role === 'MODERATOR';
}

export const POST_TYPE_LABEL: Record<PostType, string> = {
  TEXT: 'Texto',
  QUESTION: 'Pregunta',
  POLL: 'Encuesta',
  LINK: 'Link',
};

/** Paleta de gradientes deterministas para avatares/banners. */
const GRADIENTS: [string, string][] = [
  ['#6366f1', '#a855f7'],
  ['#0ea5e9', '#6366f1'],
  ['#14b8a6', '#0ea5e9'],
  ['#22c55e', '#14b8a6'],
  ['#f59e0b', '#ef4444'],
  ['#f97316', '#ec4899'],
  ['#ec4899', '#8b5cf6'],
  ['#8b5cf6', '#3b82f6'],
  ['#06b6d4', '#22c55e'],
  ['#e11d48', '#f97316'],
];

export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function gradientFor(seed: string): [string, string] {
  return GRADIENTS[hashString(seed.toLowerCase()) % GRADIENTS.length];
}

export function initials(name: string) {
  const parts = name
    .replace(/[_\-.]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Destino seguro para `?next=` (solo rutas internas). */
export function safeNext(next: string | null | undefined, fallback = '/') {
  if (!next) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  if (/^\/(login|register|forgot-password|reset-password)/.test(next)) return fallback;
  return next;
}

export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function absoluteUrl(path: string) {
  return `${window.location.origin}${path}`;
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
