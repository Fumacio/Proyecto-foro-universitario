import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

let dist: string;
let web: ReturnType<typeof request>;

beforeAll(() => {
  dist = fs.mkdtempSync(path.join(os.tmpdir(), 'foro-utn-dist-'));
  fs.mkdirSync(path.join(dist, 'assets'));
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>Foro UTN</title>');
  fs.writeFileSync(path.join(dist, 'offline.html'), '<!doctype html><title>Sin conexión</title>');
  fs.writeFileSync(path.join(dist, 'sw.js'), "self.addEventListener('fetch', () => {});");
  fs.writeFileSync(path.join(dist, 'manifest.webmanifest'), JSON.stringify({ name: 'Foro UTN', start_url: '/' }));
  fs.writeFileSync(path.join(dist, 'assets', 'index-abc123.js'), 'console.log(1)');
  web = request(createApp({ webDist: dist }));
});

afterAll(() => fs.rmSync(dist, { recursive: true, force: true }));

describe('PWA: archivos del front en producción', () => {
  it('sw.js, manifest.webmanifest e index.html con Cache-Control: no-cache', async () => {
    const sw = await web.get('/sw.js');
    expect(sw.status).toBe(200);
    expect(sw.headers['cache-control']).toBe('no-cache');
    expect(sw.headers['content-type']).toMatch(/javascript/);

    const manifest = await web.get('/manifest.webmanifest');
    expect(manifest.status).toBe(200);
    expect(manifest.headers['cache-control']).toBe('no-cache');
    expect(manifest.headers['content-type']).toMatch(/^application\/manifest\+json/);

    const index = await web.get('/index.html');
    expect(index.headers['cache-control']).toBe('no-cache');
    for (const route of ['/', '/p/12/titulo', '/settings?tab=notifications']) {
      const page = await web.get(route);
      expect(page.status).toBe(200);
      expect(page.headers['cache-control']).toBe('no-cache');
      expect(page.text).toContain('<title>Foro UTN</title>');
    }
  });

  it('assets con hash: cache inmutable; archivos inexistentes → 404 (no el index)', async () => {
    const asset = await web.get('/assets/index-abc123.js');
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect((await web.get('/offline.html')).status).toBe(200);
    expect((await web.get('/assets/viejo-999.js')).status).toBe(404);
    expect((await web.get('/no-existe.png')).status).toBe(404);
    expect((await web.get('/api/no-existe')).body.code).toBe('NOT_FOUND');
  });
});
