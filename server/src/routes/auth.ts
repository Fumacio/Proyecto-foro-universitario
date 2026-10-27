import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { clearAuthCookie, hashPassword, setAuthCookie, verifyPassword } from '../lib/auth.js';
import { conflict, HttpError } from '../lib/errors.js';
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
  currentPassword: z.string({ error: 'Ingresá tu contraseña actual' }).min(1, 'Ingresá tu contraseña actual').max(200),
  newPassword: passwordSchema,
});

router.post('/change-password', requireAuth, async (req, res) => {
  const user = authUser(req);
  const { currentPassword, newPassword } = parse(changePasswordSchema, req.body);
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new HttpError(400, 'VALIDATION', 'La contraseña actual es incorrecta', {
      currentPassword: 'La contraseña actual es incorrecta',
    });
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword), tokenVersion: { increment: 1 } },
  });
  setAuthCookie(res, updated);
  res.json({ ok: true });
});

export default router;
