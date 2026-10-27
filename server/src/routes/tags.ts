import { Router } from 'express';
import { z } from 'zod';
import { conflict, HttpError, notFound } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { tagInclude, toTag } from '../lib/serializers.js';
import { slugify } from '../lib/text.js';
import { hexColorSchema, parse, parseId } from '../lib/validate.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', async (_req, res) => {
  const rows = await prisma.tag.findMany({
    include: tagInclude,
    orderBy: [{ posts: { _count: 'desc' } }, { name: 'asc' }],
  });
  res.json({ items: rows.map(toTag) });
});

const createSchema = z.object({
  name: z
    .string({ error: 'Ingresá un nombre' })
    .trim()
    .min(2, 'El nombre tiene que tener entre 2 y 30 caracteres')
    .max(30, 'El nombre tiene que tener entre 2 y 30 caracteres'),
  color: hexColorSchema,
});

router.post('/', requireAdmin, async (req, res) => {
  const { name, color } = parse(createSchema, req.body);
  const slug = slugify(name);
  if (!slug) throw new HttpError(400, 'VALIDATION', 'El nombre tiene que tener letras o números', { name: 'Nombre inválido' });
  const clash = await prisma.tag.findFirst({ where: { OR: [{ slug }, { name }] }, select: { id: true } });
  if (clash) throw conflict('Ya existe una etiqueta con ese nombre');
  const tag = await prisma.tag.create({ data: { name, slug, color }, include: tagInclude });
  res.status(201).json({ tag: toTag(tag) });
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const id = parseId(req.params.id, 'Esa etiqueta no existe');
  const deleted = await prisma.tag.deleteMany({ where: { id } });
  if (deleted.count === 0) throw notFound('Esa etiqueta no existe');
  res.status(204).end();
});

export default router;
