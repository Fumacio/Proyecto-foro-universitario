import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { CookieOptions, Response } from 'express';
import { env } from '../env.js';

export const AUTH_COOKIE = 'token';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const BCRYPT_COST = 10;

const baseCookie: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.COOKIE_SECURE,
  path: '/',
};

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

// Hash de referencia para comparar aunque el usuario no exista (evita timing leaks).
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy-password-1', BCRYPT_COST);

export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(password, DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(password, hash);
}

interface TokenPayload {
  sub: string;
  v: number;
}

export function signToken(user: { id: number; tokenVersion: number }): string {
  const payload: TokenPayload = { sub: String(user.id), v: user.tokenVersion };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '30d', algorithm: 'HS256' });
}

export function verifyToken(token: string): { userId: number; version: number } | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof decoded !== 'object' || decoded === null) return null;
    const userId = Number(decoded.sub);
    const version = (decoded as { v?: unknown }).v;
    if (!Number.isSafeInteger(userId) || userId <= 0 || typeof version !== 'number') return null;
    return { userId, version };
  } catch {
    return null;
  }
}

export function setAuthCookie(res: Response, user: { id: number; tokenVersion: number }): void {
  res.cookie(AUTH_COOKIE, signToken(user), { ...baseCookie, maxAge: MAX_AGE_MS });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE, baseCookie);
}
