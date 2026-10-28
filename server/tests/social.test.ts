import { beforeAll, describe, expect, it } from 'vitest';
import { anon, createCommunity, loginAs, prisma, resetDb, userAndAgent, type Agent } from './helpers.js';

let ana: Agent;
let anaId: number;
let beto: Agent;
let betoId: number;
let admin: Agent;
let communityId: number;

beforeAll(async () => {
  await resetDb();
  ({ agent: ana, user: { id: anaId } } = await userAndAgent({ username: 'ana' }));
  ({ agent: beto, user: { id: betoId } } = await userAndAgent({ username: 'beto' }));
  ({ agent: admin } = await userAndAgent({ username: 'jefa', role: 'ADMIN' }));
  communityId = (await createCommunity('ingreso')).id;
});

describe('perfiles y seguidores', () => {
  it('follow / unfollow con contadores y notificación FOLLOW', async () => {
    const res = await ana.post('/api/users/BETO/follow');
    expect(res.body).toEqual({ isFollowing: true, followerCount: 1 });
    expect((await ana.post('/api/users/beto/follow')).body).toEqual({ isFollowing: true, followerCount: 1 });
    expect(await prisma.notification.count({ where: { userId: betoId, type: 'FOLLOW', actorId: anaId } })).toBe(1);

    const profile = await ana.get('/api/users/beto');
    expect(profile.body.user).toMatchObject({ username: 'beto', isFollowing: true, followerCount: 1, followingCount: 0, isBanned: false });
    expect((await anon().get('/api/users/beto')).body.user.isFollowing).toBe(false);
    expect((await ana.post('/api/users/ana/follow')).status).toBe(400);

    const followers = await anon().get('/api/users/beto/followers');
    expect(followers.body.items.map((u: { username: string }) => u.username)).toEqual(['ana']);
    const following = await anon().get('/api/users/ana/following');
    expect(following.body.items[0]).toEqual({ id: betoId, username: 'beto', displayName: null, avatarUrl: null, role: 'STUDENT' });

    expect((await ana.delete('/api/users/beto/follow')).body).toEqual({ isFollowing: false, followerCount: 0 });
    expect((await anon().get('/api/users/nadie_existe')).status).toBe(404);
  });

  it('perfil con karma, posts y comentarios del usuario', async () => {
    const post = (await ana.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Post de Ana', body: 'hola' })).body.post;
    const comment = (await ana.post(`/api/posts/${post.id}/comments`).send({ body: 'comentario de Ana' })).body.comment;
    await beto.post(`/api/posts/${post.id}/vote`).send({ value: 1 });
    await beto.post(`/api/comments/${comment.id}/vote`).send({ value: 1 });
    await admin.post(`/api/comments/${comment.id}/vote`).send({ value: 1 });

    const profile = (await anon().get('/api/users/ana')).body.user;
    expect(profile.karma).toEqual({ post: 1, comment: 2, total: 3 });
    expect(profile.postCount).toBe(1);
    expect(profile.commentCount).toBe(1);
    expect((await ana.get('/api/auth/me')).body.user.karma).toBe(3);

    const posts = await anon().get('/api/users/ana/posts?sort=top');
    expect(posts.body.items.map((p: { id: number }) => p.id)).toEqual([post.id]);
    const comments = await anon().get('/api/users/ana/comments');
    expect(comments.body.items[0]).toMatchObject({ id: comment.id, body: 'comentario de Ana', post: { id: post.id, title: 'Post de Ana', community: { slug: 'ingreso' } } });
    expect(comments.body.items[0].replies).toBeUndefined();
  });

  it('PATCH /users/me actualiza el perfil', async () => {
    const res = await ana.patch('/api/users/me').send({ displayName: 'Ana García', bio: 'Estudiante', career: 'Sistemas' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ displayName: 'Ana García', bio: 'Estudiante', career: 'Sistemas' });
    const cleared = await ana.patch('/api/users/me').send({ bio: '' });
    expect(cleared.body.user.bio).toBeNull();
    expect(cleared.body.user.displayName).toBe('Ana García');
    expect((await ana.patch('/api/users/me').send({ bio: 'x'.repeat(501) })).status).toBe(400);
  });
});

describe('comunidades', () => {
  it('lista (orden por miembros), detalle, join/leave y ?joined=true', async () => {
    await createCommunity('vacia');
    expect((await ana.post('/api/communities/ingreso/join')).body).toEqual({ isMember: true, memberCount: 1 });
    expect((await beto.post('/api/communities/ingreso/join')).body).toEqual({ isMember: true, memberCount: 2 });

    const list = await ana.get('/api/communities');
    expect(list.body.items[0]).toMatchObject({ slug: 'ingreso', memberCount: 2, isMember: true, rules: ['Respeto'] });
    expect(list.body.items[0].postCount).toBeGreaterThan(0);

    const joined = await beto.get('/api/communities?joined=true');
    expect(joined.body.items.map((c: { slug: string }) => c.slug)).toEqual(['ingreso']);
    expect((await anon().get('/api/communities?joined=true')).status).toBe(401);

    const detail = await anon().get('/api/communities/ingreso');
    expect(detail.body.community).toMatchObject({ slug: 'ingreso', isMember: false, memberCount: 2 });
    expect((await beto.delete('/api/communities/ingreso/join')).body).toEqual({ isMember: false, memberCount: 1 });
    expect((await anon().get('/api/communities/no-existe')).status).toBe(404);
  });

  it('CRUD de comunidades y etiquetas solo para ADMIN', async () => {
    const body = { name: 'Química General', slug: 'quimica', description: 'Átomos', icon: '🧪', color: '#00AA88', rules: ['Una', 'Dos'] };
    expect((await ana.post('/api/communities').send(body)).status).toBe(403);
    const created = await admin.post('/api/communities').send(body);
    expect(created.status).toBe(201);
    expect(created.body.community).toMatchObject({ slug: 'quimica', color: '#00aa88', rules: ['Una', 'Dos'], memberCount: 0 });
    expect((await admin.post('/api/communities').send(body)).status).toBe(409);
    expect((await admin.post('/api/communities').send({ ...body, slug: 'Mal Slug!', name: 'Otra' })).status).toBe(400);

    const patched = await admin.patch('/api/communities/quimica').send({ description: 'Moléculas', slug: 'ignorado' });
    expect(patched.body.community).toMatchObject({ slug: 'quimica', description: 'Moléculas' });
    expect((await admin.delete('/api/communities/quimica')).status).toBe(204);

    expect((await ana.post('/api/tags').send({ name: 'Duda', color: '#ff0000' })).status).toBe(403);
    const tag = await admin.post('/api/tags').send({ name: 'Trabajo Práctico', color: '#10b981' });
    expect(tag.status).toBe(201);
    expect(tag.body.tag).toEqual({ id: expect.any(Number), name: 'Trabajo Práctico', slug: 'trabajo-practico', color: '#10b981', postCount: 0 });
    expect((await admin.post('/api/tags').send({ name: 'Trabajo Práctico', color: '#10b981' })).status).toBe(409);
    expect((await anon().get('/api/tags')).body.items).toHaveLength(1);
    expect((await admin.delete(`/api/tags/${tag.body.tag.id}`)).status).toBe(204);
  });
});

describe('mensajes directos', () => {
  it('crear conversación, enviar, leer y contar no leídos', async () => {
    expect((await ana.post('/api/conversations').send({ username: 'ana' })).status).toBe(400);
    expect((await ana.post('/api/conversations').send({ username: 'fantasma' })).status).toBe(404);

    const created = await ana.post('/api/conversations').send({ username: 'beto' });
    expect(created.status).toBe(200);
    const conv = created.body.conversation;
    expect(conv).toMatchObject({ other: { id: betoId, username: 'beto' }, lastMessage: null, unread: 0 });
    expect((await beto.post('/api/conversations').send({ username: 'ANA' })).body.conversation.id).toBe(conv.id);

    // Vacía: solo la ve quien la creó
    expect((await ana.get('/api/conversations')).body.items).toHaveLength(1);
    expect((await beto.get('/api/conversations')).body.items).toHaveLength(0);

    const sent = await ana.post(`/api/conversations/${conv.id}/messages`).send({ body: 'Hola Beto!' });
    expect(sent.status).toBe(201);
    expect(sent.body.message).toMatchObject({ conversationId: conv.id, body: 'Hola Beto!', sender: { id: anaId } });
    await ana.post(`/api/conversations/${conv.id}/messages`).send({ body: '¿Vamos a la consulta?' });
    expect((await ana.post(`/api/conversations/${conv.id}/messages`).send({ body: '' })).status).toBe(400);

    const betoList = await beto.get('/api/conversations');
    expect(betoList.body.items[0]).toMatchObject({ id: conv.id, unread: 2, lastMessage: { body: '¿Vamos a la consulta?', senderId: anaId } });
    expect((await beto.get('/api/auth/me')).body.user.unreadMessages).toBe(2);
    expect((await ana.get('/api/conversations')).body.items[0].unread).toBe(0);

    const msgs = await beto.get(`/api/conversations/${conv.id}/messages`);
    expect(msgs.body.items.map((m: { body: string }) => m.body)).toEqual(['Hola Beto!', '¿Vamos a la consulta?']);
    expect(msgs.body.hasMore).toBe(false);
    const older = await beto.get(`/api/conversations/${conv.id}/messages?limit=1`);
    expect(older.body).toMatchObject({ hasMore: true, items: [{ body: '¿Vamos a la consulta?' }] });
    const before = await beto.get(`/api/conversations/${conv.id}/messages?before=${older.body.items[0].id}`);
    expect(before.body.items.map((m: { body: string }) => m.body)).toEqual(['Hola Beto!']);

    expect((await beto.post(`/api/conversations/${conv.id}/read`)).body).toEqual({ unreadMessages: 0 });
    expect((await beto.get('/api/conversations')).body.items[0].unread).toBe(0);

    // Un tercero no puede ver la conversación
    const { agent: intruso } = await userAndAgent({ username: 'intruso' });
    expect((await intruso.get(`/api/conversations/${conv.id}/messages`)).status).toBe(404);
    expect((await intruso.post(`/api/conversations/${conv.id}/messages`).send({ body: 'hola' })).status).toBe(404);
  });
});

describe('búsqueda', () => {
  it('busca posts, usuarios y comunidades', async () => {
    await ana.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Ejercicio de recursividad', body: 'Fibonacci recursivo' });
    const res = await anon().get('/api/search?q=recurs');
    expect(res.status).toBe(200);
    expect(res.body.posts.map((p: { title: string }) => p.title)).toEqual(['Ejercicio de recursividad']);
    expect(res.body.users).toEqual([]);
    const users = await anon().get('/api/search?q=bet');
    expect(users.body.users.map((u: { username: string }) => u.username)).toEqual(['beto']);
    const communities = await anon().get('/api/search?q=ingr');
    expect(communities.body.communities[0]).toEqual({ id: communityId, slug: 'ingreso', name: expect.any(String), icon: '💬', color: '#123456' });
    expect((await anon().get('/api/search?q=a')).status).toBe(400);
  });
});

describe('borrar cuenta', () => {
  it('pide contraseña; los posts quedan con author null', async () => {
    const { agent, user } = await userAndAgent({ username: 'se_va' });
    const post = (await agent.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Me voy del foro', body: 'chau' })).body.post;
    await agent.post(`/api/posts/${post.id}/vote`).send({ value: 1 });
    await (await loginAs('beto')).post(`/api/posts/${post.id}/vote`).send({ value: 1 });
    await agent.post('/api/conversations').send({ username: 'ana' });

    expect((await agent.delete('/api/users/me').send({ password: 'incorrecta' })).status).toBe(400);
    expect((await agent.delete('/api/users/me').send({ password: 'Password123' })).status).toBe(204);
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();

    const detail = await anon().get(`/api/posts/${post.id}`);
    expect(detail.body.post.author).toBeNull();
    expect(detail.body.post.score).toBe(1); // su voto se fue en cascada
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect((await anon().get('/api/users/se_va')).status).toBe(404);
  });
});
