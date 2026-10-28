import { beforeAll, describe, expect, it } from 'vitest';
import { anon, createCommunity, prisma, resetDb, userAndAgent, type Agent } from './helpers.js';

let author: Agent;
let fan: Agent;
let other: Agent;
let authorId: number;
let fanId: number;
let postId: number;
let communityId: number;

const reactionNotifs = () => prisma.notification.findMany({ where: { userId: authorId, type: 'REACTION' }, orderBy: { id: 'asc' } });

beforeAll(async () => {
  await resetDb();
  let u;
  ({ user: u, agent: author } = await userAndAgent({ username: 'autora_r' }));
  authorId = u.id;
  ({ user: u, agent: fan } = await userAndAgent({ username: 'fan_r' }));
  fanId = u.id;
  ({ agent: other } = await userAndAgent({ username: 'otro_r' }));
  communityId = (await createCommunity('reacciones')).id;
  postId = (await author.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Reaccioná', body: 'Hola' })).body.post.id;
});

describe('reacciones en posts', () => {
  it('toggle, varias por usuario, orden fijo y notificación solo la primera vez', async () => {
    const first = await fan.post(`/api/posts/${postId}/reactions`).send({ emoji: '🎉' });
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ reactions: [{ emoji: '🎉', count: 1, reacted: true }] });

    const second = await fan.post(`/api/posts/${postId}/reactions`).send({ emoji: '👍' });
    expect(second.body.reactions).toEqual([
      { emoji: '👍', count: 1, reacted: true },
      { emoji: '🎉', count: 1, reacted: true },
    ]);
    const byOther = await other.post(`/api/posts/${postId}/reactions`).send({ emoji: '👍' });
    expect(byOther.body.reactions).toEqual([
      { emoji: '👍', count: 2, reacted: true },
      { emoji: '🎉', count: 1, reacted: false },
    ]);

    // toggle: sacar y volver a poner
    const removed = await fan.post(`/api/posts/${postId}/reactions`).send({ emoji: '🎉' });
    expect(removed.body.reactions).toEqual([{ emoji: '👍', count: 2, reacted: true }]);
    await fan.post(`/api/posts/${postId}/reactions`).send({ emoji: '🎉' });

    const notifs = await reactionNotifs();
    expect(notifs.map((n) => [n.actorId, n.message, n.postId, n.commentId])).toEqual([
      [fanId, '🎉', postId, null],
      [expect.any(Number), '👍', postId, null],
    ]);
    const list = await author.get('/api/notifications');
    expect(list.body.items[0]).toMatchObject({ type: 'REACTION', message: '👍', post: { id: postId } });

    // reaccionar a lo propio no notifica
    await author.post(`/api/posts/${postId}/reactions`).send({ emoji: '🔥' });
    expect(await reactionNotifs()).toHaveLength(2);
  });

  it('acepta ❤ sin selector de variación y rechaza emojis fuera del conjunto', async () => {
    const heart = await other.post(`/api/posts/${postId}/reactions`).send({ emoji: '❤' });
    expect(heart.status).toBe(200);
    expect(heart.body.reactions.find((r: { emoji: string }) => r.emoji === '❤️')).toEqual({ emoji: '❤️', count: 1, reacted: true });
    for (const emoji of ['💩', '👍🏽', '', 'like', 1, null]) {
      const res = await other.post(`/api/posts/${postId}/reactions`).send({ emoji });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION');
    }
    expect((await other.post('/api/posts/99999/reactions').send({ emoji: '👍' })).status).toBe(404);
    expect((await anon().post(`/api/posts/${postId}/reactions`).send({ emoji: '👍' })).status).toBe(401);
  });

  it('reactions en feed y detalle, con reacted según quién mira', async () => {
    const asAnon = await anon().get('/api/posts');
    const item = asAnon.body.items.find((p: { id: number }) => p.id === postId);
    expect(item.reactions.map((r: { emoji: string }) => r.emoji)).toEqual(['👍', '❤️', '😂', '🎉', '🔥'].filter((e) => e !== '😂'));
    expect(item.reactions.every((r: { reacted: boolean }) => !r.reacted)).toBe(true);

    const asFan = await fan.get(`/api/posts/${postId}`);
    const mine = asFan.body.post.reactions.filter((r: { reacted: boolean }) => r.reacted).map((r: { emoji: string }) => r.emoji);
    expect(mine).toEqual(['👍', '🎉']);
    expect(asFan.body.post.attachments).toEqual([]);

    const fanFeed = await fan.get('/api/posts');
    expect(fanFeed.body.items.find((p: { id: number }) => p.id === postId).reactions.find((r: { emoji: string }) => r.emoji === '👍').reacted).toBe(true);
    const search = await fan.get('/api/search?q=Reacciona');
    expect(search.body.posts[0]?.reactions ?? []).toBeInstanceOf(Array);
  });

  it('quién reaccionó (hasta 50, filtrable por emoji)', async () => {
    const thumbs = await anon().get(`/api/posts/${postId}/reactions/users?emoji=${encodeURIComponent('👍')}`);
    expect(thumbs.status).toBe(200);
    expect(thumbs.body.items.map((u: { username: string }) => u.username)).toEqual(['fan_r', 'otro_r']);
    expect(thumbs.body.items[0]).toEqual({ id: fanId, username: 'fan_r', displayName: null, avatarUrl: null, role: 'STUDENT' });
    const all = await anon().get(`/api/posts/${postId}/reactions/users`);
    expect(all.body.items.map((u: { username: string }) => u.username).sort()).toEqual(['autora_r', 'fan_r', 'otro_r']);
    expect((await anon().get(`/api/posts/${postId}/reactions/users?emoji=x`)).status).toBe(400);
    expect((await anon().get('/api/posts/99999/reactions/users')).status).toBe(404);
  });

  it('un usuario baneado no puede reaccionar', async () => {
    const { user, agent } = await userAndAgent({ username: 'baneado_r' });
    await prisma.ban.create({ data: { userId: user.id, reason: 'spam' } });
    const res = await agent.post(`/api/posts/${postId}/reactions`).send({ emoji: '👍' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('BANNED');
  });
});

describe('reacciones en comentarios', () => {
  it('toggle, summary en el árbol y en /users/:u/comments, notificación y 404 si está borrado', async () => {
    const comment = (await author.post(`/api/posts/${postId}/comments`).send({ body: 'Comentario de la autora' })).body.comment;
    expect(comment.reactions).toEqual([]);
    const res = await fan.post(`/api/comments/${comment.id}/reactions`).send({ emoji: '😂' });
    expect(res.body).toEqual({ reactions: [{ emoji: '😂', count: 1, reacted: true }] });
    await other.post(`/api/comments/${comment.id}/reactions`).send({ emoji: '😂' });
    await fan.post(`/api/comments/${comment.id}/reactions`).send({ emoji: '🤔' });

    const tree = await fan.get(`/api/posts/${postId}/comments`);
    expect(tree.body.items[0].reactions).toEqual([
      { emoji: '😂', count: 2, reacted: true },
      { emoji: '🤔', count: 1, reacted: true },
    ]);
    const profile = await anon().get('/api/users/autora_r/comments');
    expect(profile.body.items[0].reactions).toEqual([
      { emoji: '😂', count: 2, reacted: false },
      { emoji: '🤔', count: 1, reacted: false },
    ]);

    const notif = await prisma.notification.findMany({ where: { userId: authorId, type: 'REACTION', commentId: comment.id } });
    expect(notif.map((n) => n.message).sort()).toEqual(['😂', '😂']);
    expect(notif.every((n) => n.postId === postId)).toBe(true);

    const who = await anon().get(`/api/comments/${comment.id}/reactions/users?emoji=${encodeURIComponent('🤔')}`);
    expect(who.body.items.map((u: { username: string }) => u.username)).toEqual(['fan_r']);

    await author.delete(`/api/comments/${comment.id}`);
    expect((await fan.post(`/api/comments/${comment.id}/reactions`).send({ emoji: '👍' })).status).toBe(404);
    expect((await anon().get(`/api/comments/${comment.id}/reactions/users`)).status).toBe(404);
  });

  it('borrar el post borra sus reacciones', async () => {
    const p = (await author.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Efímero', body: 'x' })).body.post;
    await fan.post(`/api/posts/${p.id}/reactions`).send({ emoji: '👍' });
    await author.delete(`/api/posts/${p.id}`);
    expect(await prisma.postReaction.count({ where: { postId: p.id } })).toBe(0);
  });
});
