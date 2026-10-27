import { beforeAll, describe, expect, it } from 'vitest';
import { hotScore } from '../src/lib/text.js';
import { anon, createCommunity, createTag, prisma, resetDb, userAndAgent, type Agent } from './helpers.js';

let author: Agent;
let authorId: number;
let other: Agent;
let otherId: number;
let mod: Agent;
let communityId: number;
let communitySlug: string;
let tagId: number;

beforeAll(async () => {
  await resetDb();
  const a = await userAndAgent({ username: 'autora' });
  author = a.agent;
  authorId = a.user.id;
  const o = await userAndAgent({ username: 'otro' });
  other = o.agent;
  otherId = o.user.id;
  mod = (await userAndAgent({ username: 'la_mod', role: 'MODERATOR' })).agent;
  const c = await createCommunity('programacion');
  communityId = c.id;
  communitySlug = c.slug;
  tagId = (await createTag('duda')).id;
});

describe('crear posts', () => {
  it('requiere sesión', async () => {
    const res = await anon().post('/api/posts').send({ communityId, type: 'TEXT', title: 'Hola', body: 'x' });
    expect(res.status).toBe(401);
  });

  it('crea un TEXT con etiquetas y devuelve PostDetail', async () => {
    const res = await author.post('/api/posts').send({
      communityId,
      type: 'TEXT',
      title: 'Mi primer post',
      body: '# Título\n\nTexto con **negrita**, un [link](https://utn.edu.ar) y `código`.\n\n~~~js\nconsole.log(1)\n~~~',
      tagIds: [tagId, tagId],
    });
    expect(res.status).toBe(201);
    const post = res.body.post;
    expect(post).toMatchObject({
      type: 'TEXT',
      title: 'Mi primer post',
      url: null,
      imageUrl: null,
      score: 0,
      myVote: 0,
      commentCount: 0,
      viewCount: 0,
      isBookmarked: false,
      isPinned: false,
      isLocked: false,
      acceptedCommentId: null,
      poll: null,
      editedAt: null,
      canEdit: true,
      canModerate: false,
      author: { id: authorId, username: 'autora', role: 'STUDENT', displayName: null, avatarUrl: null },
      community: { id: communityId, slug: communitySlug, name: expect.any(String), icon: '💬', color: '#123456' },
    });
    expect(post.excerpt).toBe('Título Texto con negrita, un link y código.');
    expect(post.tags).toEqual([{ id: tagId, name: 'duda', slug: 'duda', color: '#ff0000', postCount: 1 }]);
    expect(post.body).toContain('**negrita**');
  });

  it('valida reglas por tipo', async () => {
    const noBody = await author.post('/api/posts').send({ communityId, type: 'QUESTION', title: 'Sin cuerpo' });
    expect(noBody.status).toBe(400);
    expect(noBody.body.details.body).toBeDefined();

    const badLink = await author.post('/api/posts').send({ communityId, type: 'LINK', title: 'Link', url: 'javascript:alert(1)' });
    expect(badLink.status).toBe(400);
    expect(badLink.body.details.url).toBeDefined();

    const noPoll = await author.post('/api/posts').send({ communityId, type: 'POLL', title: 'Encuesta' });
    expect(noPoll.status).toBe(400);
    expect(noPoll.body.details.poll).toBeDefined();

    const onePoll = await author.post('/api/posts').send({ communityId, type: 'POLL', title: 'Encuesta', poll: { options: ['a'] } });
    expect(onePoll.status).toBe(400);

    const shortTitle = await author.post('/api/posts').send({ communityId, type: 'TEXT', title: 'ab', body: 'x' });
    expect(shortTitle.body.details.title).toBeDefined();

    const externalImage = await author
      .post('/api/posts')
      .send({ communityId, type: 'TEXT', title: 'Con imagen', body: 'x', imageUrl: 'https://evil.com/a.png' });
    expect(externalImage.status).toBe(400);
    expect(externalImage.body.details.imageUrl).toBeDefined();

    const tooManyTags = await author
      .post('/api/posts')
      .send({ communityId, type: 'TEXT', title: 'Tags', body: 'x', tagIds: [1, 2, 3, 4, 5, 6] });
    expect(tooManyTags.status).toBe(400);

    const unknownCommunity = await author.post('/api/posts').send({ communityId: 99999, type: 'TEXT', title: 'Hola', body: 'x' });
    expect(unknownCommunity.status).toBe(400);
    expect(unknownCommunity.body.details.communityId).toBeDefined();
  });

  it('crea LINK y POLL', async () => {
    const link = await author
      .post('/api/posts')
      .send({ communityId, type: 'LINK', title: 'Un link útil', url: 'https://pythontutor.com', imageUrl: '/uploads/abc123.png' });
    expect(link.status).toBe(201);
    expect(link.body.post.url).toBe('https://pythontutor.com');
    expect(link.body.post.imageUrl).toBe('/uploads/abc123.png');

    const poll = await author
      .post('/api/posts')
      .send({ communityId, type: 'POLL', title: '¿Qué editor usan?', poll: { options: ['VS Code', 'Vim', 'Otro'], closesInDays: 3 } });
    expect(poll.status).toBe(201);
    expect(poll.body.post.poll).toMatchObject({ totalVotes: 0, myOptionId: null, isClosed: false });
    expect(poll.body.post.poll.options.map((o: { text: string }) => o.text)).toEqual(['VS Code', 'Vim', 'Otro']);
    expect(new Date(poll.body.post.poll.closesAt).getTime()).toBeGreaterThan(Date.now() + 2 * 86_400_000);
  });
});

