import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import {
  attachmentIdsSchema,
  deleteAttachmentsWhere,
  linkAttachments,
  MAX_ATTACHMENTS,
  postAttachmentsWhere,
  removeStoredFiles,
  storedNamesWhere,
} from '../lib/attachments.js';
import { forbidden, HttpError, notFound } from '../lib/errors.js';
import { notify, notifyMentions } from '../lib/notify.js';
import { assertTagsExist, bodySchema, imageUrlSchema, POST_TYPES, tagIdsSchema } from '../lib/postSchemas.js';
import {
  getPostRowOrThrow,
  isHttpUrl,
  listPosts,
  periodStart,
  postOrderBy,
  refreshPostScore,
  serializePostDetail,
} from '../lib/posts.js';
import { prisma } from '../lib/prisma.js';
import { normalizeEmoji, postReactionSummaries } from '../lib/reactions.js';
import { toPoll, toUserSummary, userSummarySelect } from '../lib/serializers.js';
import { hotScore } from '../lib/text.js';
import { boolQuery, idSchema, limitSchema, pageSchema, parse, parseId } from '../lib/validate.js';
import { authUser, isMod, requireAuth, requireMod, requireWriter } from '../middleware/auth.js';
import { actionLimiter, postLimiter, voteLimiter } from '../middleware/rateLimit.js';

const router = Router();
const POST_NOT_FOUND = 'El post no existe o fue eliminado';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const listQuerySchema = z.object({
  sort: z.enum(['hot', 'new', 'top', 'comments']).default('hot'),
  t: z.enum(['day', 'week', 'month', 'year', 'all']).default('all'),
  feed: z.enum(['all', 'following']).default('all'),
  community: optionalText(80),
  tag: optionalText(80),
  author: optionalText(40),
  type: z
    .string()
    .optional()
    .transform((v) => (v ? v.toUpperCase() : undefined))
    .pipe(z.enum(POST_TYPES).optional()),
  unanswered: boolQuery,
  hasAttachments: boolQuery,
  q: optionalText(200),
  page: pageSchema,
  limit: limitSchema(),
});

// GET /posts
router.get('/', async (req, res) => {
  const query = parse(listQuerySchema, req.query);
  const viewer = req.user ?? null;
  const and: Prisma.PostWhereInput[] = [];

  if (query.community) and.push({ community: { slug: query.community.toLowerCase() } });
  if (query.tag) and.push({ tags: { some: { tag: { slug: query.tag.toLowerCase() } } } });
  if (query.author) and.push({ author: { usernameKey: query.author.toLowerCase() } });
  if (query.type) and.push({ type: query.type });
  if (query.unanswered) and.push({ type: 'QUESTION', acceptedCommentId: null });
  if (query.hasAttachments) and.push({ attachments: { some: {} } });
  if (query.q) and.push({ OR: [{ title: { contains: query.q } }, { body: { contains: query.q } }] });
  if (query.feed === 'following') {
    const user = authUser(req);
    const [memberships, follows] = await Promise.all([
      prisma.membership.findMany({ where: { userId: user.id }, select: { communityId: true } }),
      prisma.follow.findMany({ where: { followerId: user.id }, select: { followingId: true } }),
    ]);
    and.push({
      OR: [
        { communityId: { in: memberships.map((m) => m.communityId) } },
        { authorId: { in: follows.map((f) => f.followingId) } },
      ],
    });
  }
  if (query.sort === 'top' || query.sort === 'comments') {
    const since = periodStart(query.t);
    if (since) and.push({ createdAt: { gte: since } });
  }

  const result = await listPosts({
    where: and.length > 0 ? { AND: and } : {},
    orderBy: postOrderBy(query.sort, !!query.community),
    page: query.page,
    limit: query.limit,
    viewerId: viewer?.id ?? null,
  });
  res.json(result);
});

const titleSchema = z
  .string({ error: 'Escribí un título' })
  .trim()
  .min(3, 'El título tiene que tener entre 3 y 200 caracteres')
  .max(200, 'El título tiene que tener entre 3 y 200 caracteres');

