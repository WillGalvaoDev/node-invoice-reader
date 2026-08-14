import { prisma } from './prisma.js';

export async function checkDatabaseHealth(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
