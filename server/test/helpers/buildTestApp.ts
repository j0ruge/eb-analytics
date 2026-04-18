import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/server.js';
import { prisma } from '../../src/lib/prisma.js';

export interface TestAppOpts {
  rateLimit?: { max?: number; timeWindow?: string | number };
}

/**
 * Default uses a permissive rate limit (10k/min) so property and load-ish
 * tests don't trip the throttle. The dedicated rateLimit.test.ts passes
 * production values explicitly.
 */
export async function buildTestApp(opts: TestAppOpts = {}): Promise<FastifyInstance> {
  return buildApp({
    rateLimit: opts.rateLimit ?? { max: 10_000, timeWindow: '1 minute' },
  });
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
