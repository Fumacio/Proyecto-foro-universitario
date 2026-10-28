import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { attachmentIdsSchema, linkAttachments, MAX_ATTACHMENTS } from '../lib/attachments.js';
import { queueMessageEmail } from '../lib/emailNotify.js';
import { HttpError, notFound } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { iso, messageInclude, toMessage, toUserSummary, userSummarySelect } from '../lib/serializers.js';
import { sendEvent } from '../lib/sse.js';
import type { ConversationDto } from '../lib/types.js';
import { countUnreadMessages, emitUnread, unreadByConversation } from '../lib/unread.js';
import { findUserByUsername } from '../lib/users.js';
import { idSchema, limitSchema, parse, parseId } from '../lib/validate.js';
import { authUser, requireAuth, requireWriter } from '../middleware/auth.js';
import { messageLimiter } from '../middleware/rateLimit.js';

const router = Router();
router.use(requireAuth);

const NOT_FOUND = 'Esa conversación no existe';

function conversationInclude(meId: number) {
  return {
    participants: { where: { userId: { not: meId } }, include: { user: { select: userSummarySelect } } },
    messages: {
      orderBy: { id: 'desc' },
      take: 1,
      include: { attachments: { orderBy: { id: 'asc' }, take: 1, select: { filename: true } }, _count: { select: { attachments: true } } },
    },
  } satisfies Prisma.ConversationInclude;
}

type ConversationRow = Prisma.ConversationGetPayload<{ include: ReturnType<typeof conversationInclude> }>;

function toConversation(c: ConversationRow, unread: number): ConversationDto | null {
  const other = c.participants[0]?.user;
  if (!other) return null;
  const last = c.messages[0];
  return {
    id: c.id,
    other: toUserSummary(other),
    lastMessage: last ? { body: previewBody(last), createdAt: iso(last.createdAt), senderId: last.senderId } : null,
    unread,
    updatedAt: iso(c.updatedAt),
  };
}

/** Mensaje solo con adjuntos: la vista previa muestra el archivo. */
function previewBody(m: ConversationRow['messages'][number]): string {
  if (m.body) return m.body;
  const first = m.attachments[0];
  if (!first) return '';
  const more = m._count.attachments - 1;
  return `📎 ${first.filename}${more > 0 ? ` (+${more})` : ''}`;
}

async function participantOr404(conversationId: number, userId: number) {
  const part = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!part) throw notFound(NOT_FOUND);
  return part;
}

router.get('/', async (req, res) => {
  const me = authUser(req);
  const [rows, unread] = await Promise.all([
    prisma.conversation.findMany({
      where: {
        participants: { some: { userId: me.id } },
        // Las conversaciones vacías solo las ve quien las abrió.
        OR: [{ messages: { some: {} } }, { createdById: me.id }],
      },
      include: conversationInclude(me.id),
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    }),
    unreadByConversation(me.id),
  ]);
  const items = rows.map((c) => toConversation(c, unread.get(c.id) ?? 0)).filter((c): c is ConversationDto => c !== null);
  res.json({ items });
});

router.post('/', requireWriter, async (req, res) => {
  const me = authUser(req);
  const { username } = parse(
    z.object({ username: z.string({ error: 'Indicá con quién querés hablar' }).trim().min(1, 'Indicá con quién querés hablar').max(40) }),
    req.body,
  );
  const target = await findUserByUsername(username.replace(/^@/, ''));
  if (!target) throw notFound('Ese usuario no existe');
  if (target.id === me.id) throw new HttpError(400, 'VALIDATION', 'No podés mandarte mensajes a vos mismo', { username: 'Elegí a otra persona' });

  const key = `${Math.min(me.id, target.id)}:${Math.max(me.id, target.id)}`;
  let conversation = await prisma.conversation.findUnique({ where: { key }, include: conversationInclude(me.id) });
  if (!conversation) {
    try {
      conversation = await prisma.conversation.create({
        data: {
          key,
          createdById: me.id,
          participants: { create: [{ userId: me.id }, { userId: target.id }] },
        },
        include: conversationInclude(me.id),
      });
    } catch (err) {
      // Carrera: la otra persona la creó al mismo tiempo.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err;
      conversation = await prisma.conversation.findUniqueOrThrow({ where: { key }, include: conversationInclude(me.id) });
    }
  }
  const unread = (await unreadByConversation(me.id)).get(conversation.id) ?? 0;
  res.json({ conversation: toConversation(conversation, unread) });
});

router.get('/:id/messages', async (req, res) => {
  const me = authUser(req);
  const id = parseId(req.params.id, NOT_FOUND);
  await participantOr404(id, me.id);
  const { before, limit } = parse(z.object({ before: idSchema.optional(), limit: limitSchema(30, 100) }), req.query);
  const rows = await prisma.message.findMany({
    where: { conversationId: id, ...(before ? { id: { lt: before } } : {}) },
    orderBy: { id: 'desc' },
    take: limit + 1,
    include: messageInclude,
  });
  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows).reverse().map(toMessage);
  res.json({ items, hasMore });
});

router.post('/:id/messages', requireWriter, messageLimiter, async (req, res) => {
  const me = authUser(req);
  const id = parseId(req.params.id, NOT_FOUND);
  await participantOr404(id, me.id);
  const { body, attachmentIds } = parse(
    z
      .object({
        body: z
          .string({ error: 'Escribí un mensaje' })
          .trim()
          .max(4000, 'El mensaje puede tener como máximo 4000 caracteres')
          .optional()
          .default(''),
        attachmentIds: attachmentIdsSchema(MAX_ATTACHMENTS.message).optional().default([]),
      })
      .refine((d) => d.body.length > 0 || d.attachmentIds.length > 0, { path: ['body'], message: 'El mensaje no puede estar vacío' }),
    req.body,
  );

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({ data: { conversationId: id, senderId: me.id, body }, select: { id: true, createdAt: true } });
    if (attachmentIds.length > 0) await linkAttachments(tx, { ids: attachmentIds, userId: me.id, target: { messageId: created.id } });
    await tx.conversation.update({ where: { id }, data: { updatedAt: created.createdAt } });
    await tx.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: id, userId: me.id } },
      data: { lastReadAt: created.createdAt },
    });
    return tx.message.findUniqueOrThrow({ where: { id: created.id }, include: messageInclude });
  });

  const dto = toMessage(message);
  const participants = await prisma.conversationParticipant.findMany({ where: { conversationId: id }, select: { userId: true } });
  for (const p of participants) {
    sendEvent(p.userId, 'message', dto);
    if (p.userId !== me.id) {
      queueMessageEmail({
        recipientId: p.userId,
        conversationId: id,
        sender: { username: me.username, displayName: me.displayName },
        body,
        attachmentNames: dto.attachments.map((a) => a.filename),
      });
    }
    await emitUnread(p.userId);
  }
  res.status(201).json({ message: dto });
});

router.post('/:id/read', async (req, res) => {
  const me = authUser(req);
  const id = parseId(req.params.id, NOT_FOUND);
  await participantOr404(id, me.id);
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId: id, userId: me.id } },
    data: { lastReadAt: new Date() },
  });
  const unreadMessages = await countUnreadMessages(me.id);
  await emitUnread(me.id);
  res.json({ unreadMessages });
});

export default router;
