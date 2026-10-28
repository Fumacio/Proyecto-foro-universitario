import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Carpeta `server/` (funciona igual si se ejecuta desde la raíz del repo). */
export const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const envFile = path.join(SERVER_ROOT, '.env');
if (fs.existsSync(envFile)) {
  // No pisa variables ya definidas (tests, Docker, PaaS).
  config({ path: envFile, quiet: true });
}

const NODE_ENV = process.env.NODE_ENV?.trim() || 'development';
const isProd = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

// Prisma lee DATABASE_URL al construir el cliente: garantizamos un default.
// Las rutas `file:./x.db` son relativas a `prisma/schema.prisma`.
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = 'file:./dev.db';

const PLACEHOLDER_SECRETS = new Set([
  'changeme',
  'changeme-generate-a-strong-random-secret',
  'secret',
  'jwt_secret',
  'your-secret',
]);
const DEV_FALLBACK_SECRET = 'dev-only-insecure-jwt-secret-do-not-use-in-production-0000000000';

function resolveJwtSecret(): string {
  const raw = process.env.JWT_SECRET?.trim() ?? '';
  const weak = raw.length < 32 || PLACEHOLDER_SECRETS.has(raw.toLowerCase());
  if (!weak) return raw;
  if (isProd) {
    console.error(
      '[env] ✘ JWT_SECRET falta o es débil (mínimo 32 caracteres aleatorios) y NODE_ENV=production.\n' +
        "      Generá uno con: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"",
    );
    process.exit(1);
  }
  if (!isTest) {
    console.warn(
      '[env] ⚠ JWT_SECRET falta o es débil: usando un secreto de desarrollo. ' +
        'Corré `npm run db:setup` (crea server/.env) o definilo a mano.',
    );
  }
  return raw.length > 0 && !PLACEHOLDER_SECRETS.has(raw.toLowerCase()) ? raw : DEV_FALLBACK_SECRET;
}

function parseTrustProxy(value: string | undefined): boolean | number | string {
  if (value === undefined || value.trim() === '') return false;
  const v = value.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^\d+$/.test(v)) return Number(v);
  return v; // p. ej. "loopback" o una lista de IPs/subredes
}

const PORT = Number(process.env.PORT) || 3000;

function positiveNumber(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const env = {
  NODE_ENV,
  isProd,
  isTest,
  isDev: !isProd && !isTest,
  PORT,
  FRONTEND_URL: (process.env.FRONTEND_URL?.trim() || (isProd ? `http://localhost:${PORT}` : 'http://localhost:5173')).replace(
    /\/+$/,
    '',
  ),
  JWT_SECRET: resolveJwtSecret(),
  // Cookie `Secure` (solo HTTPS). Por defecto en producción; COOKIE_SECURE=false para servir por HTTP (p. ej. una red local).
  COOKIE_SECURE: process.env.COOKIE_SECURE?.trim() ? process.env.COOKIE_SECURE.trim() !== 'false' : isProd,
  TRUST_PROXY: parseTrustProxy(process.env.TRUST_PROXY),
  SMTP: {
    host: process.env.SMTP_HOST?.trim() || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER?.trim() || '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM?.trim() || 'Foro UTN <no-reply@foro.utn>',
  },
  UPLOAD_DIR: path.resolve(SERVER_ROOT, process.env.UPLOAD_DIR?.trim() || 'uploads'),
  /** Tamaño máximo por archivo adjunto (MB). */
  MAX_UPLOAD_MB: positiveNumber(process.env.MAX_UPLOAD_MB, 25),
  /** Cuota de adjuntos por usuario cada 24 h (MB). */
  UPLOAD_QUOTA_MB_PER_DAY: positiveNumber(process.env.UPLOAD_QUOTA_MB_PER_DAY, 200),
  /** Build del front que se sirve en producción (por defecto ../web/dist). */
  WEB_DIST: path.resolve(SERVER_ROOT, process.env.WEB_DIST?.trim() || '../web/dist'),
} as const;

/**
 * Login con Google. Se lee en cada uso (no al arrancar) para que los tests puedan apuntar los
 * endpoints a un servidor OAuth falso. Los endpoints se pueden sobreescribir con GOOGLE_*_URL.
 */
export function googleConfig(): {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  redirectUri: string;
} {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? '';
  return {
    enabled: clientId !== '' && clientSecret !== '',
    clientId,
    clientSecret,
    authUrl: process.env.GOOGLE_AUTH_URL?.trim() || 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: process.env.GOOGLE_TOKEN_URL?.trim() || 'https://oauth2.googleapis.com/token',
    userinfoUrl: process.env.GOOGLE_USERINFO_URL?.trim() || 'https://openidconnect.googleapis.com/v1/userinfo',
    redirectUri: `${env.FRONTEND_URL}/api/auth/google/callback`,
  };
}
