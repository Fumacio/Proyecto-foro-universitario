/**
 * Avisos por mail: notificaciones, mensajes directos y bienvenida.
 * Todo es asíncrono (nunca bloquea ni rompe la request) y se serializa por usuario para que el
 * anti-spam sea exacto: máx 1 mail por (usuario, tipo, post/conversación) cada 15 min y 20 por día.
 * Solo se manda si el destinatario tiene la preferencia activa y no tiene una conexión SSE abierta.
 */
import type { NotificationType } from '@prisma/client';
import { env } from '../env.js';
import { renderEmail, type EmailContent } from './emailTemplates.js';
import { sendMail } from './mailer.js';
import { prisma } from './prisma.js';
import type { NotificationRow } from './serializers.js';
import { isOnline } from './sse.js';
import { excerpt } from './text.js';
import type { Preferences } from './types.js';

export const EMAIL_THROTTLE_MS = 15 * 60 * 1000;
export const EMAIL_DAILY_LIMIT = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

type PrefKey = keyof Preferences;

const PREF_BY_TYPE: Partial<Record<NotificationType, PrefKey>> = {
  POST_REPLY: 'emailReplies',
  COMMENT_REPLY: 'emailReplies',
  ANSWER_ACCEPTED: 'emailReplies',
  MENTION: 'emailMentions',
  FOLLOW: 'emailFollows',
  REACTION: 'emailReactions',
};

// ---------- cola por usuario ----------

const pending = new Set<Promise<void>>();
const chains = new Map<number, Promise<void>>();

function enqueue(userId: number, job: () => Promise<void>): void {
  const prev = chains.get(userId) ?? Promise.resolve();
  const next = prev.then(job).catch((err: unknown) => console.error('[mail] no se pudo enviar el aviso', err));
  chains.set(userId, next);
  pending.add(next);
  void next.finally(() => {
    pending.delete(next);
    if (chains.get(userId) === next) chains.delete(userId);
  });
}

/** Espera a que se procesen los mails encolados (tests y apagado ordenado). */
export async function flushEmails(): Promise<void> {
  while (pending.size > 0) await Promise.allSettled([...pending]);
}

/** Anti-spam: si se puede mandar, lo registra y devuelve true. */
async function allowAndLog(userId: number, kind: string, scope: string): Promise<boolean> {
  const now = Date.now();
  const [recentSame, lastDay] = await Promise.all([
    prisma.emailLog.findFirst({
      where: { userId, kind, scope, createdAt: { gt: new Date(now - EMAIL_THROTTLE_MS) } },
      select: { id: true },
    }),
    prisma.emailLog.count({ where: { userId, createdAt: { gt: new Date(now - DAY_MS) } } }),
  ]);
  if (recentSame || lastDay >= EMAIL_DAILY_LIMIT) return false;
  await prisma.emailLog.create({ data: { userId, kind, scope } });
  return true;
}

// ---------- contenido ----------

const url = (p: string) => `${env.FRONTEND_URL}${p}`;
const short = (s: string, max = 60) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

type Person = { username: string; displayName: string | null } | null;

const nameOf = (p: Person) => (p ? (p.displayName ? `${p.displayName} (@${p.username})` : `@${p.username}`) : 'Alguien');
const shortName = (p: Person) => (p ? (p.displayName ?? `@${p.username}`) : 'Alguien');

interface Mail {
  subject: string;
  content: EmailContent;
}

function notificationMail(n: NotificationRow): Mail | null {
  const actor = n.actor;
  const title = n.post ? short(n.post.title, 80) : '';
  const postPath = n.post ? `/p/${n.post.id}` : '/notifications';
  const commentPath = n.post && n.comment ? `/p/${n.post.id}#comment-${n.comment.id}` : postPath;
  const commentText = n.comment && !n.comment.isDeleted ? excerpt(n.comment.body, 500) : '';
  const quote = commentText ? { text: commentText, caption: shortName(actor) } : undefined;

  switch (n.type) {
    case 'POST_REPLY':
      return {
        subject: `${shortName(actor)} comentó tu post «${short(title, 50)}»`,
        content: {
          preheader: commentText || `Nuevo comentario en «${title}»`,
          title: 'Nuevo comentario en tu post',
          paragraphs: [`**${nameOf(actor)}** comentó en tu post **«${title}»**:`],
          quote,
          button: { label: 'Ver el comentario', url: url(commentPath) },
        },
      };
    case 'COMMENT_REPLY':
      return {
        subject: `${shortName(actor)} respondió tu comentario`,
        content: {
          preheader: commentText || `Nueva respuesta en «${title}»`,
          title: 'Respondieron tu comentario',
          paragraphs: [`**${nameOf(actor)}** respondió tu comentario en **«${title}»**:`],
          quote,
          button: { label: 'Ver la respuesta', url: url(commentPath) },
        },
      };
    case 'MENTION':
      return {
        subject: `${shortName(actor)} te mencionó en «${short(title, 50)}»`,
        content: {
          preheader: commentText || `Te mencionaron en «${title}»`,
          title: 'Te mencionaron',
          paragraphs: [`**${nameOf(actor)}** te mencionó en **«${title}»**${quote ? ':' : '.'}`],
          quote,
          button: { label: 'Ver la mención', url: url(commentPath) },
        },
      };
    case 'ANSWER_ACCEPTED':
      return {
        subject: `✅ Tu respuesta fue aceptada en «${short(title, 50)}»`,
        content: {
          preheader: '¡Tu respuesta le sirvió a alguien!',
          title: '¡Aceptaron tu respuesta! ✅',
          paragraphs: [
            `**${nameOf(actor)}** marcó tu respuesta como la solución de **«${title}»**.`,
            'Gracias por ayudar: así el foro es más útil para todos.',
          ],
          quote,
          button: { label: 'Ver la pregunta', url: url(commentPath) },
        },
      };
    case 'FOLLOW':
      if (!actor) return null;
      return {
        subject: `${shortName(actor)} empezó a seguirte`,
        content: {
          preheader: `Ahora @${actor.username} ve tus publicaciones en su feed.`,
          title: 'Tenés un seguidor nuevo',
          paragraphs: [`**${nameOf(actor)}** empezó a seguirte en el Foro UTN. Ahora va a ver tus posts en su feed.`],
          button: { label: 'Ver su perfil', url: url(`/u/${encodeURIComponent(actor.username)}`) },
        },
      };
    case 'REACTION': {
      const emoji = n.message ?? '👍';
      const what = n.comment ? 'tu comentario' : 'tu post';
      return {
        subject: `${shortName(actor)} reaccionó con ${emoji} a ${what}`,
        content: {
          preheader: `${emoji} en «${title}»`,
          title: `Reaccionaron a ${what} ${emoji}`,
          paragraphs: [`**${nameOf(actor)}** reaccionó con ${emoji} a ${what} en **«${title}»**.`],
          quote,
          button: { label: n.comment ? 'Ver el comentario' : 'Ver el post', url: url(commentPath) },
        },
      };
    }
    default:
      return null;
  }
}