describe('leer, editar y borrar', () => {
  let postId: number;

  beforeAll(async () => {
    const res = await author.post('/api/posts').send({ communityId, type: 'QUESTION', title: 'Pregunta editable', body: 'Cuerpo' });
    postId = res.body.post.id;
  });

  it('GET /posts/:id suma una vista y calcula canEdit/canModerate', async () => {
    const first = await anon().get(`/api/posts/${postId}`);
    expect(first.status).toBe(200);
    expect(first.body.post.viewCount).toBe(1);
    expect(first.body.post.canEdit).toBe(false);
    const second = await mod.get(`/api/posts/${postId}`);
    expect(second.body.post.viewCount).toBe(2);
    expect(second.body.post.canModerate).toBe(true);
    expect(second.body.post.canEdit).toBe(false);
    expect((await anon().get('/api/posts/999999')).status).toBe(404);
    expect((await anon().get('/api/posts/abc')).status).toBe(404);
  });

  it('solo autor o mod pueden editar; setea editedAt', async () => {
    const forbidden = await other.patch(`/api/posts/${postId}`).send({ title: 'Hackeado' });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('FORBIDDEN');

    const ok = await author.patch(`/api/posts/${postId}`).send({ title: 'Pregunta editada', tagIds: [tagId] });
    expect(ok.status).toBe(200);
    expect(ok.body.post.title).toBe('Pregunta editada');
    expect(ok.body.post.editedAt).not.toBeNull();
    expect(ok.body.post.tags).toHaveLength(1);

    const empty = await author.patch(`/api/posts/${postId}`).send({ body: '   ' });
    expect(empty.status).toBe(400);

    const byMod = await mod.patch(`/api/posts/${postId}`).send({ body: 'Editado por moderación' });
    expect(byMod.status).toBe(200);
    expect(byMod.body.post.body).toBe('Editado por moderación');
  });

  it('solo autor o mod pueden borrar', async () => {
    const created = await other.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Para borrar', body: 'chau' });
    const id = created.body.post.id;
    expect((await author.delete(`/api/posts/${id}`)).status).toBe(403);
    expect((await other.delete(`/api/posts/${id}`)).status).toBe(204);
    expect((await anon().get(`/api/posts/${id}`)).status).toBe(404);

    const another = await other.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Lo borra la mod', body: 'x' });
    expect((await mod.delete(`/api/posts/${another.body.post.id}`)).status).toBe(204);
    const notif = await prisma.notification.findFirst({ where: { userId: otherId, type: 'MOD' } });
    expect(notif?.message).toContain('Lo borra la mod');
  });
});

