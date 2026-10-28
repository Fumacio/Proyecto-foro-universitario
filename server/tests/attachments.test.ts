import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { cleanupAttachments } from '../src/lib/attachments.js';
import { contentDisposition, FILES_DIR, sanitizeFilename } from '../src/lib/files.js';
import { anon, createCommunity, prisma, resetDb, userAndAgent, type Agent } from './helpers.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(24)]);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');
const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(40)]);
const OLE2 = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(40)]);
const RTF = Buffer.from('{\\rtf1\\ansi Hola mundo}');
const RAR = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00, 0, 0]);
const SEVEN_Z = Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x04, 0, 0]);
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(120)]);

let ana: Agent;
let beto: Agent;
let carla: Agent;
let anaId: number;
let communityId: number;

beforeAll(async () => {
  await resetDb();
  let u;
  ({ user: u, agent: ana } = await userAndAgent({ username: 'ana_adj' }));
  anaId = u.id;
  ({ agent: beto } = await userAndAgent({ username: 'beto_adj' }));
  ({ agent: carla } = await userAndAgent({ username: 'carla_adj' }));
  communityId = (await createCommunity('apuntes-adj')).id;
});

async function upload(agent: Agent, buf: Buffer, filename: string, contentType = 'application/octet-stream') {
  return agent.post('/api/attachments').attach('file', buf, { filename, contentType });
}

