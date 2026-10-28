import { Router } from 'express';
import { z } from 'zod';
import { LOOSE, removeStoredFiles, storedNamesWhere } from '../lib/attachments.js';
import { clearAuthCookie, verifyPassword } from '../lib/auth.js';
import { HttpError, notFound } from '../lib/errors.js';
import { notify } from '../lib/notify.js';
import { listPosts, postOrderBy, refreshCommentScore, refreshPostScore, serializePosts } from '../lib/posts.js';
import { prisma } from '../lib/prisma.js';
import { commentReactionSummaries } from '../lib/reactions.js';
import {
  commentWithPostInclude,
  iso,
  postInclude,
  toCommentWithPost,
  toUserSummary,
  userSummarySelect,
} from '../lib/serializers.js';
import type { UserProfile } from '../lib/types.js';
import { deleteUpload, imageUpload, saveImage } from '../lib/upload.js';
import { buildMe, findUserByUsername, getActiveBan, getKarma, toPreferences } from '../lib/users.js';
import { limitSchema, nullableText, pageSchema, paginate, paginationSchema, parse } from '../lib/validate.js';
import { authUser, requireAuth, requireWriter } from '../middleware/auth.js';
import { actionLimiter } from '../middleware/rateLimit.js';

const router = Router();
const USER_NOT_FOUND = 'Ese usuario no existe';

async function userOr404(username: string) {
  const user = await findUserByUsername(username);
  if (!user) throw notFound(USER_NOT_FOUND);
  return user;
}

// ---------- /users/me ----------

const updateMeSchema = z.object({
  displayName: nullableText(40),
  bio: nullableText(500),
  career: nullableText(100),
});

router.patch('/me', requireWriter, async (req, res) => {
  const user = authUser(req);
  const data = parse(updateMeSchema, req.body);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
      ...(data.bio !== undefined ? { bio: data.bio } : {}),
      ...(data.career !== undefined ? { career: data.career } : {}),
    },
  });
  res.json({ user: await buildMe(updated) });
});

router.post('/me/avatar', requireWriter, actionLimiter, imageUpload, async (req, res) => {
  const user = authUser(req);
  const url = await saveImage(req.file);
  const updated = await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: url } });
  if (user.avatarUrl && user.avatarUrl !== url) await deleteUpload(user.avatarUrl);
  res.json({ user: await buildMe(updated) });
});

router.delete('/me/avatar', requireAuth, async (req, res) => {
  const user = authUser(req);
  const updated = await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: null } });
  await deleteUpload(user.avatarUrl);
  res.json({ user: await buildMe(updated) });
});

// ---------- preferencias ----------

router.get('/me/preferences', requireAuth, (req, res) => {
  res.json({ preferences: toPreferences(authUser(req)) });
});

const preferencesSchema = z.object({
  emailReplies: z.boolean().optional(),
  emailMentions: z.boolean().optional(),
  emailMessages: z.boolean().optional(),
  emailFollows: z.boolean().optional(),
  emailReactions: z.boolean().optional(),
});

router.patch('/me/preferences', requireAuth, async (req, res) => {
  const user = authUser(req);
  const data = parse(preferencesSchema, req.body);
  const changes = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  const updated = Object.keys(changes).length > 0 ? await prisma.user.update({ where: { id: user.id }, data: changes }) : user;
  res.json({ preferences: toPreferences(updated) });
});

// ---------- borrar la cuenta ----------

const deleteMeSchema = z.object({
  password: z.string().max(200).optional(),
  confirmUsername: z.string().trim().max(40).optional(),
});

router.delete('/me', requireAuth, async (req, res) => {
  const user = authUser(req);
  const { password, confirmUsername } = parse(deleteMeSchema, req.body);
  if (user.passwordHash !== null) {
    if (!password) throw new HttpError(400, 'VALIDATION', 'Ingresá tu contraseña', { password: 'Ingresá tu contraseña' });
    if (!(await verifyPassword(password, user.passwordHash))) {
      throw new HttpError(400, 'VALIDATION', 'La contraseña es incorrecta', { password: 'La contraseña es incorrecta' });
    }
  } else if (!confirmUsername || confirmUsername.replace(/^@/, '').toLowerCase() !== user.usernameKey) {
    // Cuenta creada con Google sin contraseña: se confirma escribiendo el nombre de usuario.
    throw new HttpError(400, 'VALIDATION', 'Escribí tu nombre de usuario para confirmar', {
      confirmUsername: 'Escribí tu nombre de usuario para confirmar',
    });
  }
  const [postVotes, commentVotes] = await Promise.all([
    prisma.postVote.findMany({ where: { userId: user.id }, select: { postId: true } }),
    prisma.commentVote.findMany({ where: { userId: user.id }, select: { commentId: true } }),
  ]);
  // Adjuntos que se van con la cuenta: DMs, borradores y los sueltos. Los de posts/comentarios quedan.
  const files = await storedNamesWhere({
    OR: [
      { message: { conversation: { participants: { some: { userId: user.id } } } } },
      { draft: { userId: user.id } },
      { uploaderId: user.id, ...LOOSE },
    ],
  });
  await prisma.$transaction(async (tx) => {
    await tx.attachment.deleteMany({ where: { uploaderId: user.id, ...LOOSE } });
    // Los DMs no tienen sentido sin la otra persona: se borran las conversaciones.
    await tx.conversation.deleteMany({ where: { participants: { some: { userId: user.id } } } });
    // Posts y comentarios quedan con author null (onDelete: SetNull); votos, membresías, etc. en cascada.
    await tx.user.delete({ where: { id: user.id } });
    for (const { postId } of postVotes) await refreshPostScore(tx, postId);
    for (const { commentId } of commentVotes) await refreshCommentScore(tx, commentId);
  });
  await deleteUpload(user.avatarUrl);
  await removeStoredFiles(files);
  clearAuthCookie(res);
  res.status(204).end();
});

