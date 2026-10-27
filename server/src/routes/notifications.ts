import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { notificationInclude, toNotification } from '../lib/serializers.js';
import { countUnreadNotifications, emitUnread } from '../lib/unread.js';
import { boolQuery, idSchema, limitSchema, pageSchema, paginate, parse } from '../lib/validate.js';
import { authUser, requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const user = authUser(req);
  const { page, limit, unread } = parse(z.object({ page: pageSchema, limit: limitSchema(), unread: boolQuery }), req.query);
  const where = { userId: user.id, ...(unread ? { read: false } : {}) };
  const [rows, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit + 1,
      include: notificationInclude,
    }),
    prisma.notification.count({ where }),
    countUnreadNotifications(user.id),
  ]);
  res.json({ ...paginate(rows.map(toNotification), page, limit, total), unreadCount });
});

router.post('/read', async (req, res) => {
  const user = authUser(req);
  const { ids } = parse(z.object({ ids: z.array(idSchema).max(500).optional() }), req.body);
  await prisma.notification.updateMany({
    where: { userId: user.id, read: false, ...(ids ? { id: { in: ids } } : {}) },
    data: { read: true },
  });
  const unreadCount = await countUnreadNotifications(user.id);
  await emitUnread(user.id);
  res.json({ unreadCount });
});

export default router;
