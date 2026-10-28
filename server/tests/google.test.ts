import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../src/env.js';
import { flushEmails } from '../src/lib/emailNotify.js';
import { safeNext, usernameBaseFromEmail } from '../src/lib/google.js';
import { testOutbox } from '../src/lib/mailer.js';
import { anon, app, createUser, prisma, resetDb, type Agent } from './helpers.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

/** Perfiles que devuelve el userinfo falso, indexados por `code`. */
const profiles: Record<string, Record<string, unknown>> = {};
const tokenRequests: URLSearchParams[] = [];
let fake: http.Server;
let base: string;

beforeAll(async () => {
  await resetDb();
  fake = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (req.method === 'POST' && url.pathname === '/token') {
      let body = '';
      req.on('data', (c: Buffer) => (body += c.toString()));
      req.on('end', () => {
        const form = new URLSearchParams(body);
        tokenRequests.push(form);
        const code = form.get('code') ?? '';
        if (form.get('client_secret') !== 'secreto-test' || !profiles[code]) {
          res.writeHead(400, { 'Content-Type': 'application/json' }).end('{"error":"invalid_grant"}');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ access_token: `at-${code}`, token_type: 'Bearer' }));
      });
      return;
    }
    if (url.pathname === '/userinfo') {
      const code = (req.headers.authorization ?? '').replace(/^Bearer at-/, '');
      const profile = profiles[code];
      if (!profile) {
        res.writeHead(401).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(profile));
      return;
    }
    if (url.pathname === '/foto.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' }).end(PNG);
      return;
    }
    res.writeHead(404).end();
  });
  fake.listen(0);
  await new Promise<void>((resolve) => fake.once('listening', () => resolve()));
  base = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;
});

