/* Foro UTN — service worker escrito a mano (sin Workbox).
 *
 * - Precache del "shell": /, /offline.html, theme-init.js, favicon e íconos (+ los JS/CSS con hash
 *   que referencia el index.html del build, así la app abre sin conexión).
 * - Navegación: network-first → si no hay red, el / cacheado → /offline.html.
 * - /assets/* (nombres con hash): cache-first.
 * - /uploads/*: stale-while-revalidate.
 * - NUNCA se cachea /api/* (incluye adjuntos privados y el login con Google) ni nada que no sea GET.
 *
 * BUILD_ID lo reemplaza el build de Vite (plugin en vite.config.ts) para que cada deploy sea una
 * versión nueva del SW; la página muestra "Hay una versión nueva — Actualizar" y manda SKIP_WAITING.
 */
const BUILD_ID = '__BUILD_ID__';
const PREFIX = 'foro-utn';
const SHELL_CACHE = `${PREFIX}-shell-${BUILD_ID}`;
const ASSETS_CACHE = `${PREFIX}-assets-${BUILD_ID}`;
const UPLOADS_CACHE = `${PREFIX}-uploads-v1`;
const MAX_UPLOADS = 200;

const PRECACHE = [
  '/',
  '/offline.html',
  '/theme-init.js',
  '/favicon.svg',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await shell.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })));
      try {
        const index = await shell.match('/');
        const html = index ? await index.text() : '';
        const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]))];
        if (assets.length) await (await caches.open(ASSETS_CACHE)).addAll(assets);
      } catch {
        /* si falla, se cachean a medida que se usan */
      }
    })(),
  );
  // Sin skipWaiting(): una actualización espera a que el usuario toque "Actualizar".
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, ASSETS_CACHE, UPLOADS_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith(PREFIX) && !keep.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return; // nunca
  if (url.pathname === '/sw.js') return;

  if (req.mode === 'navigate') {
    event.respondWith(navigation(req));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(req, ASSETS_CACHE));
  } else if (url.pathname.startsWith('/uploads/')) {
    event.respondWith(staleWhileRevalidate(req, event));
  } else if (PRECACHE.includes(url.pathname)) {
    event.respondWith(cacheFirst(req, SHELL_CACHE));
  }
});

async function navigation(req) {
  const shell = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) {
      // Todas las rutas del SPA devuelven el mismo index.html: lo guardamos como "/".
      shell.put('/', res.clone()).catch(() => undefined);
      return res;
    }
    if (res.status >= 500) return (await offlineFallback(shell)) || res;
    return res;
  } catch {
    return (
      (await offlineFallback(shell)) ||
      new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    );
  }
}

async function offlineFallback(shell) {
  return (await shell.match('/')) || (await shell.match('/offline.html'));
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone()).catch(() => undefined);
  return res;
}

async function staleWhileRevalidate(req, event) {
  const cache = await caches.open(UPLOADS_CACHE);
  const hit = await cache.match(req);
  const network = fetch(req)
    .then(async (res) => {
      if (res.ok) {
        await cache.put(req, res.clone());
        await trim(cache, MAX_UPLOADS);
      }
      return res;
    })
    .catch(() => undefined);
  event.waitUntil(network);
  if (hit) return hit;
  return (await network) || Response.error();
}

async function trim(cache, max) {
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}
