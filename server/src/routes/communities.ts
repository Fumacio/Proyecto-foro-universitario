import { Router } from 'express';
import { z } from 'zod';
import { removeStoredFiles, storedNamesWhere } from '../lib/attachments.js';
import { conflict, notFound, unauthorized } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { communityInclude, toCommunity } from '../lib/serializers.js';
import { boolQuery, hexColorSchema, parse } from '../lib/validate.js';
import { authUser, requireAdmin, requireAuth, requireWriter } from '../middleware/auth.js';
import { actionLimiter } from '../middleware/rateLimit.js';

const router = Router();
const NOT_FOUND = 'Esa comunidad no existe';

async function getCommunityOr404(slug: string, viewerId: number | null) {
  const community = await prisma.community.findUnique({
    where: { slug: slug.toLowerCase() },
    include: communityInclude(viewerId),
  });
  if (!community) throw notFound(NOT_FOUND);
  return community;
}

router.get('/', async (req, res) => {
  const { joined } = parse(z.object({ joined: boolQuery }), req.query);
  if (joined && !req.user) throw unauthorized();
  const viewerId = req.user?.id ?? null;
  const rows = await prisma.community.findMany({
    where: joined && viewerId ? { memberships: { some: { userId: viewerId } } } : {},
    include: communityInclude(viewerId),
    orderBy: [{ memberships: { _count: 'desc' } }, { name: 'asc' }],
  });
  res.json({ items: rows.map(toCommunity) });
});

router.get('/:slug', async (req, res) => {
  res.json({ community: toCommunity(await getCommunityOr404(String(req.params.slug), req.user?.id ?? null)) });
});

const nameSchema = z
  .string({ error: 'Ingresá un nombre' })
  .trim()
  .min(2, 'El nombre tiene que tener entre 2 y 60 caracteres')
  .max(60, 'El nombre tiene que tener entre 2 y 60 caracteres');
const descriptionSchema = z.string().trim().max(1000, 'La descripción puede tener como máximo 1000 caracteres');
const iconSchema = z
  .string({ error: 'Elegí un ícono' })
  .trim()
  .min(1, 'Elegí un ícono (emoji)')
  .max(16, 'El ícono tiene que ser un emoji');
const rulesSchema = z
  .array(z.string().trim().min(1, 'Las reglas no pueden estar vacías').max(300, 'Cada regla puede tener hasta 300 caracteres'))
  .max(15, 'Podés cargar hasta 15 reglas');

const createSchema = z.object({
  name: nameSchema,
  slug: z
    .string({ error: 'Ingresá un slug' })
    .trim()
    .toLowerCase()
    .min(2, 'El slug tiene que tener entre 2 y 50 caracteres')
    .max(50, 'El slug tiene que tener entre 2 y 50 caracteres')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'El slug solo puede tener minúsculas, números y guiones'),
  description: descriptionSchema.default(''),
  icon: iconSchema,
  color: hexColorSchema,
  rules: rulesSchema.default([]),
});

router.post('/', requireAdmin, async (req, res) => {
  const data = parse(createSchema, req.body);
  const clash = await prisma.community.findFirst({ where: { OR: [{ slug: data.slug }, { name: data.name }] }, select: { slug: true } });
  if (clash) throw conflict(clash.slug === data.slug ? 'Ya existe una comunidad con ese slug' : 'Ya existe una comunidad con ese nombre');
  const created = await prisma.community.create({ data, include: communityInclude(authUser(req).id) });
  res.status(201).json({ community: toCommunity(created) });
});

const updateSchema = z.object({
  name: nameSchema.optional(),
  description: descriptionSchema.optional(),
  icon: iconSchema.optional(),
  color: hexColorSchema.optional(),
  rules: rulesSchema.optional(),
});

router.patch('/:slug', requireAdmin, async (req, res) => {
  const current = await getCommunityOr404(String(req.params.slug), null);
  const data = parse(updateSchema, req.body); // `slug` se ignora: no cambia
  if (data.name && data.name !== current.name) {
    const clash = await prisma.community.findUnique({ where: { name: data.name }, select: { id: true } });
    if (clash) throw conflict('Ya existe una comunidad con ese nombre');
  }
  const updated = await prisma.community.update({
    where: { id: current.id },
    data,
    include: communityInclude(authUser(req).id),
  });
  res.json({ community: toCommunity(updated) });
});

router.delete('/:slug', requireAdmin, async (req, res) => {
  const current = await getCommunityOr404(String(req.params.slug), null);
  // Los posts (y sus comentarios) se van en cascada: borramos también sus archivos.
  const files = await storedNamesWhere({
    OR: [{ post: { communityId: current.id } }, { comment: { post: { communityId: current.id } } }],
  });
  await prisma.community.delete({ where: { id: current.id } });
  await removeStoredFiles(files);
  res.status(204).end();
});

router.post('/:slug/join', requireWriter, actionLimiter, async (req, res) => {
  const user = authUser(req);
  const community = await getCommunityOr404(String(req.params.slug), null);
  await prisma.membership.upsert({
    where: { userId_communityId: { userId: user.id, communityId: community.id } },
    create: { userId: user.id, communityId: community.id },
    update: {},
  });
  const memberCount = await prisma.membership.count({ where: { communityId: community.id } });
  res.json({ isMember: true, memberCount });
});

router.delete('/:slug/join', requireAuth, async (req, res) => {
  const user = authUser(req);
  const community = await getCommunityOr404(String(req.params.slug), null);
  await prisma.membership.deleteMany({ where: { userId: user.id, communityId: community.id } });
  const memberCount = await prisma.membership.count({ where: { communityId: community.id } });
  res.json({ isMember: false, memberCount });
});

export default router;
