import { Router } from 'express';
import { z } from 'zod';
import {
  attachmentIdsSchema,
  deleteAttachmentsWhere,
  linkAttachments,
  MAX_ATTACHMENTS,
  removeStoredFiles,
} from '../lib/attachments.js';
import { forbidden, HttpError, locked, notFound } from '../lib/errors.js';
import { notify, notifyMentions } from '../lib/notify.js';
import { refreshCommentCount, refreshCommentScore } from '../lib/posts.js';
import { prisma } from '../lib/prisma.js';
import { commentReactionSummaries, normalizeEmoji } from '../lib/reactions.js';
import { buildCommentTree, commentInclude, toComment, toUserSummary, userSummarySelect } from '../lib/serializers.js';
import type { CommentDto } from '../lib/types.js';
import { idSchema, parse, parseId } from '../lib/validate.js';
import { authUser, isMod, requireAuth, requireWriter } from '../middleware/auth.js';
import { commentLimiter, voteLimiter } from '../middleware/rateLimit.js';

const router = Router();

function findInTree(list: CommentDto[], id: number): CommentDto | null {
  for (const node of list) {
    if (node.id === id) return node;
    const found = findInTree(node.replies, id);
    if (found) return found;
  }
  return null;
}

const POST_NOT_FOUND = 'El post no existe o fue eliminado';
const COMMENT_NOT_FOUND = 'El comentario no existe o fue eliminado';

const commentBody = z
  .string({ error: 'Escribí un comentario' })
  .trim()
  .min(1, 'El comentario no puede estar vacío')
  .max(10_000, 'El comentario puede tener como máximo 10.000 caracteres');

// GET /posts/:id/comments
router.get('/posts/:id/comments', async (req, res) => {
  const postId = parseId(req.params.id, POST_NOT_FOUND);
  const { sort } = parse(z.object({ sort: z.enum(['best', 'new', 'old']).default('best') }), req.query);
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { acceptedCommentId: true } });
  if (!post) throw notFound(POST_NOT_FOUND);
  const viewerId = req.user?.id ?? null;
  const rows = await prisma.comment.findMany({
    where: { postId },
    include: commentInclude(viewerId),
    orderBy: { id: 'asc' },
  });
  const reactions = await commentReactionSummaries(
    rows.filter((c) => !c.isDeleted).map((c) => c.id),
    viewerId,
  );
  res.json({
    items: buildCommentTree(rows, post.acceptedCommentId, sort, reactions),
    total: rows.reduce((n, c) => n + (c.isDeleted ? 0 : 1), 0),
  });
});

const createSchema = z.object({
  body: commentBody,
  parentId: z.union([idSchema, z.null()]).optional(),
  attachmentIds: attachmentIdsSchema(MAX_ATTACHMENTS.comment).optional(),
});

// POST /posts/:id/comments
router.post('/posts/:id/comments', requireWriter, commentLimiter, async (req, res) => {
  const user = authUser(req);
  const postId = parseId(req.params.id, POST_NOT_FOUND);
  const { body, parentId, attachmentIds } = parse(createSchema, req.body);
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, isLocked: true, acceptedCommentId: true },
  });
  if (!post) throw notFound(POST_NOT_FOUND);
  if (post.isLocked && !isMod(user)) throw locked();

  let parentAuthorId: number | null = null;
  if (parentId != null) {
    const parent = await prisma.comment.findUnique({ where: { id: parentId }, select: { postId: true, isDeleted: true, authorId: true } });
    if (!parent || parent.postId !== postId) {
      throw new HttpError(400, 'VALIDATION', 'El comentario al que respondés no existe', { parentId: 'Comentario inválido' });
    }
    if (parent.isDeleted) {
      throw new HttpError(400, 'VALIDATION', 'No se puede responder a un comentario eliminado', { parentId: 'Comentario eliminado' });
    }
    parentAuthorId = parent.authorId;
  }

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: { postId, parentId: parentId ?? null, authorId: user.id, body },
      select: { id: true },
    });
    if (attachmentIds?.length) await linkAttachments(tx, { ids: attachmentIds, userId: user.id, target: { commentId: created.id } });
    await refreshCommentCount(tx, postId);
    return tx.comment.findUniqueOrThrow({ where: { id: created.id }, include: commentInclude(user.id) });
  });

  // Notificaciones: respuesta directa + menciones (sin duplicar a quien ya recibe la respuesta).
  const replyTarget = parentId != null ? parentAuthorId : post.authorId;
  if (replyTarget && replyTarget !== user.id) {
    await notify({
      userId: replyTarget,
      type: parentId != null ? 'COMMENT_REPLY' : 'POST_REPLY',
      actorId: user.id,
      postId,
      commentId: comment.id,
    });
  }
  await notifyMentions({
    text: body,
    actorId: user.id,
    postId,
    commentId: comment.id,
    skipUserIds: replyTarget ? [replyTarget] : [],
  });

  res.status(201).json({ comment: toComment(comment, post.acceptedCommentId) });
});