describe('votos', () => {
  it('actualizan score, myVote y hot', async () => {
    const created = await author.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Votame', body: 'x' });
    const id = created.body.post.id;

    const up = await other.post(`/api/posts/${id}/vote`).send({ value: 1 });
    expect(up.body).toEqual({ score: 1, myVote: 1 });
    expect((await author.post(`/api/posts/${id}/vote`).send({ value: 1 })).body).toEqual({ score: 2, myVote: 1 });
    expect((await other.post(`/api/posts/${id}/vote`).send({ value: -1 })).body).toEqual({ score: 0, myVote: -1 });
    expect((await other.post(`/api/posts/${id}/vote`).send({ value: 0 })).body).toEqual({ score: 1, myVote: 0 });
    expect((await other.post(`/api/posts/${id}/vote`).send({ value: 1 })).body).toEqual({ score: 2, myVote: 1 });

    const row = await prisma.post.findUniqueOrThrow({ where: { id } });
    expect(row.score).toBe(2);
    expect(row.hot).toBeCloseTo(hotScore(2, row.createdAt), 6);

    const detail = await other.get(`/api/posts/${id}`);
    expect(detail.body.post.myVote).toBe(1);
    expect((await anon().get(`/api/posts/${id}`)).body.post.myVote).toBe(0);

    const invalid = await other.post(`/api/posts/${id}/vote`).send({ value: 5 });
    expect(invalid.status).toBe(400);
    expect((await anon().post(`/api/posts/${id}/vote`).send({ value: 1 })).status).toBe(401);
  });
});

describe('listado y orden', () => {
  let ids: Record<string, number>;
  let slug2: string;

  beforeAll(async () => {
    await prisma.post.deleteMany();
    const c2 = await createCommunity('fisica');
    slug2 = c2.slug;
    const tag2 = await createTag('parcial');
    const now = Date.now();
    const mk = async (title: string, data: { score?: number; daysAgo: number; comments?: number; community?: number; type?: 'TEXT' | 'QUESTION'; pinned?: boolean; tag?: number; author?: number; accepted?: number | null; body?: string }) => {
      const createdAt = new Date(now - data.daysAgo * 86_400_000);
      const p = await prisma.post.create({
        data: {
          title,
          body: data.body ?? 'contenido',
          type: data.type ?? 'TEXT',
          authorId: data.author ?? authorId,
          communityId: data.community ?? communityId,
          score: data.score ?? 0,
          commentCount: data.comments ?? 0,
          isPinned: data.pinned ?? false,
          acceptedCommentId: data.accepted ?? null,
          createdAt,
          hot: hotScore(data.score ?? 0, createdAt),
          ...(data.tag ? { tags: { create: [{ tagId: data.tag }] } } : {}),
        },
      });
      return p.id;
    };
    ids = {
      viejoPopular: await mk('Viejo popular', { score: 100, daysAgo: 20, comments: 2 }),
      nuevo: await mk('Nuevo sin votos', { score: 0, daysAgo: 0.01, comments: 0 }),
      semana: await mk('De la semana', { score: 10, daysAgo: 3, comments: 30, community: c2.id, tag: tag2.id }),
      pregunta: await mk('Pregunta sin resolver', { daysAgo: 1, type: 'QUESTION', author: otherId, body: 'texto con palabra clave zanahoria' }),
      resuelta: await mk('Pregunta resuelta', { daysAgo: 2, type: 'QUESTION', accepted: 12345 }),
      fijado: await mk('Fijado', { daysAgo: 30, pinned: true }),
    };
  });

  const titles = (res: { body: { items: { title: string }[] } }) => res.body.items.map((p) => p.title);

  it('new / top / comments / hot', async () => {
    const byNew = await anon().get('/api/posts?sort=new');
    expect(byNew.status).toBe(200);
    expect(titles(byNew)[0]).toBe('Nuevo sin votos');
    expect(byNew.body).toMatchObject({ page: 1, hasMore: false, total: 6 });

    const top = await anon().get('/api/posts?sort=top');
    expect(titles(top)[0]).toBe('Viejo popular');
    const topWeek = await anon().get('/api/posts?sort=top&t=week');
    expect(titles(topWeek)[0]).toBe('De la semana');
    expect(titles(topWeek)).not.toContain('Viejo popular');

    const comments = await anon().get('/api/posts?sort=comments');
    expect(titles(comments)[0]).toBe('De la semana');

    const hot = await anon().get('/api/posts');
    const hotTitles = titles(hot);
    expect(hotTitles.indexOf('Nuevo sin votos')).toBeLessThan(hotTitles.indexOf('Fijado'));
  });

  it('fijados primero solo dentro de una comunidad con sort=hot', async () => {
    const res = await anon().get(`/api/posts?community=${communitySlug}&sort=hot`);
    expect(titles(res)[0]).toBe('Fijado');
    expect(titles(res)).not.toContain('De la semana');
  });

  it('filtros: tag, author, type, unanswered, q, paginación', async () => {
    expect(titles(await anon().get('/api/posts?tag=parcial'))).toEqual(['De la semana']);
    expect(titles(await anon().get(`/api/posts?community=${slug2}`))).toEqual(['De la semana']);
    expect(titles(await anon().get('/api/posts?author=OTRO'))).toEqual(['Pregunta sin resolver']);
    expect(titles(await anon().get('/api/posts?type=QUESTION&sort=new'))).toEqual(['Pregunta sin resolver', 'Pregunta resuelta']);
    expect(titles(await anon().get('/api/posts?unanswered=true'))).toEqual(['Pregunta sin resolver']);
    expect(titles(await anon().get('/api/posts?q=zanahoria'))).toEqual(['Pregunta sin resolver']);
    expect(titles(await anon().get('/api/posts?q=POPULAR'))).toEqual(['Viejo popular']);

    const page1 = await anon().get('/api/posts?sort=new&limit=4');
    expect(page1.body.items).toHaveLength(4);
    expect(page1.body.hasMore).toBe(true);
    const page2 = await anon().get('/api/posts?sort=new&limit=4&page=2');
    expect(page2.body.items).toHaveLength(2);
    expect(page2.body.hasMore).toBe(false);
    expect(page2.body.page).toBe(2);

    expect((await anon().get('/api/posts?limit=500')).status).toBe(200);
    expect((await anon().get('/api/posts?sort=raro')).status).toBe(400);
  });

  it('feed=following: comunidades unidas + usuarios seguidos (requiere sesión)', async () => {
    expect((await anon().get('/api/posts?feed=following')).status).toBe(401);
    const { agent } = await userAndAgent({ username: 'seguidor' });
    expect((await agent.get('/api/posts?feed=following')).body.items).toEqual([]);
    await agent.post(`/api/communities/${slug2}/join`);
    expect(titles(await agent.get('/api/posts?feed=following'))).toEqual(['De la semana']);
    await agent.post('/api/users/otro/follow');
    expect(titles(await agent.get('/api/posts?feed=following&sort=new')).sort()).toEqual(['De la semana', 'Pregunta sin resolver']);
  });
});

