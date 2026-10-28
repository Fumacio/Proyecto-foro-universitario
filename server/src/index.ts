import { env } from './env.js';
import { createApp } from './app.js';
import { startAttachmentCleanup } from './lib/attachments.js';
import { flushEmails } from './lib/emailNotify.js';
import { prisma } from './lib/prisma.js';
import { closeAll } from './lib/sse.js';

async function checkDatabase(): Promise<void> {
  try {
    await prisma.user.count();
  } catch {
    console.warn('[db] ⚠ La base de datos no está inicializada. Corré `npm run setup` (o `npm run db:setup` en server/).');
  }
}

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.info(`🎓 API del Foro UTN escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
  void checkDatabase();
});

// Adjuntos sueltos (> 24 h) y archivos huérfanos: limpieza cada hora.
const stopCleanup = startAttachmentCleanup();

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') console.error(`[server] El puerto ${env.PORT} está ocupado. Cambiá PORT en server/.env.`);
  else console.error('[server]', err);
  process.exit(1);
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`\n[server] ${signal}: cerrando…`);
  stopCleanup();
  closeAll(); // las conexiones SSE mantendrían vivo el server
  const force = setTimeout(() => server.closeAllConnections(), 5_000);
  force.unref();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await Promise.race([flushEmails(), new Promise((r) => setTimeout(r, 3_000).unref())]);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