// PATCH /comments/:id  (solo el autor)
router.patch('/comments/:id', requireWriter, async (req, res) => {
  const user = authUser(req);
  const id = parseId(req.params.id, COMMENT_NOT_FOUND);
  const { body, attachmentIds } = parse(
    z.object({ body: commentBody, attachmentIds: attachmentIdsSchema(MAX_ATTACHMENTS.comment).optional() }),
    req.body,
  );
  const current = await prisma.comment.findUnique({
    where: { id },
    select: { authorId: true, isDeleted: true, body: true, postId: true, post: { select: { isLocked: true, acceptedCommentId: true } } },
  });
  if (!current || current.isDeleted) throw notFound(COMMENT_NOT_FOUND);
  if (current.authorId !== user.id) throw forbidden('Solo el autor puede editar este comentario');
  if (current.post.isLocked && !isMod(user)) throw locked('Este post está cerrado: no se pueden editar comentarios');

  const removed = await prisma.$transaction(async (tx) => {
    await tx.comment.update({ where: { id }, data: { body, editedAt: new Date() } });
    if (attachmentIds === undefined) return [];
    return linkAttachments(tx, { ids: attachmentIds, userId: user.id, target: { commentId: id }, replace: true });
  });
  await removeStoredFiles(removed);
  await notifyMentions({ text: body, previousText: current.body, actorId: user.id, postId: current.postId, commentId: id });

  // Devolvemos el nodo con su subárbol completo de respuestas.
  const rows = await prisma.comment.findMany({
    where: { postId: current.postId },
    include: commentInclude(user.id),
    orderBy: { id: 'asc' },
  });
  const reactions = await commentReactionSummaries(
    rows.filter((c) => !c.isDeleted).map((c) => c.id),
    user.id,
  );
  const node = findInTree(buildCommentTree(rows, current.post.acceptedCommentId, 'best', reactions), id);
  res.json({ comment: node });
});

// DELETE /comments/:id  (autor o mod) — soft delete
router.delete('/comments/:id', requireAuth, async (req, res) => {
  const user = authUser(req);
  const id = parseId(req.params.id, COMMENT_NOT_FOUND);
  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, authorId: true, isDeleted: true, postId: true, body: true, post: { select: { title: true, acceptedCommentId: true } } },
  });
  if (!comment) throw notFound(COMMENT_NOT_FOUND);
  const isAuthor = comment.authorId === user.id;
  if (!isAuthor && !isMod(user)) throw forbidden('Solo el autor o un moderador pueden borrar este comentario');
  if (comment.isDeleted) {
    res.status(204).end();
    return;
  }

  const files = await prisma.$transaction(async (tx) => {
    await tx.comment.update({ where: { id }, data: { isDeleted: true } });
    const removedFiles = await deleteAttachmentsWhere(tx, { commentId: id });
    if (comment.post.acceptedCommentId === id) {
      await tx.post.update({ where: { id: comment.postId }, data: { acceptedCommentId: null } });
    }
    await tx.report.updateMany({
      where: { status: 'PENDING', commentId: id },
      data: { status: 'RESOLVED', resolvedById: user.id, resolvedAt: new Date() },
    });
    await refreshCommentCount(tx, comment.postId);
    return removedFiles;
  });
  await removeStoredFiles(files);

  if (!isAuthor && comment.authorId) {
    await notify({
      userId: comment.authorId,
      type: 'MOD',
      postId: comment.postId,
      message: `Un moderador eliminó tu comentario en «${comment.post.title}».`,
    });
  }
  res.status(204).end();
});

const voteSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1), z.literal(0)], { error: 'El voto tiene que ser 1, -1 o 0' }),
});

// POST /comments/:id/vote
router.post('/comments/:id/vote', requireWriter, voteLimiter, async (req, res) => {
  const user = authUser(req);
  const id = parseId(req.params.id, COMMENT_NOT_FOUND);
  const { value } = parse(voteSchema, req.body);
  const comment = await prisma.comment.findUnique({ where: { id }, select: { isDeleted: true } });
  if (!comment || comment.isDeleted) throw notFound(COMMENT_NOT_FOUND);

  const score = await prisma.$transaction(async (tx) => {
    if (value === 0) {
      await tx.commentVote.deleteMany({ where: { userId: user.id, commentId: id } });
    } else {
      await tx.commentVote.upsert({
        where: { userId_commentId: { userId: user.id, commentId: id } },
        create: { userId: user.id, commentId: id, value },
        update: { value },
      });
    }
    return refreshCommentScore(tx, id);
  });
  res.json({ score, myVote: value });
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

// POST /comments/:id/reactions  (toggle)
router.post('/comments/:id/reactions', requireWriter, voteLimiter, async (req, res) => {
  const user = authUser(req);
  const id = parseId(req.params.id, COMMENT_NOT_FOUND);
  const { emoji } = parse(reactionSchema, req.body);
  const comment = await prisma.comment.findUnique({ where: { id }, select: { isDeleted: true, authorId: true, postId: true } });
  if (!comment || comment.isDeleted) throw notFound(COMMENT_NOT_FOUND);

  const where = { userId: user.id, commentId: id, emoji };
  const removed = await prisma.commentReaction.deleteMany({ where });
  let added = false;
  if (removed.count === 0) {
    added = await prisma.commentReaction
      .create({ data: where })
      .then(() => true)
      .catch((err: unknown) => {
        if ((err as { code?: string }).code === 'P2002') return false;
        throw err;
      });
  }
  if (added && comment.authorId && comment.authorId !== user.id) {
    const already = await prisma.notification.findFirst({
      where: { userId: comment.authorId, actorId: user.id, type: 'REACTION', commentId: id },
      select: { id: true },
    });
    if (!already) {
      await notify({ userId: comment.authorId, type: 'REACTION', actorId: user.id, postId: comment.postId, commentId: id, message: emoji });
    }
  }
  const reactions = (await commentReactionSummaries([id], user.id)).get(id) ?? [];
  res.json({ reactions });
});

// GET /comments/:id/reactions/users?emoji=
router.get('/comments/:id/reactions/users', async (req, res) => {
  const id = parseId(req.params.id, COMMENT_NOT_FOUND);
  const raw = req.query.emoji;
  let emoji: string | undefined;
  if (raw !== undefined && raw !== '') {
    const normalized = normalizeEmoji(raw);
    if (!normalized) throw new HttpError(400, 'VALIDATION', 'Esa reacción no está permitida', { emoji: 'Esa reacción no está permitida' });
    emoji = normalized;
  }
  const comment = await prisma.comment.findUnique({ where: { id }, select: { isDeleted: true } });
  if (!comment || comment.isDeleted) throw notFound(COMMENT_NOT_FOUND);
  const rows = await prisma.commentReaction.findMany({
    where: { commentId: id, ...(emoji ? { emoji } : {}) },
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