const createSchema = z
  .object({
    communityId: z.coerce.number({ error: 'Elegí una comunidad' }).int().positive('Elegí una comunidad'),
    type: z.enum(POST_TYPES, { error: 'Tipo de post inválido' }).default('TEXT'),
    title: titleSchema,
    body: bodySchema.optional().default(''),
    url: z.union([z.string().trim().max(2000, 'El link es demasiado largo'), z.null()]).optional(),
    imageUrl: imageUrlSchema,
    tagIds: tagIdsSchema.optional().default([]),
    poll: z
      .object({
        options: z
          .array(
            z
              .string({ error: 'Cada opción tiene que ser texto' })
              .trim()
              .min(1, 'Las opciones no pueden estar vacías')
              .max(80, 'Cada opción puede tener hasta 80 caracteres'),
          )
          .min(2, 'La encuesta necesita al menos 2 opciones')
          .max(6, 'La encuesta puede tener hasta 6 opciones'),
        closesInDays: z
          .number()
          .int()
          .min(1, 'La encuesta tiene que durar entre 1 y 30 días')
          .max(30, 'La encuesta tiene que durar entre 1 y 30 días')
          .nullable()
          .optional(),
      })
      .nullable()
      .optional(),
    attachmentIds: attachmentIdsSchema(MAX_ATTACHMENTS.post).optional(),
    draftId: idSchema.optional(),
  })
  .superRefine((d, ctx) => {
    if ((d.type === 'TEXT' || d.type === 'QUESTION') && d.body.trim() === '') {
      ctx.addIssue({ code: 'custom', path: ['body'], message: 'Escribí el contenido del post' });
    }
    if (d.type === 'LINK') {
      if (!d.url) ctx.addIssue({ code: 'custom', path: ['url'], message: 'Ingresá el link' });
      else if (!isHttpUrl(d.url)) {
        ctx.addIssue({ code: 'custom', path: ['url'], message: 'El link tiene que empezar con http:// o https://' });
      }
    }
    if (d.type === 'POLL') {
      if (!d.poll) ctx.addIssue({ code: 'custom', path: ['poll'], message: 'Agregá las opciones de la encuesta' });
      else {
        const seen = new Set(d.poll.options.map((o) => o.toLowerCase()));
        if (seen.size !== d.poll.options.length) {
          ctx.addIssue({ code: 'custom', path: ['poll', 'options'], message: 'Las opciones no pueden repetirse' });
        }
      }
    }
  });

// POST /posts
router.post('/', requireWriter, postLimiter, async (req, res) => {
  const user = authUser(req);
  const data = parse(createSchema, req.body);
  const community = await prisma.community.findUnique({ where: { id: data.communityId }, select: { id: true } });
  if (!community) throw new HttpError(400, 'VALIDATION', 'La comunidad no existe', { communityId: 'La comunidad no existe' });
  await assertTagsExist(data.tagIds);
  if (data.draftId !== undefined) {
    const draft = await prisma.draft.findUnique({ where: { id: data.draftId }, select: { userId: true } });
    if (!draft || draft.userId !== user.id) {
      throw new HttpError(400, 'VALIDATION', 'El borrador no existe', { draftId: 'El borrador no existe' });
    }
  }

  const createdAt = new Date();
  const poll = data.type === 'POLL' ? data.poll : null;
  const draftId = data.draftId;
  const toRemove: string[] = [];
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.post.create({
      data: {
        type: data.type,
        title: data.title,
        body: data.body.trim(),
        url: data.type === 'LINK' ? (data.url ?? null) : null,
        imageUrl: data.imageUrl ?? null,
        authorId: user.id,
        communityId: community.id,
        createdAt,
        hot: hotScore(0, createdAt),
        pollClosesAt: poll?.closesInDays ? new Date(createdAt.getTime() + poll.closesInDays * 86_400_000) : null,
        tags: { create: data.tagIds.map((tagId) => ({ tagId })) },
        ...(poll ? { pollOptions: { create: poll.options.map((text, position) => ({ text, position })) } } : {}),
      },
      select: { id: true, title: true, body: true },
    });
    // Sin attachmentIds explícitos, los adjuntos del borrador pasan al post.
    const ids =
      data.attachmentIds ??
      (draftId !== undefined ? (await tx.attachment.findMany({ where: { draftId }, select: { id: true } })).map((a) => a.id) : []);
    if (ids.length > MAX_ATTACHMENTS.post) {
      throw new HttpError(400, 'VALIDATION', `Podés adjuntar hasta ${MAX_ATTACHMENTS.post} archivos`, { attachmentIds: 'Demasiados adjuntos' });
    }
    await linkAttachments(tx, {
      ids,
      userId: user.id,
      target: { postId: row.id },
      ...(draftId !== undefined ? { alsoAllow: { draftId } } : {}),
    });
    if (draftId !== undefined) {
      toRemove.push(...(await deleteAttachmentsWhere(tx, { draftId })));
      await tx.draft.delete({ where: { id: draftId } });
    }
    return row;
  });
  await removeStoredFiles(toRemove);

  await notifyMentions({ text: `${created.title}\n${created.body}`, actorId: user.id, postId: created.id });
  const post = await getPostRowOrThrow(created.id, user.id);
  res.status(201).json({ post: await serializePostDetail(post, user) });
});

