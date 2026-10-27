import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { env } from '../env.js';

const keyByUserOrIp = (req: Request): string => (req.user ? `u:${req.user.id}` : `ip:${ipKeyGenerator(req.ip ?? '')}`);

function limiter(opts: {
  windowMs: number;
  limit: number;
  message: string;
  skipSuccessfulRequests?: boolean;
  byUser?: boolean;
}): RequestHandler {
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: opts.skipSuccessfulRequests ?? false,
    skip: () => env.isTest,
    ...(opts.byUser ? { keyGenerator: keyByUserOrIp } : {}),
    handler: (_req, res) => {
      res.status(429).json({ error: opts.message, code: 'RATE_LIMIT' });
    },
  });
}

const MIN = 60 * 1000;

export const apiLimiter = limiter({
  windowMs: 15 * MIN,
  limit: 1000,
  message: 'Demasiadas solicitudes. Esperá unos minutos y volvé a intentar.',
});

export const authLimiter = limiter({
  windowMs: 15 * MIN,
  limit: 20,
  skipSuccessfulRequests: true,
  message: 'Demasiados intentos fallidos. Esperá 15 minutos y volvé a intentar.',
});

export const forgotPasswordLimiter = limiter({
  windowMs: 60 * MIN,
  limit: 5,
  message: 'Ya pediste varios links de recuperación. Probá de nuevo en una hora.',
});

export const postLimiter = limiter({
  windowMs: MIN,
  limit: 8,
  byUser: true,
  message: 'Estás publicando muy rápido. Esperá un minuto.',
});

export const commentLimiter = limiter({
  windowMs: MIN,
  limit: 20,
  byUser: true,
  message: 'Estás comentando muy rápido. Esperá un minuto.',
});

export const messageLimiter = limiter({
  windowMs: MIN,
  limit: 40,
  byUser: true,
  message: 'Estás enviando mensajes muy rápido. Esperá un minuto.',
});

export const voteLimiter = limiter({
  windowMs: MIN,
  limit: 120,
  byUser: true,
  message: 'Demasiados votos seguidos. Esperá un minuto.',
});

export const actionLimiter = limiter({
  windowMs: MIN,
  limit: 30,
  byUser: true,
  message: 'Demasiadas acciones seguidas. Esperá un minuto.',
});
