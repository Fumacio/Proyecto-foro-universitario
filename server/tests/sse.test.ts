import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anon, app, resetDb, userAndAgent, type Agent } from './helpers.js';
import { closeAll } from '../src/lib/sse.js';

let server: http.Server;
let port: number;
let ana: Agent;
let beto: Agent;
let anaCookie: string;

beforeAll(async () => {
  await resetDb();
  ({ agent: ana } = await userAndAgent({ username: 'ana_sse' }));
  ({ agent: beto } = await userAndAgent({ username: 'beto_sse' }));
  const login = await anon().post('/api/auth/login').send({ login: 'ana_sse', password: 'Password123' });
  anaCookie = String(login.headers['set-cookie']).split(';')[0]!;
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  closeAll();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

interface Stream {
  res: http.IncomingMessage;
  waitFor: (event: string) => Promise<unknown>;
  close: () => void;
}

function openStream(cookie: string): Promise<Stream> {
  return new Promise((resolve, reject) => {
    const req = http.get({ port, path: '/api/stream', headers: { cookie, 'accept-encoding': 'gzip, deflate, br' } }, (res) => {
      let buffer = '';
      const waiters: { event: string; resolve: (data: unknown) => void }[] = [];
      const flush = () => {
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const event = /^event: (.+)$/m.exec(chunk)?.[1];
          const data = /^data: (.+)$/m.exec(chunk)?.[1];
          if (!event || !data) continue;
          const i = waiters.findIndex((w) => w.event === event);
          if (i !== -1) waiters.splice(i, 1)[0]!.resolve(JSON.parse(data));
          else pending.push({ event, data: JSON.parse(data) });
        }
      };
      const pending: { event: string; data: unknown }[] = [];
      res.setEncoding('utf8');
      res.on('data', (d: string) => {
        buffer += d;
        flush();
      });
      resolve({
        res,
        waitFor: (event) =>
          new Promise((ok, fail) => {
            const i = pending.findIndex((p) => p.event === event);
            if (i !== -1) return ok(pending.splice(i, 1)[0]!.data);
            waiters.push({ event, resolve: ok });
            setTimeout(() => fail(new Error(`timeout esperando "${event}"`)), 3000);
          }),
        close: () => req.destroy(),
      });
    });
    req.on('error', reject);
  });
}

describe('GET /api/stream', () => {
  it('401 sin sesión', async () => {
    const res = await anon().get('/api/stream');
    expect(res.status).toBe(401);
  });

  it('headers SSE sin compresión y eventos en vivo', async () => {
    const stream = await openStream(anaCookie);
    expect(stream.res.statusCode).toBe(200);
    expect(stream.res.headers['content-type']).toBe('text/event-stream');
    expect(stream.res.headers['cache-control']).toBe('no-cache, no-transform');
    expect(stream.res.headers['x-accel-buffering']).toBe('no');
    expect(stream.res.headers['content-encoding']).toBeUndefined();

    expect(await stream.waitFor('unread')).toEqual({ notifications: 0, messages: 0 });

    await beto.post('/api/users/ana_sse/follow');
    const notification = (await stream.waitFor('notification')) as { type: string; actor: { username: string } };
    expect(notification).toMatchObject({ type: 'FOLLOW', read: false, actor: { username: 'beto_sse' } });
    expect(await stream.waitFor('unread')).toEqual({ notifications: 1, messages: 0 });

    const conv = (await beto.post('/api/conversations').send({ username: 'ana_sse' })).body.conversation;
    await beto.post(`/api/conversations/${conv.id}/messages`).send({ body: '¡Hola por SSE!' });
    const message = (await stream.waitFor('message')) as { body: string; conversationId: number };
    expect(message).toMatchObject({ body: '¡Hola por SSE!', conversationId: conv.id, sender: { username: 'beto_sse' }, attachments: [] });
    expect(await stream.waitFor('unread')).toEqual({ notifications: 1, messages: 1 });

    // El emisor también recibe su mensaje (otras pestañas)
    await ana.post(`/api/conversations/${conv.id}/read`);
    expect(await stream.waitFor('unread')).toEqual({ notifications: 1, messages: 0 });
    await ana.post(`/api/conversations/${conv.id}/messages`).send({ body: 'Te leo' });
    expect(await stream.waitFor('message')).toMatchObject({ body: 'Te leo' });

    stream.close();
  });
});
