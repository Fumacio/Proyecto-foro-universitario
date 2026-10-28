import { beforeAll, describe, expect, it } from 'vitest';
import { anon, createCommunity, prisma, resetDb, userAndAgent, type Agent } from './helpers.js';

let admin: Agent;
let adminId: number;
let mod: Agent;
let modId: number;
let student: Agent;
let studentId: number;
let troll: Agent;
let trollId: number;
let communityId: number;

beforeAll(async () => {
  await resetDb();
  ({ agent: admin, user: { id: adminId } } = await userAndAgent({ username: 'admin_t', role: 'ADMIN' }));
  ({ agent: mod, user: { id: modId } } = await userAndAgent({ username: 'mod_t', role: 'MODERATOR' }));
  ({ agent: student, user: { id: studentId } } = await userAndAgent({ username: 'alumna' }));
  ({ agent: troll, user: { id: trollId } } = await userAndAgent({ username: 'troll' }));
  communityId = (await createCommunity('off-topic')).id;
});

describe('reportes', () => {
  let spamId: number;
  let commentId: number;

  beforeAll(async () => {
    spamId = (await troll.post('/api/posts').send({ communityId, type: 'TEXT', title: 'VENDO APUNTES', body: 'escribime' })).body.post.id;
    const host = (await student.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Consulta', body: 'hola' })).body.post.id;
    commentId = (await troll.post(`/api/posts/${host}/comments`).send({ body: 'comentario ofensivo' })).body.comment.id;
  });

  it('crear: exactamente un objetivo, motivo válido', async () => {
    expect((await anon().post('/api/reports').send({ postId: spamId, reason: 'SPAM' })).status).toBe(401);
    expect((await student.post('/api/reports').send({ reason: 'SPAM' })).status).toBe(400);
    expect((await student.post('/api/reports').send({ postId: spamId, commentId, reason: 'SPAM' })).status).toBe(400);
    expect((await student.post('/api/reports').send({ postId: spamId, reason: 'NOSE' })).status).toBe(400);
    expect((await student.post('/api/reports').send({ postId: 999999, reason: 'SPAM' })).status).toBe(404);

    const ok = await student.post('/api/reports').send({ postId: spamId, reason: 'SPAM', details: 'Vende apuntes' });
    expect(ok.status).toBe(201);
    expect(ok.body).toEqual({ ok: true });
    expect((await mod.post('/api/reports').send({ postId: spamId, reason: 'SPAM' })).status).toBe(201);
    expect((await student.post('/api/reports').send({ commentId, reason: 'HARASSMENT' })).status).toBe(201);
  });

  it('cola de reportes solo para moderación', async () => {
    expect((await student.get('/api/reports')).status).toBe(403);
    const res = await mod.get('/api/reports');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    const postReport = res.body.items[0];
    expect(postReport).toMatchObject({
      reason: 'SPAM',
      details: 'Vende apuntes',
      status: 'PENDING',
      reporter: { username: 'alumna' },
      post: { id: spamId, title: 'VENDO APUNTES', author: { username: 'troll' } },
      comment: null,
      resolvedBy: null,
      resolvedAt: null,
    });
    const commentReport = res.body.items.find((r: { comment: unknown }) => r.comment);
    expect(commentReport.comment).toMatchObject({ id: commentId, body: 'comentario ofensivo', author: { username: 'troll' } });
  });

  it('resolver con deleteContent borra el post, resuelve los duplicados y notifica MOD', async () => {
    const queue = (await mod.get('/api/reports')).body.items;
    const target = queue.find((r: { post: { id: number } | null }) => r.post?.id === spamId);
    const res = await mod.patch(`/api/reports/${target.id}`).send({ status: 'RESOLVED', deleteContent: true });
    expect(res.status).toBe(200);
    expect(res.body.report).toMatchObject({ status: 'RESOLVED', resolvedBy: { username: 'mod_t' }, post: null });
    expect(res.body.report.resolvedAt).not.toBeNull();
    expect((await anon().get(`/api/posts/${spamId}`)).status).toBe(404);

    const pending = await mod.get('/api/reports?status=PENDING');
    expect(pending.body.items).toHaveLength(1);
    const resolved = await mod.get('/api/reports?status=RESOLVED');
    expect(resolved.body.total).toBe(2);

    const notif = await prisma.notification.findFirst({ where: { userId: trollId, type: 'MOD' } });
    expect(notif?.message).toMatch(/VENDO APUNTES.*eliminado por moderación/);
    expect(notif?.actorId).toBeNull();
  });

  it('resolver un reporte de comentario lo borra (soft) y DISMISSED no borra nada', async () => {
    const [report] = (await mod.get('/api/reports')).body.items;
    expect((await student.patch(`/api/reports/${report.id}`).send({ status: 'DISMISSED' })).status).toBe(403);
    expect((await mod.patch(`/api/reports/${report.id}`).send({ status: 'PENDING' })).status).toBe(400);
    const res = await mod.patch(`/api/reports/${report.id}`).send({ status: 'RESOLVED', deleteContent: true });
    expect(res.status).toBe(200);
    const comment = await prisma.comment.findUniqueOrThrow({ where: { id: commentId } });
    expect(comment.isDeleted).toBe(true);

    await student.post('/api/reports').send({ commentId: (await prisma.comment.create({ data: { postId: comment.postId, authorId: trollId, body: 'otro' } })).id, reason: 'OTHER' });
    const [again] = (await mod.get('/api/reports')).body.items;
    const dismissed = await mod.patch(`/api/reports/${again.id}`).send({ status: 'DISMISSED' });
    expect(dismissed.body.report.status).toBe('DISMISSED');
    expect(dismissed.body.report.comment.body).toBe('otro');
  });
});

describe('bans', () => {
  it('no se puede banear a un ADMIN ni a uno mismo', async () => {
    expect((await mod.post(`/api/admin/users/${adminId}/ban`).send({ reason: 'porque sí', days: 1 })).status).toBe(403);
    expect((await mod.post(`/api/admin/users/${modId}/ban`).send({ reason: 'porque sí', days: 1 })).status).toBe(403);
    expect((await student.post(`/api/admin/users/${trollId}/ban`).send({ reason: 'porque sí', days: 1 })).status).toBe(403);
    expect((await mod.post(`/api/admin/users/${trollId}/ban`).send({ reason: 'x', days: 1 })).status).toBe(400);
    expect((await mod.post(`/api/admin/users/${trollId}/ban`).send({ reason: 'Spam', days: 0 })).status).toBe(400);
  });

  it('el baneado puede leer pero no escribir (403 BANNED)', async () => {
    const victimPost = (await student.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Post normal', body: 'hola' })).body.post.id;
    const res = await mod.post(`/api/admin/users/${trollId}/ban`).send({ reason: 'Spam reiterado', days: 7 });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: trollId, username: 'troll', ban: { reason: 'Spam reiterado' } });
    const expiresAt = new Date(res.body.user.ban.expiresAt).getTime();
    expect(expiresAt).toBeGreaterThan(Date.now() + 6.9 * 86_400_000);

    const me = (await troll.get('/api/auth/me')).body.user;
    expect(me.ban).toMatchObject({ reason: 'Spam reiterado', expiresAt: expect.any(String), createdAt: expect.any(String) });
    expect(me.unreadNotifications).toBeGreaterThan(0);
    const modNotif = await prisma.notification.findFirst({ where: { userId: trollId, type: 'MOD' }, orderBy: { id: 'desc' } });
    expect(modNotif?.message).toMatch(/suspendida por 7 días.*Spam reiterado/);

    // Lectura OK
    expect((await troll.get('/api/posts')).status).toBe(200);
    expect((await troll.get(`/api/posts/${victimPost}`)).status).toBe(200);

    const writes = [
      () => troll.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Vuelvo', body: 'x' }),
      () => troll.post(`/api/posts/${victimPost}/comments`).send({ body: 'x' }),
      () => troll.post(`/api/posts/${victimPost}/vote`).send({ value: 1 }),
      () => troll.post('/api/conversations').send({ username: 'alumna' }),
      () => troll.post('/api/reports').send({ postId: victimPost, reason: 'SPAM' }),
      () => troll.post('/api/users/alumna/follow'),
      () => troll.post('/api/communities/off-topic/join'),
      () => troll.patch('/api/users/me').send({ bio: 'spam' }),
      () => troll.post('/api/uploads/image').attach('file', Buffer.from('x'), 'a.png'),
    ];
    for (const write of writes) {
      const r = await write();
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('BANNED');
      expect(r.body.error).toMatch(/suspendida/);
    }

    const profile = (await anon().get('/api/users/troll')).body.user;
    expect(profile.isBanned).toBe(true);

    const bans = await mod.get('/api/admin/bans');
    expect(bans.body.items.map((u: { username: string }) => u.username)).toEqual(['troll']);
    const stats = await mod.get('/api/admin/stats');
    expect(stats.body.activeBans).toBe(1);
  });

  it('levantar el ban devuelve la escritura', async () => {
    const res = await mod.delete(`/api/admin/users/${trollId}/ban`);
    expect(res.status).toBe(200);
    expect(res.body.user.ban).toBeNull();
    expect((await troll.post('/api/communities/off-topic/join')).status).toBe(200);
    expect((await troll.get('/api/auth/me')).body.user.ban).toBeNull();
  });

  it('un ban vencido ya no cuenta como activo', async () => {
    await prisma.ban.create({ data: { userId: trollId, reason: 'viejo', expiresAt: new Date(Date.now() - 1000) } });
    expect((await troll.get('/api/auth/me')).body.user.ban).toBeNull();
    const permanent = await mod.post(`/api/admin/users/${trollId}/ban`).send({ reason: 'Definitivo', days: null });
    expect(permanent.body.user.ban).toMatchObject({ reason: 'Definitivo', expiresAt: null });
    expect((await troll.post('/api/communities/off-topic/join')).body.code).toBe('BANNED');
    await mod.delete(`/api/admin/users/${trollId}/ban`);
  });
});

