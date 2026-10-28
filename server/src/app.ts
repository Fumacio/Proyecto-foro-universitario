import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express, { type RequestHandler } from 'express';
import helmet from 'helmet';
import { env } from './env.js';
import { loadUser } from './middleware/auth.js';
import { apiNotFound, errorHandler } from './middleware/error.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { PUBLIC_UPLOAD_PATH_RE } from './lib/upload.js';
import adminRoutes from './routes/admin.js';
import attachmentRoutes from './routes/attachments.js';
import authRoutes from './routes/auth.js';
import commentRoutes from './routes/comments.js';
import communityRoutes from './routes/communities.js';
import conversationRoutes from './routes/conversations.js';
import draftRoutes from './routes/drafts.js';
import miscRoutes from './routes/misc.js';
import notificationRoutes from './routes/notifications.js';
import postRoutes from './routes/posts.js';
import reportRoutes from './routes/reports.js';
import streamRoutes from './routes/stream.js';
import tagRoutes from './routes/tags.js';
import userRoutes from './routes/users.js';

/** CORS solo para desarrollo, si el front corre en otro origen (p. ej. Vite sin proxy). */
const devCors: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;
  if (env.isProd || !origin || origin !== env.FRONTEND_URL) return next();
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.vary('Origin');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] ?? 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
    res.status(204).end();
    return;
  }
  next();
};

const isStream = (url: string) => url === '/api/stream' || url.startsWith('/api/stream?') || url.startsWith('/api/stream/');

/** Archivos de la PWA que nunca se cachean (si no, los clientes quedan con una versión vieja). */
const NO_CACHE_FILES = new Set(['index.html', 'sw.js', 'manifest.webmanifest']);

export interface AppOptions {
  /** Build del front a servir (default env.WEB_DIST). */
  webDist?: string;
}

export function createApp(options: AppOptions = {}): express.Express {
  const webDist = options.webDist ?? env.WEB_DIST;
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY !== false) app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    helmet({
      contentSecurityPolicy: env.isProd
        ? {
            useDefaults: true,
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:'],
              fontSrc: ["'self'", 'data:'],
              connectSrc: ["'self'"],
              workerSrc: ["'self'"],
              manifestSrc: ["'self'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              frameAncestors: ["'none'"],
              upgradeInsecureRequests: null,
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      strictTransportSecurity: env.isProd && env.COOKIE_SECURE,
    }),
  );
  // SSE no se comprime: la compresión bufferea y los eventos no llegarían en vivo.
  app.use(compression({ filter: (req, res) => !isStream(req.originalUrl) && compression.filter(req, res) }));
  app.use(devCors);
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());

  // Imágenes subidas: nombres aleatorios e inmutables → cache larga. Solo imágenes de la raíz:
  // los adjuntos (UPLOAD_DIR/files) nunca se sirven por acá, solo por /api/attachments/:id/*.
  app.use(
    '/uploads',
    (req, res, next) => {
      let p: string;
      try {
        p = decodeURIComponent(req.path);
      } catch {
        p = '';
      }
      if ((req.method !== 'GET' && req.method !== 'HEAD') || !PUBLIC_UPLOAD_PATH_RE.test(p)) {
        res.status(404).end();
        return;
      }
      next();
    },
    express.static(env.UPLOAD_DIR, { index: false, dotfiles: 'deny', maxAge: '365d', immutable: true, fallthrough: true }),
    (_req, res) => {
      res.status(404).end();
    },
  );

  const api = express.Router();
  api.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  api.use(apiLimiter);
  api.use(loadUser);
  api.use('/auth', authRoutes);
  api.use('/users', userRoutes);
  api.use('/communities', communityRoutes);
  api.use('/tags', tagRoutes);
  api.use('/posts', postRoutes);
  api.use('/', commentRoutes); // /posts/:id/comments y /comments/:id
  api.use('/notifications', notificationRoutes);
  api.use('/conversations', conversationRoutes);
  api.use('/attachments', attachmentRoutes);
  api.use('/drafts', draftRoutes);
  api.use('/stream', streamRoutes);
  api.use('/reports', reportRoutes);
  api.use('/admin', adminRoutes);
  api.use('/', miscRoutes); // /uploads/image, /search, /stats, /health
  api.use(apiNotFound);
  app.use('/api', api);

  // Producción: si existe el build del front, se sirve con fallback SPA.
  const indexHtml = path.join(webDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(
      express.static(webDist, {
        index: false,
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          const rel = path.relative(webDist, filePath);
          if (NO_CACHE_FILES.has(rel)) {
            res.setHeader('Cache-Control', 'no-cache');
            if (rel === 'manifest.webmanifest') res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
            if (rel === 'sw.js') res.setHeader('Service-Worker-Allowed', '/');
          } else if (rel.startsWith(`assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );
    app.use((req, res, next) => {
      if (
        (req.method !== 'GET' && req.method !== 'HEAD') ||
        req.path.startsWith('/api') ||
        req.path.startsWith('/uploads') ||
        // Un archivo que no existe (p. ej. /sw.js viejo o /assets/x.js) es 404, no el index.html.
        /\.[A-Za-z0-9]{1,12}$/.test(req.path)
      ) {
        next();
        return;
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
    app.use((req, res, next) => {
      if ((req.method === 'GET' || req.method === 'HEAD') && !req.path.startsWith('/api')) {
        res.status(404).type('text/plain; charset=utf-8').send('No encontrado');
        return;
      }
      next();
    });
  } else if (!env.isTest) {
    app.get('/', (_req, res) => {
      res
        .type('text/plain; charset=utf-8')
        .send(`API del Foro UTN funcionando en /api.\nEn desarrollo el front corre en ${env.FRONTEND_URL} (npm run dev).\n`);
    });
  }

  app.use(errorHandler);
  return app;
}
