import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';

const HEALTH_TIMEOUT_MS = 500;

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, reply) => {
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('health check timeout')), HEALTH_TIMEOUT_MS),
      );
      await Promise.race([prisma.$queryRawUnsafe('SELECT 1'), timeout]);
      return reply.status(200).send({ status: 'ok', postgres: 'up' });
    } catch {
      // 503 body carries both the standard error envelope (FR-065) and the
      // operator-visible probe state (research §13). The {code, message}
      // pair is what monitoring dashboards branch on; `postgres: "down"`
      // remains for human consumption in logs / `curl`.
      return reply.status(503).send({
        code: 'database_unavailable',
        message: 'Banco de dados indisponível.',
        status: 'degraded',
        postgres: 'down',
      });
    }
  });
};

export default healthRoutes;
