import type { Response } from 'express';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { flushEmails } from '../src/lib/emailNotify.js';
import { setMailTransport, testOutbox, type MailMessage } from '../src/lib/mailer.js';
import { addClient } from '../src/lib/sse.js';
import { anon, createCommunity, prisma, resetDb, userAndAgent, type Agent } from './helpers.js';

let author: Agent;
let replier: Agent;
let authorId: number;
let communityId: number;

beforeAll(async () => {
  await resetDb();
  let u;
  ({ user: u, agent: author } = await userAndAgent({ username: 'autor_mail' }));
  authorId = u.id;
  ({ agent: replier } = await userAndAgent({ username: 'responde_mail' }));
  communityId = (await createCommunity('mails')).id;
});

afterEach(() => setMailTransport(null));

/** Ejecuta `fn` y devuelve los mails que se habrían enviado. */
async function mailsDuring(fn: () => Promise<unknown>): Promise<MailMessage[]> {
  await flushEmails();
  const start = testOutbox.length;
  await fn();
  await flushEmails();
  return testOutbox.slice(start);
}

/** Simula una pestaña abierta (conexión SSE) del usuario. */
function goOnline(userId: number): () => void {
  const fake = { write: () => true, writableEnded: false, end: () => undefined } as unknown as Response;
  return addClient(userId, fake);
}

const newPost = async (title = 'Post para mails') =>
  (await author.post('/api/posts').send({ communityId, type: 'TEXT', title, body: 'Hola' })).body.post.id as number;

describe('preferencias', () => {
  it('defaults, PATCH parcial y Me.preferences', async () => {
    const { agent } = await userAndAgent({ username: 'prefs_user' });
    const defaults = { emailReplies: true, emailMentions: true, emailMessages: true, emailFollows: false, emailReactions: false };
    expect((await agent.get('/api/users/me/preferences')).body).toEqual({ preferences: defaults });
    const me = (await agent.get('/api/auth/me')).body.user;
    expect(me).toMatchObject({ preferences: defaults, hasPassword: true, googleLinked: false, draftCount: 0 });

    const patched = await agent.patch('/api/users/me/preferences').send({ emailFollows: true, emailReplies: false });
    expect(patched.body).toEqual({ preferences: { ...defaults, emailFollows: true, emailReplies: false } });
    expect((await agent.get('/api/auth/me')).body.user.preferences.emailFollows).toBe(true);
    expect((await agent.patch('/api/users/me/preferences').send({ emailFollows: 'si' })).status).toBe(400);
    expect((await agent.patch('/api/users/me/preferences').send({})).body.preferences.emailFollows).toBe(true);
    expect((await anon().get('/api/users/me/preferences')).status).toBe(401);
  });
});

