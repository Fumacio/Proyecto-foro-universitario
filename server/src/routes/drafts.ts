import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { attachmentIdsSchema, linkAttachments, MAX_ATTACHMENTS, removeStoredFiles, storedNamesWhere } from '../lib/attachments.js';
import { conflict, HttpError, notFound } from '../lib/errors.js';
import { BODY_MAX, imageUrlSchema, POST_TYPES, tagIdsSchema } from '../lib/postSchemas.js';
import { prisma } from '../lib/prisma.js';
import { attachmentsInclude, iso, toAttachment } from '../lib/serializers.js';
import type { DraftDto } from '../lib/types.js';
import { idSchema, parse, parseId } from '../lib/validate.js';
import { authUser, requireAuth } from '../middleware/auth.js';
import { actionLimiter } from '../middleware/rateLimit.js';

const router = Router();
router.use(requireAuth);

export const MAX_DRAFTS = 50;
const NOT_FOUND = 'Ese borrador no existe';

const draftInclude = { attachments: attachmentsInclude } satisfies Prisma.DraftInclude;
type DraftRow = Prisma.DraftGetPayload<{ include: typeof draftInclude }>;

function jsonNumbers(value: Prisma.JsonValue): number[] {
  return Array.isArray(value) ? value.filter((v): v is number => typeof v === 'number' && Number.isSafeInteger(v)) : [];
}

function jsonPoll(value: Prisma.JsonValue | null): DraftDto['poll'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const options = Array.isArray(v.options) ? v.options.filter((o): o is string => typeof o === 'string') : [];
  const closesInDays = typeof v.closesInDays === 'number' ? v.closesInDays : null;
  return { options, closesInDays };
}

function toDraft(d: DraftRow, existingTags?: Set<number>): DraftDto {
  const tagIds = jsonNumbers(d.tagIds);
  return {
    id: d.id,
    communityId: d.communityId,
    type: d.type,
    title: d.title,
    body: d.body,
    url: d.url,
    imageUrl: d.imageUrl,
    tagIds: existingTags ? tagIds.filter((id) => existingTags.has(id)) : tagIds,
    poll: jsonPoll(d.poll),
    attachments: d.attachments.map(toAttachment),
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt),
  };
}

/** Las etiquetas pueden haberse borrado después de guardar el borrador: se filtran al leer. */
async function serializeDrafts(rows: DraftRow[]): Promise<DraftDto[]> {
  const ids = [...new Set(rows.flatMap((d) => jsonNumbers(d.tagIds)))];
  const existing = ids.length
    ? new Set((await prisma.tag.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((t) => t.id))
    : new Set<number>();
  return rows.map((d) => toDraft(d, existing));
}

// Validación laxa (un borrador puede estar incompleto) pero con los máximos de un post.
const draftSchema = z.object({
  communityId: z.union([idSchema, z.null()]).optional(),
  type: z.enum(POST_TYPES, { error: 'Tipo de post inválido' }).optional(),
  title: z.string().trim().max(200, 'El título puede tener como máximo 200 caracteres').optional(),
  body: z.string().max(BODY_MAX, 'El texto puede tener como máximo 40.000 caracteres').optional(),
  url: z
    .union([z.string().trim().max(2000, 'El link es demasiado largo'), z.null()])
    .optional()
    .transform((v) => (v === '' ? null : v)),
  imageUrl: imageUrlSchema,
  tagIds: tagIdsSchema.optional(),
  poll: z
    .object({
      options: z.array(z.string().max(80, 'Cada opción puede tener hasta 80 caracteres')).max(6, 'La encuesta puede tener hasta 6 opciones').default([]),
      closesInDays: z
        .number()
        .int()
        .min(1, 'La encuesta tiene que durar entre 1 y 30 días')
        .max(30, 'La encuesta tiene que durar entre 1 y 30 días')
        .nullable()
        .optional()
        .transform((v) => v ?? null),
    })
    .nullable()
    .optional(),
  attachmentIds: attachmentIdsSchema(MAX_ATTACHMENTS.draft).optional(),
});

type DraftInput = z.output<typeof draftSchema>;

async function draftData(data: DraftInput): Promise<Prisma.DraftUncheckedUpdateInput> {
  if (data.communityId != null) {
    const exists = await prisma.community.findUnique({ where: { id: data.communityId }, select: { id: true } });
    if (!exists) throw new HttpError(400, 'VALIDATION', 'La comunidad no existe', { communityId: 'La comunidad no existe' });
  }
  let tagIds: number[] | undefined;
  if (data.tagIds) {
    const found = data.tagIds.length ? await prisma.tag.findMany({ where: { id: { in: data.tagIds } }, select: { id: true } }) : [];
    const ok = new Set(found.map((t) => t.id));
    tagIds = data.tagIds.filter((id) => ok.has(id));
  }
  return {
    ...(data.communityId !== undefined ? { communityId: data.communityId } : {}),
    ...(data.type !== undefined ? { type: data.type } : {}),
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.body !== undefined ? { body: data.body } : {}),
    ...(data.url !== undefined ? { url: data.url } : {}),
    ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
    ...(tagIds !== undefined ? { tagIds } : {}),
    ...(data.poll !== undefined ? { poll: data.poll === null ? Prisma.DbNull : data.poll } : {}),
  };
}

