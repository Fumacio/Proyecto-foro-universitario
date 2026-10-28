import type { NotificationType } from '@prisma/client';
import { queueNotificationEmail } from './emailNotify.js';
import { prisma } from './prisma.js';
import { notificationInclude, toNotification } from './serializers.js';
import { sendEvent } from './sse.js';
import { extractMentions } from './text.js';
import { emitUnread } from './unread.js';

export interface NotifyInput {
  userId: number;
  type: NotificationType;
  actorId?: number | null;
  postId?: number | null;
  commentId?: number | null;
  message?: string | null;
}

/**
 * Crea la notificación y la empuja por SSE (o, si el destinatario no está conectado y lo tiene
 * activado, encola un mail). Nunca notifica a uno mismo.
 * Es "best effort": un error acá no tira abajo la request que la originó.
 */
export async function notify(input: NotifyInput): Promise<void> {
  if (input.actorId != null && input.actorId === input.userId) return;
  try {
    const n = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        actorId: input.actorId ?? null,
        postId: input.postId ?? null,
        commentId: input.commentId ?? null,
        message: input.message ?? null,
      },
      include: notificationInclude,
    });
    sendEvent(input.userId, 'notification', toNotification(n));
    queueNotificationEmail(n);
    await emitUnread(input.userId);
  } catch (err) {
    console.error('[notify] no se pudo crear la notificación', err);
  }
}

/**
 * Notifica las menciones `@usuario` de un texto (máx 10).
 * `skipUserIds`: usuarios que ya reciben otra notificación por el mismo contenido.
 * `previousText`: al editar, solo se notifican las menciones nuevas.
 */
export async function notifyMentions(opts: {
  text: string;
  previousText?: string;
  actorId: number;
  postId: number;
  commentId?: number | null;
  skipUserIds?: number[];
}): Promise<void> {
  let names = extractMentions(opts.text);
  if (opts.previousText) {
    const before = new Set(extractMentions(opts.previousText, 50));
    names = names.filter((n) => !before.has(n));
  }
  if (names.length === 0) return;
  const users = await prisma.user.findMany({ where: { usernameKey: { in: names } }, select: { id: true } });
  const skip = new Set([opts.actorId, ...(opts.skipUserIds ?? [])]);
  for (const u of users) {
    if (skip.has(u.id)) continue;
    skip.add(u.id);
    await notify({ userId: u.id, type: 'MENTION', actorId: opts.actorId, postId: opts.postId, commentId: opts.commentId ?? null });
  }
}