// GET /posts/:id  (suma una vista)
router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id, 'El post no existe o fue eliminado');
  const viewer = req.user ?? null;
  const updated = await prisma.post.updateMany({ where: { id }, data: { viewCount: { increment: 1 } } });
  if (updated.count === 0) throw notFound('El post no existe o fue eliminado');
  const post = await getPostRowOrThrow(id, viewer?.id ?? null);
  res.json({ post: await serializePostDetail(post, viewer) });
});

const updateSchema = z.object({
  title: titleSchema.optional(),
  body: bodySchema.optional(),
  tagIds: tagIdsSchema.optional(),
  imageUrl: imageUrlSchema,
  attachmentIds: attachmentIdsSchema(MAX_ATTACHMENTS.post).optional(),
});

// PATCH /posts/:id  (autor o mod)
router.patch('/:id', requireWriter, async (req, res) => {
  const user = authUser(req);
  const id = parseId(req.params.id, 'El post no existe o fue eliminado');
  const data = parse(updateSchema, req.body);
  const current = await prisma.post.findUnique({ where: { id }, select: { authorId: true, type: true, body: true, title: true } });
  if (!current) throw notFound('El post no existe o fue eliminado');
  if (current.authorId !== user.id && !isMod(user)) throw forbidden('Solo el autor o un moderador pueden editar este post');
  if (data.body !== undefined && (current.type === 'TEXT' || current.type === 'QUESTION') && data.body.trim() === '') {
    throw new HttpError(400, 'VALIDATION', 'Escribí el contenido del post', { body: 'Escribí el contenido del post' });
  }
  if (data.tagIds) await assertTagsExist(data.tagIds);

  const changed =
    data.title !== undefined ||
    data.body !== undefined ||
    data.tagIds !== undefined ||
    data.imageUrl !== undefined ||
    data.attachmentIds !== undefined;
  const attachmentIds = data.attachmentIds;
  const removed = await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.body !== undefined ? { body: data.body.trim() } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
        ...(data.tagIds ? { tags: { deleteMany: {}, create: data.tagIds.map((tagId) => ({ tagId })) } } : {}),
        ...(changed ? { editedAt: new Date() } : {}),
      },
    });
    if (attachmentIds === undefined) return [];
    return linkAttachments(tx, { ids: attachmentIds, userId: user.id, target: { postId: id }, replace: true });
  });
  await removeStoredFiles(removed);
  const post = await getPostRowOrThrow(id, user.id);

  if (data.body !== undefined || data.title !== undefined) {
    await notifyMentions({
      text: `${post.title}\n${post.body}`,
      previousText: `${current.title}\n${current.body}`,
      actorId: user.id,
      postId: post.id,
    });
  }
  res.json({ post: await serializePostDetail(post, user) });
});

// DELETE /posts/:id  (autor o mod; un usuario baneado puede borrar lo suyo)
router.delete('/:id', requireAuth, async (req, res) => {
  const user = authUser(req);
  const id = parseId(req.params.id, 'El post no existe o fue eliminado');
  const post = await prisma.post.findUnique({ where: { id }, select: { id: true, authorId: true, title: true } });
  if (!post) throw notFound('El post no existe o fue eliminado');
  const isAuthor = post.authorId === user.id;
  if (!isAuthor && !isMod(user)) throw forbidden('Solo el autor o un moderador pueden borrar este post');

  const files = await storedNamesWhere(postAttachmentsWhere(id));
  await prisma.$transaction([
    // Los reportes pendientes sobre este contenido quedan resueltos.
    prisma.report.updateMany({
      where: { status: 'PENDING', OR: [{ postId: id }, { comment: { postId: id } }] },
      data: { status: 'RESOLVED', resolvedById: user.id, resolvedAt: new Date() },
    }),
    prisma.post.delete({ where: { id } }),
  ]);
  await removeStoredFiles(files);

  if (!isAuthor && post.authorId) {
    await notify({
      userId: post.authorId,
      type: 'MOD',
      message: `Un moderador eliminó tu post «${post.title}».`,
    });
  }
  res.status(204).end();
});

const voteSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1), z.literal(0)], { error: 'El voto tiene que ser 1, -1 o 0' }),
});

// POST /posts/:id/vote
router.post('/:id/vote', requireWriter, voteLimiter, async (req, res) => {
  const user = authUser(req);
  const id = parseId(req.params.id, 'El post no existe o fue eliminado');
  const { value } = parse(voteSchema, req.body);
  const exists = await prisma.post.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw notFound('El post no existe o fue eliminado');

  const score = await prisma.$transaction(async (tx) => {
    if (value === 0) {
      await tx.postVote.deleteMany({ where: { userId: user.id, postId: id } });
    } else {
      await tx.postVote.upsert({
        where: { userId_postId: { userId: user.id, postId: id } },
        create: { userId: user.id, postId: id, value },
        update: { value },
      });
    }
    return refreshPostScore(tx, id);
  });
  res.json({ score, myVote: value });
});

// POST/DELETE /posts/:id/bookmark
router.post('/:id/bookmark', requireAuth, actionLimiter, async (req, res) => {
  const user = authUser(req);
  const id = parseId(req.params.id, 'El post no existe o fue eliminado');
  const exists = await prisma.post.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw notFound('El post no existe o fue eliminado');
  await prisma.bookmark.upsert({
    where: { userId_postId: { userId: user.id, postId: id } },
    create: { userId: user.id, postId: id },
    update: {},
  });
  res.json({ isBookmarked: true });
});

router.delete('/:id/bookmark', requireAuth, async (req, res) => {
  const user = authUser(req);
  const id = parseId(req.params.id, 'El post no existe o fue eliminado');
  await prisma.bookmark.deleteMany({ where: { userId: user.id, postId: id } });
  res.json({ isBookmarked: false });
});

// POST /posts/:id/pin  🛡
router.post('/:id/pin', requireMod, requireWriter, async (req, res) => {
  const id = parseId(req.params.id, 'El post no existe o fue eliminado');
  const { pinned } = parse(z.object({ pinned: z.boolean({ error: 'Indicá si el post queda fijado' }) }), req.body);
  const post = await prisma.post.update({ where: { id }, data: { isPinned: pinned }, select: { isPinned: true } }).catch(() => null);
  if (!post) throw notFound('El post no existe o fue eliminado');
  res.json({ isPinned: post.isPinned });
});

// POST /posts/:id/lock  🛡
router.post('/:id/lock', requireMod, requireWriter, async (req, res) => {
  const id = parseId(req.params.id, 'El post no existe o fue eliminado');
  const { locked } = parse(z.object({ locked: z.boolean({ error: 'Indicá si el post queda cerrado' }) }), req.body);
  const post = await prisma.post.update({ where: { id }, data: { isLocked: locked }, select: { isLocked: true } }).catch(() => null);
  if (!post) throw notFound('El post no existe o fue eliminado');
  res.json({ isLocked: post.isLocked });
});

// POST /posts/:id/accept  (autor del post QUESTION o mod)
router.post('/:id/accept', requireWriter, async (req, res) => {
  const user = authUser(req);
  const id = parseId(req.params.id, 'El post no existe o fue eliminado');
  const { commentId } = parse(
    z.object({ commentId: z.union([idSchema, z.null()], { error: 'Indicá el comentario a aceptar (o null)' }) }),
    req.body,
  );
  const post = await prisma.post.findUnique({ where: { id }, select: { id: true, type: true, authorId: true, acceptedCommentId: true } });
  if (!post) throw notFound('El post no existe o fue eliminado');
  if (post.type !== 'QUESTION') throw new HttpError(400, 'VALIDATION', 'Solo las preguntas tienen respuesta aceptada', {});
  if (post.authorId !== user.id && !isMod(user)) throw forbidden('Solo quien hizo la pregunta puede aceptar una respuesta');

  let commentAuthorId: number | null = null;
  if (commentId !== null) {
    const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { postId: true, isDeleted: true, authorId: true } });
    if (!comment || comment.postId !== id || comment.isDeleted) {
      throw new HttpError(400, 'VALIDATION', 'Ese comentario no pertenece a este post', { commentId: 'Comentario inválido' });
    }
    commentAuthorId = comment.authorId;
  }
  await prisma.post.update({ where: { id }, data: { acceptedCommentId: commentId } });
  if (commentId !== null && commentId !== post.acceptedCommentId && commentAuthorId) {
    await notify({ userId: commentAuthorId, type: 'ANSWER_ACCEPTED', actorId: user.id, postId: id, commentId });
  }
  res.json({ acceptedCommentId: commentId });
});

