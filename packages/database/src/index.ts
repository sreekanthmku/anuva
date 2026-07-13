import prismaClient from '@prisma/client';
import type { PrismaClient as PrismaClientType } from '@prisma/client';

const { PrismaClient } = prismaClient;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClientType | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
