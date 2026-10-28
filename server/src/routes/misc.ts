import { Router } from 'express';
import { z } from 'zod';
import { serializePosts } from '../lib/posts.js';
import { prisma } from '../lib/prisma.js';
import { communityRefSelect, postInclude, toCommunityRef, toUserSummary, userSummarySelect } from '../lib/serializers.js';
import { imageUpload, saveImage } from '../lib/upload.js';
import { parse } from '../lib/validate.js';
import { requireWriter } from '../middleware/auth.js';
import { actionLimiter } from '../middleware/rateLimit.js';

/** Uploads, búsqueda global y estadísticas públicas. */
const router = Router();

router.post('/uploads/image', requireWriter, actionLimiter, imageUpload, async (req, res) => {
  res.status(201).json({ url: await saveImage(req.file) });
});

const searchSchema = z.object({
  q: z
    .string({ error: 'Escribí al menos 2 caracteres' })
    .trim()
    .min(2, 'Escribí al menos 2 caracteres')
    .max(100, 'La búsqueda puede tener hasta 100 caracteres'),
});

router.get('/search', async (req, res) => {
  const { q } = parse(searchSchema, req.query);
  const [posts, users, communities] = await Promise.all([
    prisma.post.findMany({
      where: { OR: [{ title: { contains: q } }, { body: { contains: q } }] },
      orderBy: [{ hot: 'desc' }, { id: 'desc' }],
      take: 40,
      include: postInclude(req.user?.id ?? null),
    }),
    prisma.user.findMany({
      where: { OR: [{ usernameKey: { contains: q.toLowerCase() } }, { displayName: { contains: q } }] },
      orderBy: { username: 'asc' },
      take: 6,
      select: userSummarySelect,
    }),
    prisma.community.findMany({
      where: { OR: [{ name: { contains: q } }, { slug: { contains: q.toLowerCase() } }, { description: { contains: q } }] },
      orderBy: { memberships: { _count: 'desc' } },
      take: 5,
      select: communityRefSelect,
    }),
  ]);
  // Primero los que coinciden en el título.
  const needle = q.toLowerCase();
  const ranked = [...posts].sort(
    (a, b) => Number(b.title.toLowerCase().includes(needle)) - Number(a.title.toLowerCase().includes(needle)),
  );
  res.json({
    posts: await serializePosts(ranked.slice(0, 8), req.user?.id ?? null),
    users: users.map(toUserSummary),
    communities: communities.map(toCommunityRef),
  });
});

router.get('/stats', async (_req, res) => {
  const [users, posts, comments, communities] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.comment.count({ where: { isDeleted: false } }),
    prisma.community.count(),
  ]);
  res.json({ users, posts, comments, communities });
});

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default router;