router.get('/me/bookmarks', requireAuth, async (req, res) => {
  const user = authUser(req);
  const { page, limit } = parse(paginationSchema, req.query);
  const where = { userId: user.id };
  const [rows, total] = await Promise.all([
    prisma.bookmark.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { postId: 'desc' }],
      skip: (page - 1) * limit,
      take: limit + 1,
      include: { post: { include: postInclude(user.id) } },
    }),
    prisma.bookmark.count({ where }),
  ]);
  res.json(paginate(await serializePosts(rows.map((b) => b.post), user.id), page, limit, total));
});

// ---------- /users/:username ----------

router.get('/:username', async (req, res) => {
  const user = await userOr404(String(req.params.username));
  const viewerId = req.user?.id ?? null;
  const [karma, postCount, commentCount, followerCount, followingCount, follow, ban] = await Promise.all([
    getKarma(user.id),
    prisma.post.count({ where: { authorId: user.id } }),
    prisma.comment.count({ where: { authorId: user.id, isDeleted: false } }),
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    viewerId && viewerId !== user.id
      ? prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: user.id } } })
      : null,
    getActiveBan(user.id),
  ]);
  const profile: UserProfile = {
    ...toUserSummary(user),
    bio: user.bio,
    career: user.career,
    createdAt: iso(user.createdAt),
    karma,
    postCount,
    commentCount,
    followerCount,
    followingCount,
    isFollowing: !!follow,
    isBanned: !!ban,
  };
  res.json({ user: profile });
});

router.get('/:username/posts', async (req, res) => {
  const user = await userOr404(String(req.params.username));
  const { page, limit, sort } = parse(
    z.object({ page: pageSchema, limit: limitSchema(), sort: z.enum(['new', 'top']).default('new') }),
    req.query,
  );
  res.json(
    await listPosts({
      where: { authorId: user.id },
      orderBy: postOrderBy(sort),
      page,
      limit,
      viewerId: req.user?.id ?? null,
    }),
  );
});

router.get('/:username/comments', async (req, res) => {
  const user = await userOr404(String(req.params.username));
  const { page, limit } = parse(paginationSchema, req.query);
  const where = { authorId: user.id, isDeleted: false };
  const viewerId = req.user?.id ?? null;
  const [rows, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit + 1,
      include: commentWithPostInclude(viewerId),
    }),
    prisma.comment.count({ where }),
  ]);
  const reactions = await commentReactionSummaries(
    rows.map((c) => c.id),
    viewerId,
  );
  res.json(paginate(rows.map((c) => toCommentWithPost(c, reactions.get(c.id))), page, limit, total));
});

async function followList(username: string, query: unknown, direction: 'followers' | 'following') {
  const user = await userOr404(username);
  const { page, limit } = parse(paginationSchema, query);
  const where = direction === 'followers' ? { followingId: user.id } : { followerId: user.id };
  const [rows, total] = await Promise.all([
    prisma.follow.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit + 1,
      include: { follower: { select: userSummarySelect }, following: { select: userSummarySelect } },
    }),
    prisma.follow.count({ where }),
  ]);
  const users = rows.map((f) => toUserSummary(direction === 'followers' ? f.follower : f.following));
  return paginate(users, page, limit, total);
}

router.get('/:username/followers', async (req, res) => {
  res.json(await followList(req.params.username, req.query, 'followers'));
});

router.get('/:username/following', async (req, res) => {
  res.json(await followList(req.params.username, req.query, 'following'));
});

router.post('/:username/follow', requireWriter, actionLimiter, async (req, res) => {
  const me = authUser(req);
  const target = await userOr404(String(req.params.username));
  if (target.id === me.id) throw new HttpError(400, 'VALIDATION', 'No podés seguirte a vos mismo', {});
  const key = { followerId_followingId: { followerId: me.id, followingId: target.id } };
  const existing = await prisma.follow.findUnique({ where: key });
  if (!existing) {
    await prisma.follow.create({ data: { followerId: me.id, followingId: target.id } });
    const alreadyNotified = await prisma.notification.findFirst({
      where: { userId: target.id, actorId: me.id, type: 'FOLLOW', read: false },
      select: { id: true },
    });
    if (!alreadyNotified) await notify({ userId: target.id, type: 'FOLLOW', actorId: me.id });
  }
  const followerCount = await prisma.follow.count({ where: { followingId: target.id } });
  res.json({ isFollowing: true, followerCount });
});

router.delete('/:username/follow', requireAuth, async (req, res) => {
  const me = authUser(req);
  const target = await userOr404(String(req.params.username));
  await prisma.follow.deleteMany({ where: { followerId: me.id, followingId: target.id } });
  const followerCount = await prisma.follow.count({ where: { followingId: target.id } });
  res.json({ isFollowing: false, followerCount });
});

export default router;
