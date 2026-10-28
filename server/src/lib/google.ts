/** Login con Google (OAuth 2.0 authorization code) sin dependencias: usa `fetch` global. */
import { Prisma, type User } from '@prisma/client';
import { googleConfig } from '../env.js';
import { prisma } from './prisma.js';
import { saveImageBuffer } from './upload.js';

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

const TIMEOUT_MS = 10_000;

export function googleAuthUrl(state: string): string {
  const cfg = googleConfig();
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    include_granted_scopes: 'true',
    prompt: 'select_account',
  });
  return `${cfg.authUrl}${cfg.authUrl.includes('?') ? '&' : '?'}${params.toString()}`;
}

/** Cambia el `code` por tokens y lee el perfil (userinfo con el access token). */
export async function fetchGoogleProfile(code: string): Promise<GoogleProfile> {
  const cfg = googleConfig();
  const tokenRes = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!tokenRes.ok) throw new Error(`token endpoint respondió ${tokenRes.status}`);
  const tokens = (await tokenRes.json()) as { access_token?: unknown; token_type?: unknown };
  if (typeof tokens.access_token !== 'string' || tokens.access_token === '') throw new Error('respuesta de token sin access_token');

  const infoRes = await fetch(cfg.userinfoUrl, {
    headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!infoRes.ok) throw new Error(`userinfo respondió ${infoRes.status}`);
  const info = (await infoRes.json()) as Record<string, unknown>;
  const sub = typeof info.sub === 'string' ? info.sub : '';
  const email = typeof info.email === 'string' ? info.email.trim().toLowerCase() : '';
  if (!sub || !email) throw new Error('perfil de Google sin sub o email');
  return {
    sub,
    email,
    emailVerified: info.email_verified === true || info.email_verified === 'true',
    name: typeof info.name === 'string' && info.name.trim() ? info.name.trim() : null,
    picture: typeof info.picture === 'string' && /^https?:\/\//i.test(info.picture) ? info.picture : null,
  };
}

/** `next` solo puede ser una ruta interna relativa ("/algo", nunca "//host" ni "/\\host"). */
export function safeNext(value: unknown): string {
  if (typeof value !== 'string') return '/';
  const next = value.trim();
  if (next.length === 0 || next.length > 500 || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return '/';
  try {
    const base = 'http://foro.invalid';
    const u = new URL(next, base);
    if (u.origin !== base) return '/';
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return '/';
  }
}

const RESERVED = new Set([
  'root', 'system', 'sistema', 'soporte', 'support', 'moderador', 'moderacion', 'administrador',
  'anonimo', 'eliminado', 'deleted', 'null', 'undefined', 'admin',
]);

/** Parte local del email → `[a-z0-9_]`, 3–20 caracteres. */
export function usernameBaseFromEmail(email: string): string {
  const local = (email.split('@')[0] ?? '').split('+')[0] ?? '';
  let base = local
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.\-\s]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20)
    .replace(/_+$/g, '');
  if (base.length < 3) base = `${base || 'user'}_utn`.slice(0, 20);
  return base;
}

/** Agrega dígitos hasta que el usuario sea único (case-insensitive) y no esté reservado. */
export async function uniqueUsername(base: string): Promise<string> {
  const candidates = [base, ...Array.from({ length: 30 }, (_, i) => String(i + 2))].map((suffix, i) =>
    i === 0 ? base : `${base.slice(0, 20 - suffix.length)}${suffix}`,
  );
  const taken = new Set(
    (await prisma.user.findMany({ where: { usernameKey: { in: candidates } }, select: { usernameKey: true } })).map((u) => u.usernameKey),
  );
  const free = candidates.find((c) => !taken.has(c) && !RESERVED.has(c));
  if (free) return free;
  for (;;) {
    const suffix = String(Math.floor(1000 + Math.random() * 9_000_000));
    const candidate = `${base.slice(0, 20 - suffix.length)}${suffix}`;
    if (!(await prisma.user.findUnique({ where: { usernameKey: candidate }, select: { id: true } }))) return candidate;
  }
}

/** Descarga la foto de Google y la guarda en /uploads (la CSP solo permite imágenes propias). */
export async function downloadGoogleAvatar(pictureUrl: string | null): Promise<string | null> {
  if (!pictureUrl) return null;
  try {
    // Las fotos de Google vienen chicas (=s96-c): pedimos una más grande.
    const src = pictureUrl.replace(/=s\d+-c$/, '=s256-c');
    const res = await fetch(src, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'follow' });
    if (!res.ok) return null;
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > 5 * 1024 * 1024) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return await saveImageBuffer(buf);
  } catch {
    return null;
  }
}

export type GoogleLoginResult = { user: User; created: boolean };

/**
 * Busca por googleId; si no, por email (y vincula); si no, crea la cuenta sin contraseña.
 * Lanza si el email no está verificado o si el email ya está vinculado a otra cuenta de Google.
 */
export async function loginWithGoogleProfile(profile: GoogleProfile): Promise<GoogleLoginResult> {
  if (!profile.emailVerified) throw new Error('email de Google sin verificar');

  const byGoogle = await prisma.user.findUnique({ where: { googleId: profile.sub } });
  if (byGoogle) return { user: byGoogle, created: false };

  const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
  if (byEmail) {
    if (byEmail.googleId && byEmail.googleId !== profile.sub) throw new Error('la cuenta ya está vinculada a otro Google');
    const avatarUrl = byEmail.avatarUrl ? undefined : ((await downloadGoogleAvatar(profile.picture)) ?? undefined);
    const user = await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        googleId: profile.sub,
        ...(avatarUrl ? { avatarUrl } : {}),
        ...(!byEmail.displayName && profile.name ? { displayName: profile.name.slice(0, 40) } : {}),
      },
    });
    return { user, created: false };
  }

  const avatarUrl = await downloadGoogleAvatar(profile.picture);
  const base = usernameBaseFromEmail(profile.email);
  for (let attempt = 0; ; attempt++) {
    const username = await uniqueUsername(base);
    try {
      const user = await prisma.user.create({
        data: {
          username,
          usernameKey: username,
          email: profile.email,
          passwordHash: null,
          googleId: profile.sub,
          displayName: profile.name ? profile.name.slice(0, 40) : null,
          avatarUrl,
        },
      });
      return { user, created: true };
    } catch (err) {
      // Carrera con otro registro: reintentamos con otro nombre (o devolvemos la cuenta si fue la misma persona).
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002' || attempt >= 3) throw err;
      const again = await prisma.user.findFirst({ where: { OR: [{ googleId: profile.sub }, { email: profile.email }] } });
      if (again) return { user: again, created: false };
    }
  }
}
