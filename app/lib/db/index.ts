import { PrismaClient } from '@prisma/client';
import { DATABASE_URL } from '../config';

const NODE_ENV = process.env.NODE_ENV || 'development';

const prismaClientSingleton = () => {
  // In test environment, return a mock if DATABASE_URL is not set
  if (NODE_ENV === 'test' && !DATABASE_URL) {
    console.warn('Warning: DATABASE_URL not set in test environment, using mock Prisma client');
    return {} as PrismaClient;
  }
  
  // In test environment, use a dummy URL if DATABASE_URL is not set
  const dbUrl = DATABASE_URL || (NODE_ENV === 'test' ? 'postgresql://test:test@localhost:5432/test' : undefined);
  
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not defined');
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: dbUrl
      }
    },
    log: NODE_ENV === 'test' ? [] : ['error', 'warn']
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
} 