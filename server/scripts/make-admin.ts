/**
 * Convierte a un usuario en ADMIN.
 *   npm run make-admin -- <email-o-usuario>
 */
import { prisma } from '../src/lib/prisma.js';

const arg = process.argv.slice(2).find((a) => !a.startsWith('-'))?.trim();

if (!arg) {
  console.error('Uso: npm run make-admin -- <email-o-usuario>');
  process.exit(1);
}

const key = arg.replace(/^@/, '').toLowerCase();

try {
  const user = await prisma.user.findFirst({ where: { OR: [{ email: key }, { usernameKey: key }] } });
  if (!user) {
    console.error(`No existe un usuario con email o nombre "${arg}".`);
    process.exitCode = 1;
  } else if (user.role === 'ADMIN') {
    console.info(`@${user.username} ya es ADMIN.`);
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
    console.info(`✔ @${user.username} (${user.email}) ahora es ADMIN (antes: ${user.role}).`);
  }
} finally {
  await prisma.$disconnect();
}