async function draftOr404(id: number, userId: number) {
  const draft = await prisma.draft.findUnique({ where: { id }, include: draftInclude });
  if (!draft || draft.userId !== userId) throw notFound(NOT_FOUND);
  return draft;
}

router.get('/', async (req, res) => {
  const user = authUser(req);
  const rows = await prisma.draft.findMany({
    where: { userId: user.id },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: MAX_DRAFTS,
    include: draftInclude,
  });
  res.json({ items: await serializeDrafts(rows) });
});

router.post('/', actionLimiter, async (req, res) => {
  const user = authUser(req);
  const data = parse(draftSchema, req.body);
  if ((await prisma.draft.count({ where: { userId: user.id } })) >= MAX_DRAFTS) {
    throw conflict(`Llegaste al máximo de ${MAX_DRAFTS} borradores. Borrá alguno para guardar uno nuevo.`);
  }
  const fields = await draftData(data);
  const id = await prisma.$transaction(async (tx) => {
    const created = await tx.draft.create({
      data: { ...(fields as Prisma.DraftUncheckedCreateInput), userId: user.id },
      select: { id: true },
    });
    if (data.attachmentIds?.length) {
      await linkAttachments(tx, { ids: data.attachmentIds, userId: user.id, target: { draftId: created.id } });
    }
    return created.id;
  });
  const [draft] = await serializeDrafts([await draftOr404(id, user.id)]);
  res.status(201).json({ draft });
});

router.get('/:id', async (req, res) => {
  const user = authUser(req);
  const draft = await draftOr404(parseId(req.params.id, NOT_FOUND), user.id);
  const [dto] = await serializeDrafts([draft]);
  res.json({ draft: dto });
});

router.patch('/:id', async (req, res) => {
  const user = authUser(req);
  const id = parseId(req.params.id, NOT_FOUND);
  await draftOr404(id, user.id);
  const data = parse(draftSchema, req.body);
  const fields = await draftData(data);
  const removed = await prisma.$transaction(async (tx) => {
    await tx.draft.update({ where: { id }, data: { ...fields, updatedAt: new Date() } });
    if (data.attachmentIds === undefined) return [];
    return linkAttachments(tx, { ids: data.attachmentIds, userId: user.id, target: { draftId: id }, replace: true });
  });
  await removeStoredFiles(removed);
  const [draft] = await serializeDrafts([await draftOr404(id, user.id)]);
  res.json({ draft });
});

router.delete('/:id', async (req, res) => {
  const user = authUser(req);
  const id = parseId(req.params.id, NOT_FOUND);
  await draftOr404(id, user.id);
  const files = await storedNamesWhere({ draftId: id });
  await prisma.draft.delete({ where: { id } });
  await removeStoredFiles(files);
  res.status(204).end();
});

export default router;