afterAll(async () => {
  for (const k of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_AUTH_URL', 'GOOGLE_TOKEN_URL', 'GOOGLE_USERINFO_URL']) delete process.env[k];
  await new Promise<void>((resolve) => fake.close(() => resolve()));
});

function configure(): void {
  process.env.GOOGLE_CLIENT_ID = 'cliente-test.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'secreto-test';
  process.env.GOOGLE_AUTH_URL = `${base}/auth`;
  process.env.GOOGLE_TOKEN_URL = `${base}/token`;
  process.env.GOOGLE_USERINFO_URL = `${base}/userinfo`;
}

/** Arranca el flujo (GET /auth/google) y devuelve el agent con la cookie de state y el state. */
async function start(next?: string): Promise<{ agent: Agent; state: string; location: URL }> {
  const agent = request.agent(app);
  const res = await agent.get(`/api/auth/google${next !== undefined ? `?next=${encodeURIComponent(next)}` : ''}`);
  expect(res.status).toBe(302);
  const location = new URL(res.headers.location!);
  return { agent, state: location.searchParams.get('state')!, location };
}

async function callback(agent: Agent, code: string, state: string) {
  return agent.get(`/api/auth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
}

describe('login con Google', () => {
  it('sin credenciales: providers false y /auth/google 404', async () => {
    expect((await anon().get('/api/auth/providers')).body).toEqual({ google: false });
    expect((await anon().get('/api/auth/google')).status).toBe(404);
    const cb = await anon().get('/api/auth/google/callback?code=x&state=y');
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toBe('http://localhost:5173/login?error=google');
  });

  it('GET /auth/google redirige a Google con state aleatorio en cookie httpOnly de 10 min', async () => {
    configure();
    expect((await anon().get('/api/auth/providers')).body).toEqual({ google: true });
    const res = await anon().get('/api/auth/google?next=/p/12');
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.location!);
    expect(`${loc.origin}${loc.pathname}`).toBe(`${base}/auth`);
    expect(loc.searchParams.get('client_id')).toBe('cliente-test.apps.googleusercontent.com');
    expect(loc.searchParams.get('redirect_uri')).toBe('http://localhost:5173/api/auth/google/callback');
    expect(loc.searchParams.get('response_type')).toBe('code');
    expect(loc.searchParams.get('scope')).toBe('openid email profile');
    expect(loc.searchParams.get('state')).toMatch(/^[a-f0-9]{48}$/);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/g_oauth=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Max-Age=600/);
    expect(cookie).toMatch(/Path=\/api\/auth\/google/);
    const again = await anon().get('/api/auth/google');
    expect(new URL(again.headers.location!).searchParams.get('state')).not.toBe(loc.searchParams.get('state'));
  });

  it('crea la cuenta (username del email, sin contraseña, avatar descargado) y redirige a next', async () => {
    configure();
    profiles['nuevo'] = {
      sub: 'google-sub-1',
      email: 'María.José-Pérez+facu@gmail.com',
      email_verified: true,
      name: 'María José Pérez',
      picture: `${base}/foto.png`,
    };
    testOutbox.length = 0;
    const { agent, state } = await start('/p/42?tab=comentarios#c1');
    const res = await callback(agent, 'nuevo', state);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://localhost:5173/p/42?tab=comentarios#c1');
    expect(String(res.headers['set-cookie'])).toMatch(/token=/);
    expect(tokenRequests.at(-1)?.get('redirect_uri')).toBe('http://localhost:5173/api/auth/google/callback');
    expect(tokenRequests.at(-1)?.get('grant_type')).toBe('authorization_code');

    const me = (await agent.get('/api/auth/me')).body.user;
    expect(me).toMatchObject({
      username: 'maria_jose_perez',
      email: 'maría.josé-pérez+facu@gmail.com',
      displayName: 'María José Pérez',
      hasPassword: false,
      googleLinked: true,
      draftCount: 0,
      preferences: { emailReplies: true, emailMentions: true, emailMessages: true, emailFollows: false, emailReactions: false },
    });
    expect(me.avatarUrl).toMatch(/^\/uploads\/[a-f0-9]{32}\.png$/);
    expect(fs.existsSync(path.join(env.UPLOAD_DIR, path.basename(me.avatarUrl)))).toBe(true);

    await flushEmails();
    expect(testOutbox.map((m) => m.subject)).toEqual(['¡Bienvenida/o al Foro UTN! 🎓']);

    // Segundo login: encuentra por googleId (no crea otra cuenta).
    const second = await start();
    const res2 = await callback(second.agent, 'nuevo', second.state);
    expect(res2.headers.location).toBe('http://localhost:5173/');
    expect((await second.agent.get('/api/auth/me')).body.user.id).toBe(me.id);
    expect(await prisma.user.count({ where: { googleId: 'google-sub-1' } })).toBe(1);
  });

  it('vincula por email una cuenta existente y le pone avatar si no tenía', async () => {
    configure();
    const existing = await createUser({ username: 'ana_link', email: 'ana.link@test.utn' });
    profiles['link'] = { sub: 'google-sub-2', email: 'ANA.LINK@test.utn', email_verified: true, name: 'Ana', picture: `${base}/foto.png` };
    const { agent, state } = await start('/settings');
    const res = await callback(agent, 'link', state);
    expect(res.headers.location).toBe('http://localhost:5173/settings');
    const me = (await agent.get('/api/auth/me')).body.user;
    expect(me).toMatchObject({ id: existing.id, username: 'ana_link', hasPassword: true, googleLinked: true, displayName: 'Ana' });
    expect(me.avatarUrl).toMatch(/^\/uploads\//);
    // sigue pudiendo entrar con su contraseña
    expect((await anon().post('/api/auth/login').send({ login: 'ana_link', password: 'Password123' })).status).toBe(200);
  });

  it('username único: agrega dígitos si ya existe', async () => {
    configure();
    await createUser({ username: 'lucas' });
    profiles['lucas'] = { sub: 'google-sub-3', email: 'lucas@gmail.com', email_verified: 'true', name: null };
    const { agent, state } = await start();
    await callback(agent, 'lucas', state);
    expect((await agent.get('/api/auth/me')).body.user).toMatchObject({ username: 'lucas2', displayName: null, avatarUrl: null });
    expect(usernameBaseFromEmail('a@b.com')).toBe('a_utn');
    expect(usernameBaseFromEmail('ñandú.Ñoño_2026@x.com')).toBe('nandu_nono_2026');
    expect(usernameBaseFromEmail('super-larguisimo-nombre-de-usuario@x.com')).toBe('super_larguisimo_nom');
  });

  it('falla → /login?error=google: state distinto, sin cookie, code inválido o email sin verificar', async () => {
    configure();
    profiles['sinverificar'] = { sub: 'google-sub-4', email: 'trucho@gmail.com', email_verified: false, name: 'X' };
    const fail = 'http://localhost:5173/login?error=google';

    const a = await start('/p/1');
    const mismatch = await callback(a.agent, 'nuevo', 'otro-state');
    expect(mismatch.status).toBe(302);
    expect(mismatch.headers.location).toBe(fail);
    expect(String(mismatch.headers['set-cookie'] ?? '')).not.toMatch(/token=[^;]/);
    // el state es de un solo uso: la cookie se borra
    expect((await callback(a.agent, 'nuevo', a.state)).headers.location).toBe(fail);

    const b = await start();
    expect((await anon().get(`/api/auth/google/callback?code=nuevo&state=${b.state}`)).headers.location).toBe(fail);

    const c = await start();
    expect((await callback(c.agent, 'no-existe', c.state)).headers.location).toBe(fail);

    const d = await start();
    expect((await callback(d.agent, 'sinverificar', d.state)).headers.location).toBe(fail);
    expect(await prisma.user.count({ where: { email: 'trucho@gmail.com' } })).toBe(0);

    const e = await start();
    expect((await e.agent.get(`/api/auth/google/callback?error=access_denied&state=${e.state}`)).headers.location).toBe(fail);
  });

  it('next solo acepta rutas internas relativas', async () => {
    expect(safeNext('/c/programacion?x=1')).toBe('/c/programacion?x=1');
    for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', 'evil', '', '/\u0000x', 42, undefined]) expect(safeNext(bad)).toBe('/');
    configure();
    const { agent, state } = await start('//evil.com/x');
    expect((await callback(agent, 'nuevo', state)).headers.location).toBe('http://localhost:5173/');
  });
});

describe('cuentas sin contraseña (Google)', () => {
  it('login con contraseña → 401 con mensaje; change-password sin currentPassword pone una', async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { googleId: 'google-sub-1' } });
    const login = await anon().post('/api/auth/login').send({ login: user.username, password: 'loquesea123' });
    expect(login.status).toBe(401);
    expect(login.body.error).toBe('Esta cuenta usa Google para iniciar sesión');

    configure();
    const { agent, state } = await start();
    await callback(agent, 'nuevo', state);
    const set = await agent.post('/api/auth/change-password').send({ newPassword: 'MiClave2026' });
    expect(set.status).toBe(200);
    expect((await agent.get('/api/auth/me')).body.user.hasPassword).toBe(true);
    expect((await anon().post('/api/auth/login').send({ login: user.username, password: 'MiClave2026' })).status).toBe(200);
    // ahora que tiene contraseña, la actual es obligatoria
    const again = await agent.post('/api/auth/change-password').send({ newPassword: 'OtraClave2026' });
    expect(again.status).toBe(400);
    expect(again.body.details.currentPassword).toBeDefined();
  });

  it('DELETE /users/me con confirmUsername si no tiene contraseña', async () => {
    configure();
    profiles['borrar'] = { sub: 'google-sub-5', email: 'chau@gmail.com', email_verified: true, name: 'Chau' };
    const { agent, state } = await start();
    await callback(agent, 'borrar', state);
    const me = (await agent.get('/api/auth/me')).body.user;
    expect(me.username).toBe('chau');
    const wrong = await agent.delete('/api/users/me').send({ confirmUsername: 'otro' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.details.confirmUsername).toBeDefined();
    expect((await agent.delete('/api/users/me').send({ password: 'x' })).status).toBe(400);
    expect((await agent.delete('/api/users/me').send({ confirmUsername: 'CHAU' })).status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: me.id } })).toBeNull();
  });

  it('con contraseña, DELETE /users/me sigue pidiendo la contraseña', async () => {
    const user = await createUser({ username: 'con_pass' });
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ login: user.username, password: 'Password123' });
    const res = await agent.delete('/api/users/me').send({ confirmUsername: 'con_pass' });
    expect(res.status).toBe(400);
    expect(res.body.details.password).toBeDefined();
  });
});
