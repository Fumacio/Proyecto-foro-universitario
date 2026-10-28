import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { testOutbox } from '../src/lib/mailer.js';
import { anon, app, createUser, loginAs, PASSWORD, prisma, resetDb } from './helpers.js';

beforeAll(resetDb);

describe('auth', () => {
  it('registra, devuelve Me y setea la cookie httpOnly', async () => {
    const res = await anon()
      .post('/api/auth/register')
      .send({ username: 'Ana_Dev', email: 'ANA@Test.utn', password: 'clave1234', displayName: 'Ana' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      username: 'Ana_Dev',
      email: 'ana@test.utn',
      displayName: 'Ana',
      role: 'STUDENT',
      karma: 0,
      unreadNotifications: 0,
      unreadMessages: 0,
      ban: null,
      avatarUrl: null,
      bio: null,
      career: null,
    });
    expect(typeof res.body.user.id).toBe('number');
    expect(typeof res.body.user.createdAt).toBe('string');
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/token=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
  });

  it('rechaza usuario o email repetidos (case-insensitive) con 409', async () => {
    const a = await anon().post('/api/auth/register').send({ username: 'ana_dev', email: 'otra@test.utn', password: 'clave1234' });
    expect(a.status).toBe(409);
    expect(a.body.code).toBe('CONFLICT');
    const b = await anon().post('/api/auth/register').send({ username: 'otra_ana', email: 'ana@test.utn', password: 'clave1234' });
    expect(b.status).toBe(409);
  });

  it('errores de validación con formato { error, code, details }', async () => {
    const res = await anon().post('/api/auth/register').send({ username: 'a!', email: 'no-es-mail', password: 'abcdefgh' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION');
    expect(typeof res.body.error).toBe('string');
    expect(Object.keys(res.body.details).sort()).toEqual(['email', 'password', 'username']);
    expect(res.body.details.password).toMatch(/letra y un número/);
  });

  it('JSON mal formado → 400 VALIDATION', async () => {
    const res = await anon().post('/api/auth/login').set('Content-Type', 'application/json').send('{malo');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION');
  });

  it('login con usuario o email, sin importar mayúsculas', async () => {
    const byUser = await anon().post('/api/auth/login').send({ login: 'ANA_DEV', password: 'clave1234' });
    expect(byUser.status).toBe(200);
    expect(byUser.body.user.username).toBe('Ana_Dev');
    const byEmail = await anon().post('/api/auth/login').send({ login: 'Ana@test.utn', password: 'clave1234' });
    expect(byEmail.status).toBe(200);
    const bad = await anon().post('/api/auth/login').send({ login: 'ana_dev', password: 'incorrecta1' });
    expect(bad.status).toBe(401);
    expect(bad.body).toEqual({ error: expect.any(String), code: 'UNAUTHORIZED' });
  });

  it('GET /auth/me: null sin sesión, null y cookie borrada con token inválido', async () => {
    const none = await anon().get('/api/auth/me');
    expect(none.status).toBe(200);
    expect(none.body).toEqual({ user: null });
    const bad = await anon().get('/api/auth/me').set('Cookie', 'token=basura.invalida.123');
    expect(bad.status).toBe(200);
    expect(bad.body.user).toBeNull();
    expect(String(bad.headers['set-cookie'])).toMatch(/token=;/);
  });

  it('logout borra la cookie', async () => {
    const agent = await loginAs('ana_dev', 'clave1234');
    expect((await agent.get('/api/auth/me')).body.user.username).toBe('Ana_Dev');
    const out = await agent.post('/api/auth/logout');
    expect(out.status).toBe(204);
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();
  });

  it('change-password invalida las otras sesiones y renueva la cookie propia', async () => {
    const user = await createUser({ username: 'cambia_pass' });
    const tab1 = await loginAs(user.username);
    const tab2 = await loginAs(user.username);
    const wrong = await tab1.post('/api/auth/change-password').send({ currentPassword: 'nope12345', newPassword: 'NuevaClave9' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.details.currentPassword).toBeDefined();

    const res = await tab1.post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'NuevaClave9' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect((await tab1.get('/api/auth/me')).body.user?.username).toBe('cambia_pass');
    expect((await tab2.get('/api/auth/me')).body.user).toBeNull();
    expect((await anon().post('/api/auth/login').send({ login: 'cambia_pass', password: 'NuevaClave9' })).status).toBe(200);
  });

  it('change-password requiere sesión', async () => {
    const res = await anon().post('/api/auth/change-password').send({ currentPassword: 'a', newPassword: 'b' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('forgot-password + reset-password (token de un solo uso, sube tokenVersion)', async () => {
    const user = await createUser({ username: 'olvidadiza' });
    const session = await loginAs(user.username);
    testOutbox.length = 0;

    const unknown = await anon().post('/api/auth/forgot-password').send({ email: 'nadie@test.utn' });
    expect(unknown.body).toEqual({ ok: true });
    expect(testOutbox).toHaveLength(0);

    const res = await anon().post('/api/auth/forgot-password').send({ email: user.email.toUpperCase() });
    expect(res.body).toEqual({ ok: true });
    await new Promise((r) => setTimeout(r, 20));
    expect(testOutbox).toHaveLength(1);
    const token = /token=([a-f0-9]+)/.exec(testOutbox[0]!.text)?.[1];
    expect(token).toBeDefined();
    expect(testOutbox[0]!.text).toContain('http://localhost:5173/reset-password?token=');

    const stored = await prisma.passwordReset.findFirst({ where: { userId: user.id } });
    expect(stored?.tokenHash).not.toBe(token); // se guarda el hash, no el token

    const weak = await anon().post('/api/auth/reset-password').send({ token, password: 'corta' });
    expect(weak.status).toBe(400);

    const ok = await anon().post('/api/auth/reset-password').send({ token, password: 'Restablecida1' });
    expect(ok.status).toBe(200);
    expect((await session.get('/api/auth/me')).body.user).toBeNull();
    expect((await anon().post('/api/auth/login').send({ login: 'olvidadiza', password: 'Restablecida1' })).status).toBe(200);

    const again = await anon().post('/api/auth/reset-password').send({ token, password: 'OtraClave22' });
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('VALIDATION');
  });

  it('rutas desconocidas de /api → 404 JSON', async () => {
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: expect.any(String), code: 'NOT_FOUND' });
  });

  it('health y stats públicos', async () => {
    expect((await anon().get('/api/health')).body).toEqual({ status: 'ok' });
    const stats = await anon().get('/api/stats');
    expect(stats.body).toEqual({ users: expect.any(Number), posts: 0, comments: 0, communities: 0 });
  });
});
