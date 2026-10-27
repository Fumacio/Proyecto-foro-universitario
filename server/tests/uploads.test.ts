import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { env } from '../src/env.js';
import { anon, createCommunity, resetDb, userAndAgent, type Agent } from './helpers.js';

// PNG válido de 1x1
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

let agent: Agent;

beforeAll(async () => {
  await resetDb();
  ({ agent } = await userAndAgent({ username: 'sube_fotos' }));
});

const fileOnDisk = (url: string) => path.join(env.UPLOAD_DIR, path.basename(url));

describe('POST /uploads/image', () => {
  it('requiere sesión', async () => {
    const res = await anon().post('/api/uploads/image').attach('file', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
  });

  it('acepta un PNG real, lo guarda con nombre aleatorio y lo sirve con cache larga', async () => {
    const res = await agent.post('/api/uploads/image').attach('file', PNG, { filename: '../../foto.PNG', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^\/uploads\/[a-f0-9]{32}\.png$/);
    expect(fs.existsSync(fileOnDisk(res.body.url))).toBe(true);

    const served = await anon().get(res.body.url);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.headers['cache-control']).toMatch(/max-age=31536000/);
    expect((await anon().get('/uploads/no-existe.png')).status).toBe(404);
  });

  it('rechaza archivos que no son imágenes aunque digan serlo (magic bytes)', async () => {
    const fake = await agent
      .post('/api/uploads/image')
      .attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'x.png', contentType: 'image/png' });
    expect(fake.status).toBe(400);
    expect(fake.body.code).toBe('VALIDATION');
    expect(fake.body.details.file).toBeDefined();

    const pdf = await agent.post('/api/uploads/image').attach('file', Buffer.from('%PDF-1.4'), { filename: 'a.pdf', contentType: 'application/pdf' });
    expect(pdf.status).toBe(400);

    const svg = await agent.post('/api/uploads/image').attach('file', Buffer.from('<svg/>'), { filename: 'a.svg', contentType: 'image/svg+xml' });
    expect(svg.status).toBe(400);
  });

  it('rechaza campo incorrecto, falta de archivo y más de 5 MB', async () => {
    const wrongField = await agent.post('/api/uploads/image').attach('imagen', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(wrongField.status).toBe(400);
    const none = await agent.post('/api/uploads/image').field('nada', '1');
    expect(none.status).toBe(400);
    expect(none.body.details.file).toBeDefined();

    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
    const tooBig = await agent.post('/api/uploads/image').attach('file', big, { filename: 'grande.png', contentType: 'image/png' });
    expect(tooBig.status).toBe(400);
    expect(tooBig.body.error).toMatch(/5 MB/);
  });

  it('la URL subida se puede usar como imageUrl de un post', async () => {
    const { id: communityId } = await createCommunity('apuntes');
    const url = (await agent.post('/api/uploads/image').attach('file', GIF, { filename: 'a.gif', contentType: 'image/gif' })).body.url;
    expect(url).toMatch(/\.gif$/);
    const post = await agent.post('/api/posts').send({ communityId, type: 'TEXT', title: 'Con portada', body: 'x', imageUrl: url });
    expect(post.status).toBe(201);
    expect(post.body.post.imageUrl).toBe(url);
  });
});

describe('avatar', () => {
  it('subir, reemplazar (borra el anterior) y quitar', async () => {
    const first = await agent.post('/api/users/me/avatar').attach('file', PNG, { filename: 'yo.png', contentType: 'image/png' });
    expect(first.status).toBe(200);
    const firstUrl: string = first.body.user.avatarUrl;
    expect(firstUrl).toMatch(/^\/uploads\//);
    expect(fs.existsSync(fileOnDisk(firstUrl))).toBe(true);

    const second = await agent.post('/api/users/me/avatar').attach('file', GIF, { filename: 'yo.gif', contentType: 'image/gif' });
    const secondUrl: string = second.body.user.avatarUrl;
    expect(secondUrl).not.toBe(firstUrl);
    expect(fs.existsSync(fileOnDisk(firstUrl))).toBe(false);

    const bad = await agent.post('/api/users/me/avatar').attach('file', Buffer.from('hola'), { filename: 'yo.jpg', contentType: 'image/jpeg' });
    expect(bad.status).toBe(400);
    expect((await agent.get('/api/auth/me')).body.user.avatarUrl).toBe(secondUrl);

    const removed = await agent.delete('/api/users/me/avatar');
    expect(removed.body.user.avatarUrl).toBeNull();
    expect(fs.existsSync(fileOnDisk(secondUrl))).toBe(false);
  });
});