// ---------- API ----------

/** Llamado al crear una notificación. */
export function queueNotificationEmail(n: NotificationRow): void {
  const pref = PREF_BY_TYPE[n.type];
  if (!pref || isOnline(n.userId)) return;
  enqueue(n.userId, async () => {
    const user = await prisma.user.findUnique({
      where: { id: n.userId },
      select: { email: true, emailReplies: true, emailMentions: true, emailMessages: true, emailFollows: true, emailReactions: true },
    });
    if (!user?.[pref]) return;
    const mail = notificationMail(n);
    if (!mail) return;
    if (!(await allowAndLog(n.userId, n.type, n.post ? `post:${n.post.id}` : ''))) return;
    const { html, text } = renderEmail(mail.content);
    await sendMail({ to: user.email, subject: mail.subject, html, text, link: mail.content.button.url });
  });
}

/** Llamado al recibir un mensaje directo. */
export function queueMessageEmail(opts: {
  recipientId: number;
  conversationId: number;
  sender: { username: string; displayName: string | null };
  body: string;
  attachmentNames: string[];
}): void {
  if (isOnline(opts.recipientId)) return;
  enqueue(opts.recipientId, async () => {
    const user = await prisma.user.findUnique({ where: { id: opts.recipientId }, select: { email: true, emailMessages: true } });
    if (!user?.emailMessages) return;
    if (!(await allowAndLog(opts.recipientId, 'MESSAGE', `conv:${opts.conversationId}`))) return;
    const files = opts.attachmentNames.length;
    const body = opts.body.trim();
    const quoteText = [
      body ? short(body, 600) : '',
      files ? `📎 ${files === 1 ? opts.attachmentNames[0] : `${files} archivos adjuntos`}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const link = url(`/messages/${opts.conversationId}`);
    const { html, text } = renderEmail({
      preheader: body ? short(body, 120) : 'Te mandaron un archivo',
      title: 'Tenés un mensaje nuevo',
      paragraphs: [`**${nameOf(opts.sender)}** te escribió por mensaje privado:`],
      quote: quoteText ? { text: quoteText, caption: shortName(opts.sender) } : undefined,
      button: { label: 'Responder', url: link },
    });
    await sendMail({ to: user.email, subject: `Nuevo mensaje de ${shortName(opts.sender)}`, html, text, link });
  });
}

/** Mail de bienvenida (registro con contraseña o con Google). */
export function queueWelcomeEmail(user: { id: number; email: string; username: string; displayName: string | null }): void {
  enqueue(user.id, async () => {
    const link = url('/c');
    const { html, text } = renderEmail({
      preheader: 'Tu cuenta está lista: sumate a las comunidades de tus materias.',
      title: `¡Bienvenida/o al Foro UTN, ${user.displayName ?? `@${user.username}`}! 🎉`,
      paragraphs: [
        `Tu cuenta **@${user.username}** ya está lista. Estas son algunas cosas para arrancar:`,
        '• **Unite a las comunidades** de tus materias para ver sus novedades en tu feed.',
        '• **Preguntá sin miedo**: cuando una respuesta te sirva, marcala como aceptada.',
        '• **Compartí apuntes**: podés adjuntar PDF, Word, Excel, presentaciones, imágenes y código.',
        '• **Reaccioná** con emojis y guardá los posts que quieras leer después.',
      ],
      button: { label: 'Explorar comunidades', url: link },
      note: 'Antes de postear, date una vuelta por las reglas de cada comunidad. ¡Nos vemos en el foro!',
    });
    await sendMail({ to: user.email, subject: '¡Bienvenida/o al Foro UTN! 🎓', html, text, link });
  });
}
