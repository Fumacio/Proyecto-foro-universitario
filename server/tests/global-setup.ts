import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Base SQLite descartable solo para tests: se recrea desde cero en cada corrida. */
export default function setup(): void {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    fs.rmSync(path.join(serverRoot, 'prisma', `test.db${suffix}`), { force: true });
  }
  execSync('npx prisma db push --skip-generate', {
    cwd: serverRoot,
    env: { ...process.env, DATABASE_URL: 'file:./test.db', PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    stdio: 'pipe',
  });
}
