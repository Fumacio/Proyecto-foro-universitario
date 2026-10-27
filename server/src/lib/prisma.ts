import { env } from '../env.js';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: env.isDev ? ['warn', 'error'] : ['error'],
});