describe('admin', () => {
  it('cambiar roles: solo ADMIN y nunca el propio', async () => {
    expect((await mod.patch(`/api/admin/users/${studentId}`).send({ role: 'MODERATOR' })).status).toBe(403);
    expect((await admin.patch(`/api/admin/users/${adminId}`).send({ role: 'STUDENT' })).status).toBe(400);
    expect((await admin.patch(`/api/admin/users/${studentId}`).send({ role: 'JEFE' })).status).toBe(400);
    const res = await admin.patch(`/api/admin/users/${studentId}`).send({ role: 'PROFESSOR' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: studentId, role: 'PROFESSOR', email: 'alumna@test.utn', ban: null });
    // El rol se lee en vivo de la DB en cada request
    expect((await student.get('/api/auth/me')).body.user.role).toBe('PROFESSOR');
    await admin.patch(`/api/admin/users/${studentId}`).send({ role: 'MODERATOR' });
    expect((await student.get('/api/reports')).status).toBe(200);
    await admin.patch(`/api/admin/users/${studentId}`).send({ role: 'STUDENT' });
    expect((await student.get('/api/reports')).status).toBe(403);
  });

  it('listado de usuarios con filtros y stats', async () => {
    expect((await student.get('/api/admin/users')).status).toBe(403);
    const all = await mod.get('/api/admin/users');
    expect(all.body.total).toBe(4);
    expect(all.body.items[0]).toEqual({
      id: expect.any(Number),
      username: expect.any(String),
      displayName: null,
      avatarUrl: null,
      role: expect.any(String),
      email: expect.any(String),
      createdAt: expect.any(String),
      postCount: expect.any(Number),
      commentCount: expect.any(Number),
      ban: null,
    });
    const q = await mod.get('/api/admin/users?q=TROL');
    expect(q.body.items.map((u: { username: string }) => u.username)).toEqual(['troll']);
    const byRole = await mod.get('/api/admin/users?role=MODERATOR');
    expect(byRole.body.items.map((u: { username: string }) => u.username)).toEqual(['mod_t']);

    const stats = await mod.get('/api/admin/stats');
    expect(stats.body).toMatchObject({ users: 4, communities: 1, pendingReports: expect.any(Number), activeBans: 0 });
    expect(stats.body.activity).toHaveLength(14);
    expect(stats.body.activity[13]).toEqual({ date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), posts: expect.any(Number), comments: expect.any(Number), users: 4 });
  });
});
