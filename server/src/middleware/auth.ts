import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { User } from '@prisma/client';
import { AUTH_COOKIE, clearAuthCookie, verifyToken } from '../lib/auth.js';
import { banned, forbidden, unauthorized } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { isModRole } from '../lib/serializers.js';
import type { Role } from '../lib/types.js';
import { describeBan, getActiveBan } from '../lib/users.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Usuario autenticado, recargado de la DB en cada request (rol y tokenVersion en vivo). */
      user?: User;
    }
  }
}

/** Lee la cookie y carga el usuario. Si el token es inválido, borra la cookie y sigue como anónimo. */
export const loadUser: RequestHandler = async (req, res, next) => {
  const token: unknown = req.cookies?.[AUTH_COOKIE];
  if (typeof token !== 'string' || token === '') return next();
  const payload = verifyToken(token);
  const user = payload ? await prisma.user.findUnique({ where: { id: payload.userId } }) : null;
  if (!user || !payload || user.tokenVersion !== payload.version) {
    clearAuthCookie(res);
    return next();
  }
  req.user = user;
  next();
};

/** Devuelve el usuario de la request o lanza 401. */
export function authUser(req: Request): User {
  if (!req.user) throw unauthorized();
  return req.user;
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  authUser(req);
  next();
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    const user = authUser(req);
    if (!roles.includes(user.role)) throw forbidden();
    next();
  };
}

export const requireMod = requireRole('ADMIN', 'MODERATOR');
export const requireAdmin = requireRole('ADMIN');

export async function assertNotBanned(user: User): Promise<void> {
  const ban = await getActiveBan(user.id);
  if (ban) {
    throw banned(`Tu cuenta está suspendida ${describeBan(ban.expiresAt)}. Motivo: ${ban.reason}`);
  }
}

/** Sesión + sin ban activo: para toda escritura pública (postear, comentar, votar, mensajes, etc.). */
export const requireWriter: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  await assertNotBanned(authUser(req));
  next();
};

export const isMod = (user: User | undefined): boolean => !!user && isModRole(user.role);