describe('avisos por mail', () => {
  it('respuesta a un post con el destinatario desconectado → mail HTML + texto con link exacto', async () => {
    const postId = await newPost('Duda de límites');
    let commentId = 0;
    const mails = await mailsDuring(async () => {
      commentId = (await replier.post(`/api/posts/${postId}/comments`).send({ body: 'Usá el límite notable sen(x)/x' })).body.comment.id;
    });
    expect(mails).toHaveLength(1);
    const [mail] = mails;
    const link = `http://localhost:5173/p/${postId}#comment-${commentId}`;
    expect(mail).toMatchObject({ to: 'autor_mail@test.utn', link });
    expect(mail!.subject).toMatch(/comentó tu post «Duda de límites»/);
    expect(mail!.html).toContain(`href="${link}"`);
    expect(mail!.html).toContain('Foro UTN');
    expect(mail!.html).toContain('#6d5dfc');
    expect(mail!.html).toContain('http://localhost:5173/settings?tab=notifications');
    expect(mail!.html).toContain('Usá el límite notable sen(x)/x');
    expect(mail!.text).toContain(link);
    expect(mail!.text).toContain('http://localhost:5173/settings?tab=notifications');
  });

  it('no manda mail si el destinatario está conectado (SSE abierto)', async () => {
    const postId = await newPost('Estoy online');
    const offline = goOnline(authorId);
    try {
      const mails = await mailsDuring(() => replier.post(`/api/posts/${postId}/comments`).send({ body: 'te respondo' }));
      expect(mails).toHaveLength(0);
      // la notificación sí se crea
      expect(await prisma.notification.count({ where: { userId: authorId, postId, type: 'POST_REPLY' } })).toBe(1);
    } finally {
      offline();
    }
  });

  it('respeta la preferencia desactivada', async () => {
    await author.patch('/api/users/me/preferences').send({ emailReplies: false });
    const postId = await newPost('Sin mails');
    const mails = await mailsDuring(() => replier.post(`/api/posts/${postId}/comments`).send({ body: 'no te llega' }));
    expect(mails).toHaveLength(0);
    await author.patch('/api/users/me/preferences').send({ emailReplies: true });
  });

  it('anti-spam: 1 por (usuario, tipo, post) cada 15 min y máx 20 por día', async () => {
    const postId = await newPost('Hilo movido');
    const first = await mailsDuring(() => replier.post(`/api/posts/${postId}/comments`).send({ body: 'uno' }));
    expect(first).toHaveLength(1);
    const second = await mailsDuring(() => replier.post(`/api/posts/${postId}/comments`).send({ body: 'dos' }));
    expect(second).toHaveLength(0);
    // otro post: sí
    const otherPost = await newPost('Otro hilo');
    expect(await mailsDuring(() => replier.post(`/api/posts/${otherPost}/comments`).send({ body: 'tres' }))).toHaveLength(1);
    // pasados 15 min vuelve a mandar
    await prisma.emailLog.updateMany({ where: { userId: authorId }, data: { createdAt: new Date(Date.now() - 16 * 60 * 1000) } });
    expect(await mailsDuring(() => replier.post(`/api/posts/${postId}/comments`).send({ body: 'cuatro' }))).toHaveLength(1);

    // tope diario
    await prisma.emailLog.createMany({ data: Array.from({ length: 20 }, () => ({ userId: authorId, kind: 'MENTION', scope: 'x' })) });
    const capped = await newPost('Tope diario');
    expect(await mailsDuring(() => replier.post(`/api/posts/${capped}/comments`).send({ body: 'cinco' }))).toHaveLength(0);
    await prisma.emailLog.deleteMany({ where: { userId: authorId } });
  });

  it('menciones, seguidores (opt-in) y reacciones (opt-in)', async () => {
    const { user: target, agent: targetAgent } = await userAndAgent({ username: 'mencionada' });
    const postId = await newPost('Para mencionar');
    const mention = await mailsDuring(() => replier.post(`/api/posts/${postId}/comments`).send({ body: 'Mirá esto @mencionada' }));
    expect(mention.map((m) => m.to)).toContain('mencionada@test.utn');
    expect(mention.find((m) => m.to === 'mencionada@test.utn')!.subject).toMatch(/te mencionó/);

    expect(await mailsDuring(() => replier.post('/api/users/mencionada/follow'))).toHaveLength(0);
    await targetAgent.patch('/api/users/me/preferences').send({ emailFollows: true, emailReactions: true });
    await replier.delete('/api/users/mencionada/follow');
    await prisma.notification.deleteMany({ where: { userId: target.id, type: 'FOLLOW' } });
    const follow = await mailsDuring(() => replier.post('/api/users/mencionada/follow'));
    expect(follow).toHaveLength(1);
    expect(follow[0]!.link).toBe('http://localhost:5173/u/responde_mail');

    const ownPost = (await targetAgent.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Mi post', body: 'x' })).body.post.id;
    const reaction = await mailsDuring(() => replier.post(`/api/posts/${ownPost}/reactions`).send({ emoji: '🔥' }));
    expect(reaction).toHaveLength(1);
    expect(reaction[0]!.subject).toMatch(/reaccionó con 🔥 a tu post/);
    expect(reaction[0]!.link).toBe(`http://localhost:5173/p/${ownPost}`);
  });

  it('mensajes directos: mail al destinatario desconectado con link a la conversación', async () => {
    const conv = (await replier.post('/api/conversations').send({ username: 'autor_mail' })).body.conversation;
    const mails = await mailsDuring(() => replier.post(`/api/conversations/${conv.id}/messages`).send({ body: '¿Vas al grupo de estudio?' }));
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ to: 'autor_mail@test.utn', link: `http://localhost:5173/messages/${conv.id}` });
    expect(mails[0]!.subject).toBe('Nuevo mensaje de @responde_mail');
    expect(mails[0]!.text).toContain('¿Vas al grupo de estudio?');
    // throttle por conversación
    expect(await mailsDuring(() => replier.post(`/api/conversations/${conv.id}/messages`).send({ body: 'otro' }))).toHaveLength(0);

    await author.patch('/api/users/me/preferences').send({ emailMessages: false });
    await prisma.emailLog.deleteMany({ where: { userId: authorId } });
    expect(await mailsDuring(() => replier.post(`/api/conversations/${conv.id}/messages`).send({ body: 'y otro' }))).toHaveLength(0);
  });

  it('mail de bienvenida al registrarse; un error del mailer nunca rompe la request', async () => {
    const welcome = await mailsDuring(async () => {
      const res = await anon().post('/api/auth/register').send({ username: 'nueva_mail', email: 'nueva@test.utn', password: 'clave1234', displayName: 'Nueva' });
      expect(res.status).toBe(201);
    });
    expect(welcome).toHaveLength(1);
    expect(welcome[0]).toMatchObject({ to: 'nueva@test.utn', subject: '¡Bienvenida/o al Foro UTN! 🎓' });
    expect(welcome[0]!.html).toContain('Nueva');

    const sent: MailMessage[] = [];
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setMailTransport(async (m) => {
      sent.push(m);
      throw new Error('SMTP caído');
    });
    const postId = await newPost('Mailer roto');
    const res = await replier.post(`/api/posts/${postId}/comments`).send({ body: 'igual anda' });
    expect(res.status).toBe(201);
    await flushEmails();
    expect(sent).toHaveLength(1); // se intentó, falló y solo quedó en el log
    expect(errorLog).toHaveBeenCalledWith('[mail] no se pudo enviar el aviso', expect.any(Error));
    errorLog.mockRestore();
  });
});
