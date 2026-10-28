import { prisma } from './prisma.js';
import { isOnline, sendEvent } from './sse.js';

export function countUnreadNotifications(userId: number): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}

/** Mensajes no leídos por conversación (de otros, posteriores a mi lastReadAt). */
export async function unreadByConversation(userId: number): Promise<Map<number, number>> {
  const parts = await prisma.conversationParticipant.findMany({
    where: { userId },
    select: { conversationId: true, lastReadAt: true },
  });
  const result = new Map<number, number>();
  if (parts.length === 0) return result;
  const groups = await prisma.message.groupBy({
    by: ['conversationId'],
    where: {
      senderId: { not: userId },
      OR: parts.map((p) => ({ conversationId: p.conversationId, createdAt: { gt: p.lastReadAt } })),
    },
    _count: { _all: true },
  });
  for (const g of groups) result.set(g.conversationId, g._count._all);
  return result;
}

export async function countUnreadMessages(userId: number): Promise<number> {
  let total = 0;
  for (const n of (await unreadByConversation(userId)).values()) total += n;
  return total;
}

/** Envía `event: unread` al usuario si tiene pestañas conectadas. */
export async function emitUnread(userId: number): Promise<void> {
  if (!isOnline(userId)) return;
  try {
    const [notifications, messages] = await Promise.all([countUnreadNotifications(userId), countUnreadMessages(userId)]);
    sendEvent(userId, 'unread', { notifications, messages });
  } catch (err) {
    console.error('[sse] no se pudo emitir unread', err);
  }
}
