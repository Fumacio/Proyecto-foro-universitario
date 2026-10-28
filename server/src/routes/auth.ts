import crypto from 'node:crypto';
import { Router, type CookieOptions } from 'express';
import { z } from 'zod';
import { env, googleConfig } from '../env.js';
import { clearAuthCookie, hashPassword, setAuthCookie, verifyPassword } from '../lib/auth.js';
import { queueWelcomeEmail } from '../lib/emailNotify.js';
import { conflict, HttpError, notFound } from '../lib/errors.js';
import { fetchGoogleProfile, googleAuthUrl, loginWithGoogleProfile, safeNext } from '../lib/google.js';
import { sendPasswordResetEmail } from '../lib/mailer.js';
import { prisma } from '../lib/prisma.js';
import { buildMe } from '../lib/users.js';
import { parse, passwordSchema } from '../lib/validate.js';
import { authUser, requireAuth } from '../middleware/auth.js';
import { authLimiter, forgotPasswordLimiter } from '../middleware/rateLimit.js';

const router = Router();

const RESERVED_USERNAMES = new Set([
  'root',
  'system',
  'sistema',
  'soporte',
  'support',
  'moderador',
  'moderacion',
  'administrador',
  'anonimo',
  'eliminado',
  'deleted',
  'null',
  'undefined',
]);

export const usernameSchema = z
  .string({ error: 'Ingresá un nombre de usuario' })
  .trim()
  .min(3, 'El usuario tiene que tener entre 3 y 20 caracteres')
  .max(20, 'El usuario tiene que tener entre 3 y 20 caracteres')
  .regex(/^[a-zA-Z0-9_]+$/, 'El usuario solo puede tener letras, números y guión bajo (_)');

export const emailSchema = z
  .string({ error: 'Ingresá tu email' })
  .trim()
  .toLowerCase()
  .max(254, 'El email es demasiado largo')
  .pipe(z.email('Ingresá un email válido'));

const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  displayName: z
    .union([z.string().trim().max(40, 'El nombre visible puede tener como máximo 40 caracteres'), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
});

router.post('/register', authLimiter, async (req, res) => {
  const data = parse(registerSchema, req.body);
  const usernameKey = data.username.toLowerCase();
  if (RESERVED_USERNAMES.has(usernameKey)) throw conflict('Ese nombre de usuario no está disponible');
  const existing = await prisma.user.findFirst({
    where: { OR: [{ usernameKey }, { email: data.email }] },
    select: { usernameKey: true },
  });
  if (existing) {
    throw conflict(existing.usernameKey === usernameKey ? 'Ese nombre de usuario ya está en uso' : 'Ese email ya está registrado');
  }
  const user = await prisma.user.create({
    data: {
      username: data.username,
      usernameKey,
      email: data.email,
      passwordHash: await hashPassword(data.password),
      displayName: data.displayName,
    },
  });
  queueWelcomeEmail(user);
  setAuthCookie(res, user);
  res.status(201).json({ user: await buildMe(user) });
});

const loginSchema = z.object({
  login: z.string({ error: 'Ingresá tu email o usuario' }).trim().min(1, 'Ingresá tu email o usuario').max(254),
  password: z.string({ error: 'Ingresá tu contraseña' }).min(1, 'Ingresá tu contraseña').max(200),
});

router.post('/login', authLimiter, async (req, res) => {
  const { login, password } = parse(loginSchema, req.body);
  const key = login.toLowerCase();
  const user = await prisma.user.findFirst({ where: { OR: [{ email: key }, { usernameKey: key }] } });
  const ok = await verifyPassword(password, user?.passwordHash);
  if (user && user.passwordHash === null) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Esta cuenta usa Google para iniciar sesión');
  }
  if (!user || !ok) throw new HttpError(401, 'UNAUTHORIZED', 'Usuario o contraseña incorrectos');
  setAuthCookie(res, user);
  res.json({ user: await buildMe(user) });
});

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

router.get('/me', async (req, res) => {
  res.json({ user: req.user ? await buildMe(req.user) : null });
});

