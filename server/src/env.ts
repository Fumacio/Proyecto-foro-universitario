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
  TRUST_PROXY: parseTrustProxy(process.env.TRUST_PROXY),
  SMTP: {
    host: process.env.SMTP_HOST?.trim() || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER?.trim() || '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM?.trim() || 'Foro UTN <no-reply@foro.utn>',
  },
  UPLOAD_DIR: path.resolve(SERVER_ROOT, process.env.UPLOAD_DIR?.trim() || 'uploads'),
  /** Build del front que se sirve en producción (por defecto ../web/dist). */
  WEB_DIST: path.resolve(SERVER_ROOT, process.env.WEB_DIST?.trim() || '../web/dist'),
} as const;
