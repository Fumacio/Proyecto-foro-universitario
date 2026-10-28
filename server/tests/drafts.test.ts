import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { FILES_DIR } from '../src/lib/files.js';
import { anon, createCommunity, createTag, prisma, resetDb, userAndAgent, type Agent } from './helpers.js';

const PDF = Buffer.from('%PDF-1.4\n%%EOF\n');

let ana: Agent;
let beto: Agent;
let anaId: number;
let communityId: number;
let tagId: number;

beforeAll(async () => {
  await resetDb();
  let u;
  ({ user: u, agent: ana } = await userAndAgent({ username: 'ana_borr' }));
  anaId = u.id;
  ({ agent: beto } = await userAndAgent({ username: 'beto_borr' }));
  communityId = (await createCommunity('borradores')).id;
  tagId = (await createTag('apuntes')).id;
});

async function uploadPdf(agent: Agent, name: string): Promise<number> {
  const res = await agent.post('/api/attachments').attach('file', PDF, { filename: name, contentType: 'application/pdf' });
  expect(res.status).toBe(201);
  return res.body.attachment.id;
}

const fileOf = async (id: number) => path.join(FILES_DIR, (await prisma.attachment.findUniqueOrThrow({ where: { id } })).storedName);

describe('borradores', () => {
  it('requiere sesión', async () => {
    expect((await anon().get('/api/drafts')).status).toBe(401);
    expect((await anon().post('/api/drafts').send({})).status).toBe(401);
  });

  it('crear vacío (validación laxa) y con todos los campos; draftCount en Me', async () => {
    const empty = await ana.post('/api/drafts').send({});
    expect(empty.status).toBe(201);
    expect(empty.body.draft).toEqual({
      id: expect.any(Number),
      communityId: null,
      type: 'TEXT',
      title: '',
      body: '',
      url: null,
      imageUrl: null,
      tagIds: [],
      poll: null,
      attachments: [],
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    const att = await uploadPdf(ana, 'guia.pdf');
    const full = await ana.post('/api/drafts').send({
      communityId,
      type: 'POLL',
      title: '¿Qué editor usan?',
      body: 'Contame',
      tagIds: [tagId, tagId, 99999],
      poll: { options: ['VS Code', ''], closesInDays: 3 },
      attachmentIds: [att],
    });
    expect(full.status).toBe(201);
    expect(full.body.draft).toMatchObject({
      communityId,
      type: 'POLL',
      title: '¿Qué editor usan?',
      tagIds: [tagId], // sin repetidos ni etiquetas inexistentes
      poll: { options: ['VS Code', ''], closesInDays: 3 },
      attachments: [{ id: att, filename: 'guia.pdf' }],
    });

    expect((await ana.get('/api/auth/me')).body.user.draftCount).toBe(2);
    expect((await beto.get('/api/auth/me')).body.user.draftCount).toBe(0);
  });

  it('validación: máximos de un post, comunidad existente, imagen de /uploads', async () => {
    const long = await ana.post('/api/drafts').send({ title: 'x'.repeat(201) });
    expect(long.status).toBe(400);
    expect(long.body.details.title).toBeDefined();
    expect((await ana.post('/api/drafts').send({ body: 'x'.repeat(40_001) })).status).toBe(400);
    expect((await ana.post('/api/drafts').send({ communityId: 99999 })).status).toBe(400);
    expect((await ana.post('/api/drafts').send({ imageUrl: 'https://evil.example/x.png' })).status).toBe(400);
    expect((await ana.post('/api/drafts').send({ type: 'VIDEO' })).status).toBe(400);
    expect((await ana.post('/api/drafts').send({ poll: { options: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] } })).status).toBe(400);
  });

  it('listar (updatedAt desc), ver, editar y borrar; ajenos → 404', async () => {
    const d = (await ana.post('/api/drafts').send({ title: 'Viejo' })).body.draft;
    await new Promise((r) => setTimeout(r, 15));
    const patched = await ana.patch(`/api/drafts/${d.id}`).send({ title: 'Editado', type: 'QUESTION', url: '' });
    expect(patched.status).toBe(200);
    expect(patched.body.draft).toMatchObject({ id: d.id, title: 'Editado', type: 'QUESTION', url: null });
    expect(patched.body.draft.updatedAt > d.updatedAt).toBe(true);

    const list = await ana.get('/api/drafts');
    expect(list.body.items[0].id).toBe(d.id);
    const times = list.body.items.map((x: { updatedAt: string }) => x.updatedAt);
    expect([...times].sort().reverse()).toEqual(times);

    expect((await ana.get(`/api/drafts/${d.id}`)).body.draft.title).toBe('Editado');
    expect((await beto.get(`/api/drafts/${d.id}`)).status).toBe(404);
    expect((await beto.patch(`/api/drafts/${d.id}`).send({ title: 'mío' })).status).toBe(404);
    expect((await beto.delete(`/api/drafts/${d.id}`)).status).toBe(404);
    expect((await beto.get('/api/drafts')).body.items).toEqual([]);

    expect((await ana.delete(`/api/drafts/${d.id}`)).status).toBe(204);
    expect((await ana.get(`/api/drafts/${d.id}`)).status).toBe(404);
  });

  it('adjuntos: PATCH reemplaza, DELETE borra los archivos, no se pueden usar ajenos', async () => {
    const a = await uploadPdf(ana, 'a.pdf');
    const b = await uploadPdf(ana, 'b.pdf');
    const d = (await ana.post('/api/drafts').send({ title: 'Con adjuntos', attachmentIds: [a] })).body.draft;
    const fileA = await fileOf(a);
    const patched = await ana.patch(`/api/drafts/${d.id}`).send({ attachmentIds: [b] });
    expect(patched.body.draft.attachments.map((x: { id: number }) => x.id)).toEqual([b]);
    expect(fs.existsSync(fileA)).toBe(false);

    // el dueño del borrador puede ver el adjunto; otros no
    expect((await ana.get(`/api/attachments/${b}/download`)).status).toBe(200);
    expect((await beto.get(`/api/attachments/${b}/download`)).status).toBe(404);

    const betoFile = await uploadPdf(beto, 'beto.pdf');
    expect((await ana.patch(`/api/drafts/${d.id}`).send({ attachmentIds: [b, betoFile] })).status).toBe(400);

    const fileB = await fileOf(b);
    expect((await ana.delete(`/api/drafts/${d.id}`)).status).toBe(204);
    expect(fs.existsSync(fileB)).toBe(false);
  });

  it('máximo 50 borradores por usuario', async () => {
    const { user, agent } = await userAndAgent({ username: 'muchos_borr' });
    await prisma.draft.createMany({ data: Array.from({ length: 50 }, (_, i) => ({ userId: user.id, title: `B${i}` })) });
    const res = await agent.post('/api/drafts').send({ title: 'uno más' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
    expect((await agent.get('/api/drafts')).body.items).toHaveLength(50);
  });
});

describe('publicar desde un borrador', () => {
  it('POST /posts con draftId: los adjuntos pasan al post y el borrador se borra', async () => {
    const a = await uploadPdf(ana, 'apunte.pdf');
    const draft = (await ana.post('/api/drafts').send({ communityId, title: 'Apunte', body: 'Texto', attachmentIds: [a] })).body.draft;
    const fileA = await fileOf(a);
    const before = (await ana.get('/api/auth/me')).body.user.draftCount;

    const res = await ana.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Apunte', body: 'Texto', draftId: draft.id });
    expect(res.status).toBe(201);
    expect(res.body.post.attachments.map((x: { id: number }) => x.id)).toEqual([a]);
    expect(res.body.post.attachmentCount).toBe(1);
    expect(fs.existsSync(fileA)).toBe(true);
    expect(await prisma.draft.findUnique({ where: { id: draft.id } })).toBeNull();
    expect((await ana.get('/api/auth/me')).body.user.draftCount).toBe(before - 1);
    expect((await anon().get(`/api/attachments/${a}/download`)).status).toBe(200);
  });

  it('con attachmentIds explícitos: usa esa lista (del borrador o sueltos) y borra los que no van', async () => {
    const keep = await uploadPdf(ana, 'queda.pdf');
    const drop = await uploadPdf(ana, 'sale.pdf');
    const extra = await uploadPdf(ana, 'nuevo.pdf');
    const draft = (await ana.post('/api/drafts').send({ title: 'Mixto', attachmentIds: [keep, drop] })).body.draft;
    const dropFile = await fileOf(drop);
    const res = await ana
      .post('/api/posts')
      .send({ communityId, type: 'TEXT', title: 'Mixto', body: 'x', draftId: draft.id, attachmentIds: [keep, extra] });
    expect(res.status).toBe(201);
    expect(res.body.post.attachments.map((x: { id: number }) => x.id)).toEqual([keep, extra]);
    expect(fs.existsSync(dropFile)).toBe(false);
    expect(await prisma.attachment.findUnique({ where: { id: drop } })).toBeNull();
  });

  it('draftId ajeno o inexistente → 400 (y no se crea el post)', async () => {
    const betoDraft = (await beto.post('/api/drafts').send({ title: 'De Beto' })).body.draft;
    const res = await ana.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Robo', body: 'x', draftId: betoDraft.id });
    expect(res.status).toBe(400);
    expect(res.body.details.draftId).toBeDefined();
    expect((await ana.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Robo', body: 'x', draftId: 99999 })).status).toBe(400);
    expect(await prisma.post.count({ where: { title: 'Robo', authorId: anaId } })).toBe(0);
    expect(await prisma.draft.findUnique({ where: { id: betoDraft.id } })).not.toBeNull();
  });
});
