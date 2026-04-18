import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/server.js';
import { prisma } from '../../src/lib/prisma.js';

export async function buildTestApp(): Promise<FastifyInstance> {
  // Shorter rate-limit window for tests that intentionally exercise throttling.
  return buildApp({ rateLimit: { max: 60, timeWindow: '1 minute' } });
}

/**
 * Truncate every table in FK-safe order. Uses a single TRUNCATE CASCADE
 * so the order doesn't matter and foreign-key checks are satisfied.
 */
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "LessonCollection",
      "LessonInstance",
      "LessonTopic",
      "LessonSeries",
      "Professor",
      "User"
    RESTART IDENTITY CASCADE
  `);
}