async function uploadOk(agent: Agent, buf: Buffer, filename: string): Promise<{ id: number; filename: string; kind: string; mimeType: string }> {
  const res = await upload(agent, buf, filename);
  if (res.status !== 201) throw new Error(`upload ${filename}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.attachment;
}

const storedPath = async (id: number) => {
  const row = await prisma.attachment.findUniqueOrThrow({ where: { id } });
  return path.join(FILES_DIR, row.storedName);
};

describe('POST /attachments', () => {
  it('requiere sesión', async () => {
    const res = await anon().post('/api/attachments').attach('file', PDF, { filename: 'a.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(401);
  });

  it.each([
    ['foto.png', PNG, 'IMAGE', 'image/png'],
    ['foto.JPG', JPG, 'IMAGE', 'image/jpeg'],
    ['anim.gif', GIF, 'IMAGE', 'image/gif'],
    ['foto.webp', WEBP, 'IMAGE', 'image/webp'],
    ['Resumen.pdf', PDF, 'PDF', 'application/pdf'],
    ['informe.docx', ZIP, 'DOCUMENT', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['viejo.doc', OLE2, 'DOCUMENT', 'application/msword'],
    ['texto.odt', ZIP, 'DOCUMENT', 'application/vnd.oasis.opendocument.text'],
    ['carta.rtf', RTF, 'DOCUMENT', 'application/rtf'],
    ['notas.xlsx', ZIP, 'SPREADSHEET', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['notas.xls', OLE2, 'SPREADSHEET', 'application/vnd.ms-excel'],
    ['datos.csv', Buffer.from('a,b\n1,2\n'), 'SPREADSHEET', 'text/csv'],
    ['clase.pptx', ZIP, 'PRESENTATION', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    ['clase.ppt', OLE2, 'PRESENTATION', 'application/vnd.ms-powerpoint'],
    ['tp.zip', ZIP, 'ARCHIVE', 'application/zip'],
    ['tp.rar', RAR, 'ARCHIVE', 'application/vnd.rar'],
    ['tp.7z', SEVEN_Z, 'ARCHIVE', 'application/x-7z-compressed'],
    ['leeme.txt', Buffer.from('Hola, ¿qué tal? ñandú\n'), 'TEXT', 'text/plain'],
    ['main.c', Buffer.from('#include <stdio.h>\nint main(void){return 0;}\n'), 'TEXT', 'text/plain'],
    ['nb.ipynb', Buffer.from('{"cells": []}'), 'TEXT', 'text/plain'],
    ['pagina.html', Buffer.from('<script>alert(1)</script>'), 'TEXT', 'text/plain'],
  ])('acepta %s', async (filename, buf, kind, mimeType) => {
    const res = await upload(ana, buf, filename);
    expect(res.status).toBe(201);
    expect(res.body.attachment).toMatchObject({ filename, kind, mimeType, size: buf.length, downloadCount: 0 });
    const a = res.body.attachment;
    expect(a.url).toBe(`/api/attachments/${a.id}/download`);
    expect(a.previewUrl).toBe(kind === 'IMAGE' || kind === 'PDF' ? `/api/attachments/${a.id}/view` : null);
    expect(fs.existsSync(await storedPath(a.id))).toBe(true);
  });

  it.each([
    ['un .exe renombrado a .pdf', EXE, 'programa.pdf', /no corresponde/],
    ['HTML disfrazado de PDF', Buffer.from('<html><script>alert(1)</script></html>'), 'apunte.pdf', /no corresponde/],
    ['un SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'dibujo.svg', /no permitido/],
    ['un SVG renombrado a .png', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'dibujo.png', /no corresponde/],
    ['un .exe', EXE, 'setup.exe', /no permitido/],
    ['un archivo sin extensión', PDF, 'apunte', /no permitido/],
    ['texto con bytes nulos', Buffer.from('hola\u0000mundo'), 'raro.txt', /no corresponde/],
    ['texto que no es UTF-8', Buffer.from([0x48, 0x6f, 0x6c, 0x61, 0xff, 0xfe, 0x41]), 'latin.txt', /no corresponde/],
    ['un docx que no es zip', Buffer.from('no soy un docx'), 'trucho.docx', /no corresponde/],
  ])('rechaza %s', async (_label, buf, filename, message) => {
    const before = fs.readdirSync(FILES_DIR).length;
    const res = await upload(ana, buf, filename);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION');
    expect(res.body.error).toMatch(message);
    expect(res.body.details.file).toBeDefined();
    expect(fs.readdirSync(FILES_DIR).length).toBe(before); // no queda basura en disco
  });

  it('rechaza archivos vacíos, sin campo file y de más de MAX_UPLOAD_MB', async () => {
    expect((await upload(ana, Buffer.alloc(0), 'vacio.txt')).status).toBe(400);
    const none = await ana.post('/api/attachments').field('nada', '1');
    expect(none.status).toBe(400);
    expect(none.body.details.file).toBeDefined();

    const before = fs.readdirSync(FILES_DIR).length;
    const big = await upload(ana, Buffer.concat([PDF, Buffer.alloc(1024 * 1024)]), 'grande.pdf');
    expect(big.status).toBe(400);
    expect(big.body.error).toBe('El archivo supera el máximo de 1 MB');
    expect(fs.readdirSync(FILES_DIR).length).toBe(before);
  });

  it('cuota diaria por usuario (429 al pasarse)', async () => {
    const { agent } = await userAndAgent({ username: 'sube_mucho' });
    const chunk = Buffer.alloc(1_000_000, 'a');
    for (let i = 0; i < 3; i++) expect((await upload(agent, chunk, `parte${i}.txt`)).status).toBe(201);
    const over = await upload(agent, chunk, 'parte4.txt');
    expect(over.status).toBe(429);
    expect(over.body.code).toBe('RATE_LIMIT');
    expect(over.body.error).toMatch(/3 MB/);
  });

  it('nombre original con acentos y saneado', async () => {
    const res = await upload(ana, PDF, 'Análisis – Límites.pdf');
    expect(res.status).toBe(201);
    expect(res.body.attachment.filename).toBe('Análisis – Límites.pdf');
  });
});

describe('saneado de nombres y Content-Disposition', () => {
  it('saca rutas, caracteres de control/bidi y limita a 120 conservando la extensión', () => {
    expect(sanitizeFilename('../../etc/passwd.txt')).toBe('passwd.txt');
    expect(sanitizeFilename('C:\\Users\\ana\\Parcial 1.docx')).toBe('Parcial 1.docx');
    expect(sanitizeFilename('foto\u202Egnp.exe')).toBe('fotognp.exe');
    expect(sanitizeFilename('ma\u0000l\u0007o.pdf')).toBe('malo.pdf');
    expect(sanitizeFilename('  ...oculto.txt  ')).toBe('oculto.txt');
    expect(sanitizeFilename('a<b>:c|d?.txt')).toBe('a_b__c_d_.txt');
    expect(sanitizeFilename('.pdf')).toBe('pdf');
    const long = sanitizeFilename(`${'x'.repeat(300)}.pdf`);
    expect(long).toHaveLength(120);
    expect(long.endsWith('.pdf')).toBe(true);
  });

  it('fallback ASCII + filename* UTF-8', () => {
    expect(contentDisposition('attachment', 'Análisis – Límites (v2).pdf')).toBe(
      `attachment; filename="Analisis _ Limites (v2).pdf"; filename*=UTF-8''An%C3%A1lisis%20%E2%80%93%20L%C3%ADmites%20%28v2%29.pdf`,
    );
    expect(contentDisposition('inline', 'a"b\\c.png')).toBe(`inline; filename="a_b_c.png"; filename*=UTF-8''a%22b%5Cc.png`);
  });
});

describe('descarga y vista previa', () => {
  let pdfId: number;
  let txtId: number;

  beforeAll(async () => {
    const pdf = await uploadOk(ana, PDF, 'Resumen Análisis.pdf');
    const txt = await uploadOk(ana, Buffer.from('<h1>no me renderices</h1>'), 'notas.html');
    pdfId = pdf.id;
    txtId = txt.id;
    const post = await ana.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Con archivos', body: 'x', attachmentIds: [pdfId, txtId] });
    expect(post.status).toBe(201);
  });

  it('download: attachment, nosniff, CSP sandbox, cache privada y suma downloadCount', async () => {
    const res = await anon().get(`/api/attachments/${pdfId}/download`).buffer(true);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe(
      `attachment; filename="Resumen Analisis.pdf"; filename*=UTF-8''Resumen%20An%C3%A1lisis.pdf`,
    );
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBe('sandbox');
    expect(res.headers['cache-control']).toBe('private, max-age=3600');
    expect(Buffer.compare(res.body as Buffer, PDF)).toBe(0);
    await anon().get(`/api/attachments/${pdfId}/download`);
    const detail = await anon().get(`/api/posts/${(await prisma.attachment.findUniqueOrThrow({ where: { id: pdfId } })).postId}`);
    expect(detail.body.post.attachments.find((a: { id: number }) => a.id === pdfId).downloadCount).toBe(2);
  });

  it('los de texto/código siempre se bajan como text/plain attachment', async () => {
    const res = await anon().get(`/api/attachments/${txtId}/download`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(res.headers['content-disposition']).toMatch(/^attachment;/);
    expect(res.headers['content-security-policy']).toBe('sandbox');
  });

  it('view: inline solo para IMAGE y PDF', async () => {
    const pdf = await anon().get(`/api/attachments/${pdfId}/view`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-disposition']).toMatch(/^inline; filename="Resumen Analisis.pdf"/);
    expect(pdf.headers['x-content-type-options']).toBe('nosniff');
    expect(pdf.headers['content-security-policy']).toMatch(/default-src 'none'/);
    expect((await anon().get(`/api/attachments/${txtId}/view`)).status).toBe(404);

    const img = await uploadOk(ana, PNG, 'foto.png');
    const own = await ana.get(`/api/attachments/${img.id}/view`);
    expect(own.status).toBe(200);
    expect(own.headers['content-type']).toBe('image/png');
    expect(own.headers['content-security-policy']).toBe('sandbox');
  });

  it('un adjunto suelto solo lo ve quien lo subió; ids inexistentes → 404', async () => {
    const loose = await uploadOk(ana, PDF, 'suelto.pdf');
    expect((await ana.get(`/api/attachments/${loose.id}/download`)).status).toBe(200);
    expect((await beto.get(`/api/attachments/${loose.id}/download`)).status).toBe(404);
    expect((await anon().get(`/api/attachments/${loose.id}/download`)).status).toBe(404);
    expect((await anon().get('/api/attachments/999999/download')).status).toBe(404);
  });

  it('los archivos no se pueden pedir por el estático /uploads', async () => {
    const row = await prisma.attachment.findUniqueOrThrow({ where: { id: pdfId } });
    expect((await anon().get(`/uploads/files/${row.storedName}`)).status).toBe(404);
    expect((await anon().get(`/uploads/%66iles/${row.storedName}`)).status).toBe(404);
    expect((await anon().get(`/uploads/files%2F${row.storedName}`)).status).toBe(404);
  });
});

describe('adjuntos en posts', () => {
  it('attachmentIds en POST/PATCH, attachmentCount, hasAttachments y borrado en cascada', async () => {
    const a = await uploadOk(ana, PDF, 'uno.pdf');
    const b = await uploadOk(ana, ZIP, 'dos.zip');
    const c = await uploadOk(ana, Buffer.from('tres'), 'tres.txt');
    const created = await ana.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Post con adjuntos', body: 'x', attachmentIds: [a.id, b.id] });
    expect(created.status).toBe(201);
    const postId = created.body.post.id;
    expect(created.body.post.attachments.map((x: { id: number }) => x.id)).toEqual([a.id, b.id]);
    expect(created.body.post.attachmentCount).toBe(2);

    await ana.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Post sin adjuntos', body: 'x' });
    const feed = await anon().get('/api/posts?sort=new');
    const item = feed.body.items.find((p: { id: number }) => p.id === postId);
    expect(item.attachmentCount).toBe(2);
    expect(item.attachments).toBeUndefined();
    const withFiles = await anon().get('/api/posts?hasAttachments=true&sort=new');
    expect(withFiles.body.items.every((p: { attachmentCount: number }) => p.attachmentCount > 0)).toBe(true);
    expect(withFiles.body.items.some((p: { id: number }) => p.id === postId)).toBe(true);
    expect(withFiles.body.items.some((p: { title: string }) => p.title === 'Post sin adjuntos')).toBe(false);

    // PATCH reemplaza la lista: el quitado se borra (fila y archivo).
    const fileB = await storedPath(b.id);
    const patched = await ana.patch(`/api/posts/${postId}`).send({ attachmentIds: [a.id, c.id] });
    expect(patched.status).toBe(200);
    expect(patched.body.post.attachments.map((x: { id: number }) => x.id)).toEqual([a.id, c.id]);
    expect(fs.existsSync(fileB)).toBe(false);
    expect(await prisma.attachment.findUnique({ where: { id: b.id } })).toBeNull();

    // Borrar el post borra los archivos.
    const fileA = await storedPath(a.id);
    const fileC = await storedPath(c.id);
    expect((await ana.delete(`/api/posts/${postId}`)).status).toBe(204);
    expect(fs.existsSync(fileA)).toBe(false);
    expect(fs.existsSync(fileC)).toBe(false);
    expect(await prisma.attachment.count({ where: { id: { in: [a.id, c.id] } } })).toBe(0);
  });

  it('no se puede adjuntar un archivo ajeno ni uno que ya está en uso; máximo 10', async () => {
    const mine = await uploadOk(ana, PDF, 'mio.pdf');
    const res = await beto.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Robando', body: 'x', attachmentIds: [mine.id] });
    expect(res.status).toBe(400);
    expect(res.body.details.attachmentIds).toBeDefined();
    expect(await prisma.post.count({ where: { title: 'Robando' } })).toBe(0); // la transacción se revierte

    const ok = await ana.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Primero', body: 'x', attachmentIds: [mine.id] });
    expect(ok.status).toBe(201);
    const again = await ana.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Segundo', body: 'x', attachmentIds: [mine.id] });
    expect(again.status).toBe(400);
    const tooMany = await ana.post('/api/posts').send({
      communityId,
      type: 'TEXT',
      title: 'Muchos',
      body: 'x',
      attachmentIds: Array.from({ length: 11 }, (_, i) => i + 1),
    });
    expect(tooMany.status).toBe(400);
  });

  it('DELETE /attachments/:id: solo quien lo subió (o mod) y borra el archivo', async () => {
    const a = await uploadOk(ana, PDF, 'borrame.pdf');
    const file = await storedPath(a.id);
    expect((await beto.delete(`/api/attachments/${a.id}`)).status).toBe(403);
    expect((await ana.delete(`/api/attachments/${a.id}`)).status).toBe(204);
    expect(fs.existsSync(file)).toBe(false);
    expect((await ana.delete(`/api/attachments/${a.id}`)).status).toBe(404);

    const b = await uploadOk(beto, PDF, 'de-beto.pdf');
    const { agent: mod } = await userAndAgent({ username: 'mod_adj', role: 'MODERATOR' });
    expect((await mod.delete(`/api/attachments/${b.id}`)).status).toBe(204);
  });
});

describe('adjuntos en comentarios', () => {
  it('crear, editar (reemplaza) y el borrado (soft) borra los archivos', async () => {
    const post = await ana.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Para comentar', body: 'x' });
    const postId = post.body.post.id;
    const a = await uploadOk(beto, Buffer.from('int main(){}'), 'sol.c');
    const b = await uploadOk(beto, PNG, 'captura.png');
    const created = await beto.post(`/api/posts/${postId}/comments`).send({ body: 'Mi solución', attachmentIds: [a.id] });
    expect(created.status).toBe(201);
    const commentId = created.body.comment.id;
    expect(created.body.comment.attachments).toMatchObject([{ id: a.id, filename: 'sol.c', kind: 'TEXT' }]);

    const tree = await anon().get(`/api/posts/${postId}/comments`);
    expect(tree.body.items[0].attachments).toHaveLength(1);
    expect((await anon().get(`/api/attachments/${a.id}/download`)).status).toBe(200);

    const fileA = await storedPath(a.id);
    const edited = await beto.patch(`/api/comments/${commentId}`).send({ body: 'Mi solución (con captura)', attachmentIds: [b.id] });
    expect(edited.status).toBe(200);
    expect(edited.body.comment.attachments.map((x: { id: number }) => x.id)).toEqual([b.id]);
    expect(fs.existsSync(fileA)).toBe(false);

    const tooMany = await beto.post(`/api/posts/${postId}/comments`).send({ body: 'x', attachmentIds: [1, 2, 3, 4, 5, 6] });
    expect(tooMany.status).toBe(400);

    const fileB = await storedPath(b.id);
    expect((await beto.delete(`/api/comments/${commentId}`)).status).toBe(204);
    expect(fs.existsSync(fileB)).toBe(false);
    const after = await anon().get(`/api/posts/${postId}/comments`);
    expect(after.body.items[0]).toMatchObject({ isDeleted: true, attachments: [], reactions: [] });
  });
});

describe('adjuntos en mensajes directos', () => {
  it('mensaje solo con adjunto y acceso restringido a los participantes', async () => {
    const conv = (await ana.post('/api/conversations').send({ username: 'beto_adj' })).body.conversation;
    const empty = await ana.post(`/api/conversations/${conv.id}/messages`).send({ body: '' });
    expect(empty.status).toBe(400);
    expect(empty.body.details.body).toBeDefined();

    const a = await uploadOk(ana, PDF, 'privado.pdf');
    const sent = await ana.post(`/api/conversations/${conv.id}/messages`).send({ body: '', attachmentIds: [a.id] });
    expect(sent.status).toBe(201);
    expect(sent.body.message).toMatchObject({ body: '', attachments: [{ id: a.id, filename: 'privado.pdf', kind: 'PDF' }] });

    const list = await beto.get(`/api/conversations/${conv.id}/messages`);
    expect(list.body.items.at(-1).attachments).toHaveLength(1);
    const convs = await beto.get('/api/conversations');
    expect(convs.body.items[0].lastMessage.body).toBe('📎 privado.pdf');

    expect((await beto.get(`/api/attachments/${a.id}/download`)).status).toBe(200);
    expect((await ana.get(`/api/attachments/${a.id}/view`)).status).toBe(200);
    const outsider = await carla.get(`/api/attachments/${a.id}/download`);
    expect(outsider.status).toBe(403);
    expect(outsider.body.code).toBe('FORBIDDEN');
    expect((await anon().get(`/api/attachments/${a.id}/view`)).status).toBe(403);

    // El adjunto de un DM no se puede reusar en un post.
    const reuse = await ana.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Reuso', body: 'x', attachmentIds: [a.id] });
    expect(reuse.status).toBe(400);
  });
});

describe('limpieza de adjuntos sueltos', () => {
  it('borra los sueltos de más de 24 h (y su archivo), no los que están en uso', async () => {
    const loose = await uploadOk(ana, PDF, 'olvidado.pdf');
    const used = await uploadOk(ana, PDF, 'usado.pdf');
    await ana.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Usa uno', body: 'x', attachmentIds: [used.id] });
    const looseFile = await storedPath(loose.id);
    const usedFile = await storedPath(used.id);

    await cleanupAttachments(Date.now());
    expect(fs.existsSync(looseFile)).toBe(true); // todavía es reciente

    const result = await cleanupAttachments(Date.now() + 25 * 60 * 60 * 1000);
    expect(result.loose).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(looseFile)).toBe(false);
    expect(await prisma.attachment.findUnique({ where: { id: loose.id } })).toBeNull();
    expect(fs.existsSync(usedFile)).toBe(true);
    expect(await prisma.attachment.findUnique({ where: { id: used.id } })).not.toBeNull();
  });

  it('al borrar la cuenta se borran sus adjuntos sueltos y los de sus DMs; los de posts quedan', async () => {
    const { user, agent } = await userAndAgent({ username: 'se_va' });
    const loose = await uploadOk(agent, PDF, 'suelto.pdf');
    const inPost = await uploadOk(agent, PDF, 'en-post.pdf');
    const inDm = await uploadOk(agent, PDF, 'en-dm.pdf');
    await agent.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Me voy', body: 'x', attachmentIds: [inPost.id] });
    const conv = (await agent.post('/api/conversations').send({ username: 'ana_adj' })).body.conversation;
    await agent.post(`/api/conversations/${conv.id}/messages`).send({ body: 'chau', attachmentIds: [inDm.id] });
    const files = await Promise.all([loose.id, inPost.id, inDm.id].map(storedPath));

    expect((await agent.delete('/api/users/me').send({ password: 'Password123' })).status).toBe(204);
    expect(fs.existsSync(files[0]!)).toBe(false);
    expect(fs.existsSync(files[1]!)).toBe(true);
    expect(fs.existsSync(files[2]!)).toBe(false);
    const kept = await prisma.attachment.findUniqueOrThrow({ where: { id: inPost.id } });
    expect(kept.uploaderId).toBeNull();
    expect(user.id).not.toBe(anaId);
  });
});
