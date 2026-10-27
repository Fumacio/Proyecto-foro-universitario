import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { forbidden, HttpError, notFound } from '../lib/errors.js';
import { notify } from '../lib/notify.js';
import { prisma } from '../lib/prisma.js';
import { activeBanWhere, adminUserInclude, toAdminUser } from '../lib/serializers.js';
import { describeBan } from '../lib/users.js';
import { limitSchema, pageSchema, paginate, paginationSchema, parse, parseId } from '../lib/validate.js';
import { authUser, requireAdmin, requireMod } from '../middleware/auth.js';

const router = Router();
router.use(requireMod);

const ROLES = ['ADMIN', 'MODERATOR', 'PROFESSOR', 'STUDENT'] as const;
const DAY_MS = 86_400_000;
const TZ = 'America/Argentina/Buenos_Aires';
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

async function adminUserOr404(id: number) {
  const user = await prisma.user.findUnique({ where: { id }, include: adminUserInclude() });
  if (!user) throw notFound('Ese usuario no existe');
  return user;
}

router.get('/stats', async (_req, res) => {
  const now = Date.now();
  const since = new Date(now - 15 * DAY_MS);
  const [users, posts, comments, communities, pendingReports, bannedUsers, recentPosts, recentComments, recentUsers] =
    await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.comment.count({ where: { isDeleted: false } }),
      prisma.community.count(),
      prisma.report.count({ where: { status: 'PENDING' } }),
      prisma.ban.findMany({ where: activeBanWhere(), distinct: ['userId'], select: { userId: true } }),
      prisma.post.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.comment.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    ]);

  const days: { date: string; posts: number; comments: number; users: number }[] = [];
  const index = new Map<string, (typeof days)[number]>();
  for (let i = 13; i >= 0; i--) {
    const date = dayKey.format(new Date(now - i * DAY_MS));
    if (index.has(date)) continue;
    const entry = { date, posts: 0, comments: 0, users: 0 };
    days.push(entry);
    index.set(date, entry);
  }
  const bump = (rows: { createdAt: Date }[], field: 'posts' | 'comments' | 'users') => {
    for (const r of rows) {
      const entry = index.get(dayKey.format(r.createdAt));
      if (entry) entry[field]++;
    }
  };
  bump(recentPosts, 'posts');
  bump(recentComments, 'comments');
  bump(recentUsers, 'users');

  res.json({ users, posts, comments, communities, pendingReports, activeBans: bannedUsers.length, activity: days });
});

router.get('/users', async (req, res) => {
  const { q, page, limit, role } = parse(
    z.object({
      q: z.string().trim().max(100).optional(),
      role: z
        .string()
        .optional()
        .transform((v) => (v ? v.toUpperCase() : undefined))
        .pipe(z.enum(ROLES).optional()),
      page: pageSchema,
      limit: limitSchema(),
    }),
    req.query,
  );
  const and: Prisma.UserWhereInput[] = [];
  if (q) {
    and.push({
      OR: [{ usernameKey: { contains: q.toLowerCase() } }, { email: { contains: q.toLowerCase() } }, { displayName: { contains: q } }],
    });
  }
  if (role) and.push({ role });
  const where: Prisma.UserWhereInput = and.length ? { AND: and } : {};
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit + 1,
      include: adminUserInclude(),
    }),
    prisma.user.count({ where }),
  ]);
  res.json(paginate(rows.map(toAdminUser), page, limit, total));
});

router.patch('/users/:id', requireAdmin, async (req, res) => {
  const me = authUser(req);
  const id = parseId(req.params.id, 'Ese usuario no existe');
  const { role } = parse(z.object({ role: z.enum(ROLES, { error: 'Rol inválido' }) }), req.body);
  if (id === me.id) throw new HttpError(400, 'VALIDATION', 'No podés cambiar tu propio rol', { role: 'No podés cambiar tu propio rol' });
  await adminUserOr404(id);
  const user = await prisma.user.update({ where: { id }, data: { role }, include: adminUserInclude() });
  res.json({ user: toAdminUser(user) });
});

const banSchema = z.object({
  reason: z
    .string({ error: 'Indicá el motivo' })
    .trim()
    .min(3, 'El motivo tiene que tener entre 3 y 500 caracteres')
    .max(500, 'El motivo tiene que tener entre 3 y 500 caracteres'),
  days: z.union(
    [
      z
        .number()
        .int('La duración tiene que ser un número entero de días')
        .min(1, 'La duración tiene que ser de 1 a 3650 días')
        .max(3650, 'La duración tiene que ser de 1 a 3650 días'),
      z.null(),
    ],
    { error: 'Indicá la duración en días (o null para permanente)' },
  ),
});

router.post('/users/:id/ban', async (req, res) => {
  const me = authUser(req);
  const id = parseId(req.params.id, 'Ese usuario no existe');
  const { reason, days } = parse(banSchema, req.body);
  if (id === me.id) throw forbidden('No podés suspenderte a vos mismo');
  const target = await adminUserOr404(id);
  if (target.role === 'ADMIN') throw forbidden('No se puede suspender a un administrador');

  const now = new Date();
  const expiresAt = days === null ? null : new Date(now.getTime() + days * DAY_MS);
  await prisma.$transaction([
    // Un ban nuevo reemplaza al anterior.
    prisma.ban.updateMany({ where: { userId: id, ...activeBanWhere(now) }, data: { liftedAt: now, liftedById: me.id } }),
    prisma.ban.create({ data: { userId: id, bannedById: me.id, reason, expiresAt } }),
  ]);
  const duration = days === null ? 'de forma permanente' : `por ${days} ${days === 1 ? 'día' : 'días'} (${describeBan(expiresAt)})`;
  await notify({
    userId: id,
    type: 'MOD',
    message: `Tu cuenta fue suspendida ${duration}. Motivo: ${reason}. Podés seguir leyendo el foro, pero no publicar, comentar, votar ni enviar mensajes.`,
  });
  res.json({ user: toAdminUser(await adminUserOr404(id)) });
});

router.delete('/users/:id/ban', async (req, res) => {
  const me = authUser(req);
  const id = parseId(req.params.id, 'Ese usuario no existe');
  await adminUserOr404(id);
  const now = new Date();
  const lifted = await prisma.ban.updateMany({ where: { userId: id, ...activeBanWhere(now) }, data: { liftedAt: now, liftedById: me.id } });
  if (lifted.count > 0) {
    await notify({ userId: id, type: 'MOD', message: 'Se levantó la suspensión de tu cuenta. ¡Bienvenido/a de vuelta!' });
  }
  res.json({ user: toAdminUser(await adminUserOr404(id)) });
});

router.get('/bans', async (req, res) => {
  const { page, limit } = parse(paginationSchema, req.query);
  const where: Prisma.UserWhereInput = { bans: { some: activeBanWhere() } };
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit + 1,
      include: adminUserInclude(),
    }),
    prisma.user.count({ where }),
  ]);
  res.json(paginate(rows.map(toAdminUser), page, limit, total));
});

export default router;
