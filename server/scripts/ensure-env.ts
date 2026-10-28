/**
 * Crea server/.env si no existe, copiando ../.env.example y generando un JWT_SECRET aleatorio.
 * Se ejecuta antes de `prisma db push` en `npm run db:setup` / `db:reset`.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(serverRoot, '.env');
const examplePath = path.resolve(serverRoot, '..', '.env.example');

if (fs.existsSync(envPath)) {
  console.info('[setup] server/.env ya existe: no se modifica.');
} else {
  const secret = crypto.randomBytes(48).toString('hex');
  let content: string;
  if (fs.existsSync(examplePath)) {
    content = fs.readFileSync(examplePath, 'utf8');
    content = /^JWT_SECRET=.*$/m.test(content)
      ? content.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`)
      : `${content.trimEnd()}\nJWT_SECRET=${secret}\n`;
    if (!/^DATABASE_URL=/m.test(content)) content = `${content.trimEnd()}\nDATABASE_URL="file:./dev.db"\n`;
  } else {
    content = [
      'PORT=3000',
      'NODE_ENV=development',
      'FRONTEND_URL=http://localhost:5173',
      'DATABASE_URL="file:./dev.db"',
      `JWT_SECRET=${secret}`,
      '',
    ].join('\n');
  }
  fs.writeFileSync(envPath, content, { mode: 0o600 });
  console.info('[setup] ✔ Creado server/.env con un JWT_SECRET aleatorio.');
}