describe('guardados, fijar y cerrar', () => {
  it('bookmarks y /users/me/bookmarks', async () => {
    const created = await author.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Para guardar', body: 'x' });
    const id = created.body.post.id;
    expect((await other.post(`/api/posts/${id}/bookmark`)).body).toEqual({ isBookmarked: true });
    expect((await other.post(`/api/posts/${id}/bookmark`)).body).toEqual({ isBookmarked: true });
    expect((await other.get(`/api/posts/${id}`)).body.post.isBookmarked).toBe(true);
    const list = await other.get('/api/users/me/bookmarks');
    expect(list.body.items.map((p: { id: number }) => p.id)).toEqual([id]);
    expect(list.body.items[0].isBookmarked).toBe(true);
    expect((await other.delete(`/api/posts/${id}/bookmark`)).body).toEqual({ isBookmarked: false });
    expect((await other.get('/api/users/me/bookmarks')).body.items).toEqual([]);
    expect((await anon().get('/api/users/me/bookmarks')).status).toBe(401);
  });

  it('pin y lock solo para moderación', async () => {
    const created = await author.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Para fijar', body: 'x' });
    const id = created.body.post.id;
    expect((await author.post(`/api/posts/${id}/pin`).send({ pinned: true })).status).toBe(403);
    expect((await mod.post(`/api/posts/${id}/pin`).send({ pinned: true })).body).toEqual({ isPinned: true });
    expect((await mod.post(`/api/posts/${id}/lock`).send({ locked: true })).body).toEqual({ isLocked: true });
    const detail = await anon().get(`/api/posts/${id}`);
    expect(detail.body.post).toMatchObject({ isPinned: true, isLocked: true });
    expect((await mod.post(`/api/posts/${id}/lock`).send({})).status).toBe(400);
  });
});
