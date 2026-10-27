import { beforeAll, describe, expect, it } from 'vitest';
import { anon, createCommunity, prisma, resetDb, userAndAgent, type Agent } from './helpers.js';

let op: Agent;
let opId: number;
let replier: Agent;
let replierId: number;
let third: Agent;
let thirdId: number;
let mod: Agent;
let communityId: number;

beforeAll(async () => {
  await resetDb();
  ({ agent: op, user: { id: opId } } = await userAndAgent({ username: 'op_user' }));
  ({ agent: replier, user: { id: replierId } } = await userAndAgent({ username: 'replier' }));
  ({ agent: third, user: { id: thirdId } } = await userAndAgent({ username: 'tercero' }));
  ({ agent: mod } = await userAndAgent({ username: 'modera', role: 'MODERATOR' }));
  communityId = (await createCommunity('algoritmos')).id;
});

async function newPost(type: 'TEXT' | 'QUESTION' = 'QUESTION', agent = op) {
  const res = await agent.post('/api/posts').send({ communityId, type, title: `Post ${type} ${Math.random()}`, body: 'Cuerpo del post' });
  expect(res.status).toBe(201);
  return res.body.post.id as number;
}

describe('árbol de comentarios', () => {
  let postId: number;
  let rootA: number;
  let rootB: number;
  let child: number;

  beforeAll(async () => {
    postId = await newPost();
    rootA = (await replier.post(`/api/posts/${postId}/comments`).send({ body: 'Primera raíz' })).body.comment.id;
    rootB = (await third.post(`/api/posts/${postId}/comments`).send({ body: 'Segunda raíz' })).body.comment.id;
    child = (await op.post(`/api/posts/${postId}/comments`).send({ body: 'Respuesta', parentId: rootA })).body.comment.id;
    await replier.post(`/api/posts/${postId}/comments`).send({ body: 'Nieto', parentId: child });
  });

  it('POST devuelve Comment y actualiza commentCount', async () => {
    const res = await third.post(`/api/posts/${postId}/comments`).send({ body: '  Con espacios  ' });
    expect(res.status).toBe(201);
    expect(res.body.comment).toMatchObject({
      postId,
      parentId: null,
      body: 'Con espacios',
      isDeleted: false,
      score: 0,
      myVote: 0,
      isAccepted: false,
      editedAt: null,
      replies: [],
      author: { username: 'tercero' },
    });
    expect((await anon().get(`/api/posts/${postId}`)).body.post.commentCount).toBe(5);
  });

  it('GET arma el árbol completo (raíces con replies anidadas)', async () => {
    const res = await anon().get(`/api/posts/${postId}/comments?sort=old`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
    expect(res.body.items).toHaveLength(3);
    const [a] = res.body.items;
    expect(a.id).toBe(rootA);
    expect(a.replies[0].id).toBe(child);
    expect(a.replies[0].replies[0].body).toBe('Nieto');
    const byNew = await anon().get(`/api/posts/${postId}/comments?sort=new`);
    expect(byNew.body.items[0].body).toBe('Con espacios');
  });

  it('sort=best ordena por score', async () => {
    await op.post(`/api/comments/${rootB}/vote`).send({ value: 1 });
    const vote = await replier.post(`/api/comments/${rootB}/vote`).send({ value: 1 });
    expect(vote.body).toEqual({ score: 2, myVote: 1 });
    const res = await replier.get(`/api/posts/${postId}/comments`);
    expect(res.body.items[0].id).toBe(rootB);
    expect(res.body.items[0].myVote).toBe(1);
    expect((await op.post(`/api/comments/${rootB}/vote`).send({ value: -1 })).body).toEqual({ score: 0, myVote: -1 });
  });

  it('editar solo el autor (setea editedAt)', async () => {
    expect((await op.patch(`/api/comments/${rootA}`).send({ body: 'No es mío' })).status).toBe(403);
    const res = await replier.patch(`/api/comments/${rootA}`).send({ body: 'Primera raíz (editada)' });
    expect(res.status).toBe(200);
    expect(res.body.comment.body).toBe('Primera raíz (editada)');
    expect(res.body.comment.editedAt).not.toBeNull();
    expect(res.body.comment.replies[0].id).toBe(child);
    expect(res.body.comment.replies[0].replies[0].body).toBe('Nieto');
    expect((await replier.patch(`/api/comments/${rootA}`).send({ body: '' })).status).toBe(400);
  });

  it('soft delete: queda en el árbol como borrado', async () => {
    expect((await third.delete(`/api/comments/${rootA}`)).status).toBe(403);
    expect((await replier.delete(`/api/comments/${rootA}`)).status).toBe(204);
    const res = await anon().get(`/api/posts/${postId}/comments?sort=old`);
    const deleted = res.body.items.find((c: { id: number }) => c.id === rootA);
    expect(deleted).toMatchObject({ isDeleted: true, body: '', author: null });
    expect(deleted.replies[0].id).toBe(child);
    expect(res.body.total).toBe(4);
    expect((await anon().get(`/api/posts/${postId}`)).body.post.commentCount).toBe(4);
    // No se puede responder ni votar un comentario borrado
    expect((await op.post(`/api/posts/${postId}/comments`).send({ body: 'hola', parentId: rootA })).status).toBe(400);
    expect((await op.post(`/api/comments/${rootA}/vote`).send({ value: 1 })).status).toBe(404);
    // Un moderador puede borrar comentarios ajenos
    expect((await mod.delete(`/api/comments/${child}`)).status).toBe(204);
  });

  it('parentId de otro post → 400', async () => {
    const other = await newPost('TEXT');
    const res = await op.post(`/api/posts/${other}/comments`).send({ body: 'x', parentId: rootB });
    expect(res.status).toBe(400);
  });

  it('post cerrado → 423 LOCKED (salvo moderación)', async () => {
    const id = await newPost('TEXT');
    await mod.post(`/api/posts/${id}/lock`).send({ locked: true });
    const res = await replier.post(`/api/posts/${id}/comments`).send({ body: 'llego tarde' });
    expect(res.status).toBe(423);
    expect(res.body.code).toBe('LOCKED');
    expect((await mod.post(`/api/posts/${id}/comments`).send({ body: 'Cierro el hilo.' })).status).toBe(201);
  });
});

describe('respuesta aceptada', () => {
  it('solo el autor de la QUESTION (o mod) acepta; el aceptado va primero', async () => {
    const postId = await newPost('QUESTION');
    const first = (await third.post(`/api/posts/${postId}/comments`).send({ body: 'Respuesta 1' })).body.comment.id;
    const answer = (await replier.post(`/api/posts/${postId}/comments`).send({ body: 'Respuesta 2' })).body.comment.id;
    await op.post(`/api/comments/${first}/vote`).send({ value: 1 });

    expect((await replier.post(`/api/posts/${postId}/accept`).send({ commentId: answer })).status).toBe(403);
    const res = await op.post(`/api/posts/${postId}/accept`).send({ commentId: answer });
    expect(res.body).toEqual({ acceptedCommentId: answer });

    const tree = await anon().get(`/api/posts/${postId}/comments`);
    expect(tree.body.items[0]).toMatchObject({ id: answer, isAccepted: true });
    expect((await anon().get(`/api/posts/${postId}`)).body.post.acceptedCommentId).toBe(answer);
    expect((await anon().get('/api/posts?unanswered=true')).body.items.map((p: { id: number }) => p.id)).not.toContain(postId);

    const notif = await prisma.notification.findFirst({ where: { userId: replierId, type: 'ANSWER_ACCEPTED' } });
    expect(notif).toMatchObject({ actorId: opId, postId, commentId: answer });

    expect((await op.post(`/api/posts/${postId}/accept`).send({ commentId: null })).body).toEqual({ acceptedCommentId: null });
    expect((await mod.post(`/api/posts/${postId}/accept`).send({ commentId: first })).body).toEqual({ acceptedCommentId: first });

    const textPost = await newPost('TEXT');
    const c = (await replier.post(`/api/posts/${textPost}/comments`).send({ body: 'hola' })).body.comment.id;
    expect((await op.post(`/api/posts/${textPost}/accept`).send({ commentId: c })).status).toBe(400);
    expect((await op.post(`/api/posts/${postId}/accept`).send({ commentId: c })).status).toBe(400);
  });

  it('borrar el comentario aceptado limpia acceptedCommentId', async () => {
    const postId = await newPost('QUESTION');
    const answer = (await replier.post(`/api/posts/${postId}/comments`).send({ body: 'La respuesta' })).body.comment.id;
    await op.post(`/api/posts/${postId}/accept`).send({ commentId: answer });
    await replier.delete(`/api/comments/${answer}`);
    expect((await anon().get(`/api/posts/${postId}`)).body.post.acceptedCommentId).toBeNull();
  });
});

describe('encuestas', () => {
  it('votar, cambiar el voto y 409 si está cerrada', async () => {
    const res = await op
      .post('/api/posts')
      .send({ communityId, type: 'POLL', title: '¿Pila o cola?', poll: { options: ['Pila', 'Cola'], closesInDays: 2 } });
    const post = res.body.post;
    const [pila, cola] = post.poll.options;

    const v1 = await replier.post(`/api/posts/${post.id}/poll/vote`).send({ optionId: pila.id });
    expect(v1.status).toBe(200);
    expect(v1.body.poll).toMatchObject({ totalVotes: 1, myOptionId: pila.id, isClosed: false });
    await third.post(`/api/posts/${post.id}/poll/vote`).send({ optionId: pila.id });
    const changed = await replier.post(`/api/posts/${post.id}/poll/vote`).send({ optionId: cola.id });
    expect(changed.body.poll.totalVotes).toBe(2);
    expect(changed.body.poll.myOptionId).toBe(cola.id);
    expect(changed.body.poll.options).toEqual([
      { id: pila.id, text: 'Pila', votes: 1 },
      { id: cola.id, text: 'Cola', votes: 1 },
    ]);

    const otherPoll = await op.post('/api/posts').send({ communityId, type: 'POLL', title: 'Otra', poll: { options: ['x', 'y'] } });
    const foreign = otherPoll.body.post.poll.options[0].id;
    expect((await replier.post(`/api/posts/${post.id}/poll/vote`).send({ optionId: foreign })).status).toBe(400);

    await prisma.post.update({ where: { id: post.id }, data: { pollClosesAt: new Date(Date.now() - 1000) } });
    const closed = await replier.post(`/api/posts/${post.id}/poll/vote`).send({ optionId: pila.id });
    expect(closed.status).toBe(409);
    expect(closed.body.code).toBe('CONFLICT');
    expect((await anon().get(`/api/posts/${post.id}`)).body.post.poll.isClosed).toBe(true);
  });
});

describe('notificaciones por respuestas y menciones', () => {
  it('POST_REPLY al autor del post, COMMENT_REPLY al del comentario, MENTION sin duplicar ni autonotificar', async () => {
    await prisma.notification.deleteMany();
    const postId = await newPost('TEXT');
    const c1 = (await replier.post(`/api/posts/${postId}/comments`).send({ body: 'Hola @op_user y @tercero, miren esto' })).body.comment.id;

    const opNotifs = await prisma.notification.findMany({ where: { userId: opId } });
    expect(opNotifs.map((n) => n.type)).toEqual(['POST_REPLY']); // la mención no se duplica
    expect(opNotifs[0]).toMatchObject({ actorId: replierId, postId, commentId: c1 });
    const thirdNotifs = await prisma.notification.findMany({ where: { userId: thirdId } });
    expect(thirdNotifs.map((n) => n.type)).toEqual(['MENTION']);

    await op.post(`/api/posts/${postId}/comments`).send({ body: 'Gracias @REPLIER (yo soy @op_user)', parentId: c1 });
    const replierNotifs = await prisma.notification.findMany({ where: { userId: replierId } });
    expect(replierNotifs.map((n) => n.type)).toEqual(['COMMENT_REPLY']);
    expect(await prisma.notification.count({ where: { userId: opId } })).toBe(1); // nunca a uno mismo

    // Responderse a uno mismo no notifica
    await replier.post(`/api/posts/${postId}/comments`).send({ body: 'me respondo', parentId: c1 });
    expect(await prisma.notification.count({ where: { userId: replierId } })).toBe(1);

    // Menciones en el cuerpo de un post
    await third.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Aviso', body: 'Che @replier, ¿venís? `@op_user` en código no cuenta' });
    expect(await prisma.notification.count({ where: { userId: replierId, type: 'MENTION' } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: opId, type: 'MENTION' } })).toBe(0);
  });

  it('GET /notifications y POST /notifications/read', async () => {
    const res = await replier.get('/api/notifications');
    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(2);
    expect(res.body.items[0]).toMatchObject({
      type: 'MENTION',
      read: false,
      actor: { username: 'tercero' },
      post: { id: expect.any(Number), title: 'Aviso' },
      comment: null,
      message: null,
    });
    const reply = res.body.items.find((n: { type: string }) => n.type === 'COMMENT_REPLY');
    expect(reply.comment.excerpt).toBe('Gracias @REPLIER (yo soy @op_user)');

    const unreadOnly = await replier.get('/api/notifications?unread=true');
    expect(unreadOnly.body.items).toHaveLength(2);

    const one = await replier.post('/api/notifications/read').send({ ids: [reply.id] });
    expect(one.body).toEqual({ unreadCount: 1 });
    const all = await replier.post('/api/notifications/read').send({});
    expect(all.body).toEqual({ unreadCount: 0 });
    expect((await replier.get('/api/auth/me')).body.user.unreadNotifications).toBe(0);
    expect((await anon().get('/api/notifications')).status).toBe(401);
  });
});