// POST /posts/:id/poll/vote
router.post('/:id/poll/vote', requireWriter, voteLimiter, async (req, res) => {
  const user = authUser(req);
  const id = parseId(req.params.id, 'El post no existe o fue eliminado');
  const { optionId } = parse(z.object({ optionId: idSchema }), req.body);
  const post = await prisma.post.findUnique({ where: { id }, select: { type: true, pollClosesAt: true } });
  if (!post) throw notFound('El post no existe o fue eliminado');
  if (post.type !== 'POLL') throw new HttpError(400, 'VALIDATION', 'Este post no es una encuesta', {});
  if (post.pollClosesAt && post.pollClosesAt.getTime() <= Date.now()) {
    throw new HttpError(409, 'CONFLICT', 'La encuesta ya está cerrada');
  }
  const option = await prisma.pollOption.findUnique({ where: { id: optionId }, select: { postId: true } });
  if (!option || option.postId !== id) {
    throw new HttpError(400, 'VALIDATION', 'Esa opción no pertenece a la encuesta', { optionId: 'Opción inválida' });
  }
  await prisma.pollVote.upsert({
    where: { postId_userId: { postId: id, userId: user.id } },
    create: { postId: id, userId: user.id, optionId },
    update: { optionId },
  });
  const row = await getPostRowOrThrow(id, user.id);
  res.json({ poll: toPoll(row) });
});

// ---------- reacciones ----------

const reactionSchema = z.object({
  emoji: z.unknown().transform((v, ctx) => {
    const emoji = normalizeEmoji(v);
    if (!emoji) {
      ctx.addIssue({ code: 'custom', message: 'Esa reacción no está permitida' });
      return z.NEVER;
    }
    return emoji;
  }),
});

const optionalEmojiQuery = z.object({
  emoji: z
    .unknown()
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === '') return undefined;
      const emoji = normalizeEmoji(v);
      if (!emoji) {
        ctx.addIssue({ code: 'custom', message: 'Esa reacción no está permitida' });
        return z.NEVER;
      }
      return emoji;
    }),
});

// POST /posts/:id/reactions  (toggle)
router.post('/:id/reactions', requireWriter, voteLimiter, async (req, res) => {
  const user = authUser(req);
  const id = parseId(req.params.id, POST_NOT_FOUND);
  const { emoji } = parse(reactionSchema, req.body);
  const post = await prisma.post.findUnique({ where: { id }, select: { id: true, authorId: true } });
  if (!post) throw notFound(POST_NOT_FOUND);

  const where = { userId: user.id, postId: id, emoji };
  const removed = await prisma.postReaction.deleteMany({ where });
  let added = false;
  if (removed.count === 0) {
    added = await prisma.postReaction
      .create({ data: where })
      .then(() => true)
      .catch((err: unknown) => {
        if ((err as { code?: string }).code === 'P2002') return false; // doble click simultáneo
        throw err;
      });
  }
  if (added && post.authorId && post.authorId !== user.id) {
    // Solo la primera reacción de esta persona a este post genera notificación.
    const already = await prisma.notification.findFirst({
      where: { userId: post.authorId, actorId: user.id, type: 'REACTION', postId: id, commentId: null },
      select: { id: true },
    });
    if (!already) await notify({ userId: post.authorId, type: 'REACTION', actorId: user.id, postId: id, message: emoji });
  }
  const reactions = (await postReactionSummaries([id], user.id)).get(id) ?? [];
  res.json({ reactions });
});

// GET /posts/:id/reactions/users?emoji=
router.get('/:id/reactions/users', async (req, res) => {
  const id = parseId(req.params.id, POST_NOT_FOUND);
  const { emoji } = parse(optionalEmojiQuery, req.query);
  const post = await prisma.post.findUnique({ where: { id }, select: { id: true } });
  if (!post) throw notFound(POST_NOT_FOUND);
  const rows = await prisma.postReaction.findMany({
    where: { postId: id, ...(emoji ? { emoji } : {}) },
    orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }],
    take: 200,
    select: { user: { select: userSummarySelect } },
  });
  const seen = new Set<number>();
  const items = rows
    .filter((r) => !seen.has(r.user.id) && seen.add(r.user.id))
    .slice(0, 50)
    .map((r) => toUserSummary(r.user));
  res.json({ items });
});

export default router;