const RESET_TTL_MS = 60 * 60 * 1000;
const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const { email } = parse(z.object({ email: emailSchema }), req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.$transaction([
      prisma.passwordReset.deleteMany({ where: { userId: user.id } }),
      prisma.passwordReset.create({
        data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
      }),
    ]);
    // No esperamos el envío: la respuesta no tiene que delatar si el email existe.
    sendPasswordResetEmail(user.email, user.username, token).catch((err) => console.error('[mail] error enviando reset', err));
  }
  res.json({ ok: true });
});

const resetSchema = z.object({
  token: z.string({ error: 'Falta el token' }).trim().min(10, 'El link es inválido').max(200, 'El link es inválido'),
  password: passwordSchema,
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = parse(resetSchema, req.body);
  const reset = await prisma.passwordReset.findUnique({ where: { tokenHash: sha256(token) } });
  if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now()) {
    throw new HttpError(400, 'VALIDATION', 'El link para restablecer la contraseña es inválido o ya venció', {
      token: 'Link inválido o vencido',
    });
  }
  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash, tokenVersion: { increment: 1 } } }),
    prisma.passwordReset.deleteMany({ where: { userId: reset.userId } }),
  ]);
  res.json({ ok: true });
});

const changePasswordSchema = z.object({
  // Opcional solo para cuentas sin contraseña (creadas con Google): así ponen una.
  currentPassword: z.union([z.string().max(200), z.null()]).optional(),
  newPassword: passwordSchema,
});

router.post('/change-password', requireAuth, async (req, res) => {
  const user = authUser(req);
  const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);
  if (user.passwordHash !== null) {
    if (!currentPassword) {
      throw new HttpError(400, 'VALIDATION', 'Ingresá tu contraseña actual', { currentPassword: 'Ingresá tu contraseña actual' });
    }
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new HttpError(400, 'VALIDATION', 'La contraseña actual es incorrecta', {
        currentPassword: 'La contraseña actual es incorrecta',
      });
    }
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword), tokenVersion: { increment: 1 } },
  });
  setAuthCookie(res, updated);
  res.json({ ok: true });
});

// ---------- Login con Google ----------

router.get('/providers', (_req, res) => {
  res.json({ google: googleConfig().enabled });
});

const GOOGLE_STATE_COOKIE = 'g_oauth';
const stateCookie: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.COOKIE_SECURE,
  path: '/api/auth/google',
};

function sameString(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// GET /auth/google?next=/ruta → 302 a Google
router.get('/google', (req, res) => {
  if (!googleConfig().enabled) throw notFound('El login con Google no está configurado');
  const state = crypto.randomBytes(24).toString('hex');
  res.cookie(GOOGLE_STATE_COOKIE, { s: state, n: safeNext(req.query.next) }, { ...stateCookie, maxAge: 10 * 60 * 1000 });
  res.redirect(302, googleAuthUrl(state));
});

// GET /auth/google/callback?code&state
router.get('/google/callback', async (req, res) => {
  const fail = () => res.redirect(302, `${env.FRONTEND_URL}/login?error=google`);
  const saved: unknown = req.cookies?.[GOOGLE_STATE_COOKIE];
  res.clearCookie(GOOGLE_STATE_COOKIE, stateCookie);
  const { code, state } = req.query;
  const savedState = typeof saved === 'object' && saved !== null ? (saved as { s?: unknown; n?: unknown }) : null;
  if (
    !googleConfig().enabled ||
    typeof code !== 'string' ||
    code === '' ||
    typeof state !== 'string' ||
    typeof savedState?.s !== 'string' ||
    !sameString(savedState.s, state)
  ) {
    fail();
    return;
  }
  try {
    const profile = await fetchGoogleProfile(code);
    const { user, created } = await loginWithGoogleProfile(profile);
    if (created) queueWelcomeEmail(user);
    setAuthCookie(res, user);
    res.redirect(302, `${env.FRONTEND_URL}${safeNext(savedState.n)}`);
  } catch (err) {
    if (!env.isTest) console.warn('[auth] el login con Google falló:', err instanceof Error ? err.message : err);
    fail();
  }
});

export default router;
