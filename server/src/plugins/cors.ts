import cors from '@fastify/cors';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  const raw = process.env.CORS_ORIGIN ?? '';
  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    fastify.log.warn(
      'CORS_ORIGIN is empty — all cross-origin requests will be blocked. ' +
        'Set CORS_ORIGIN to a comma-separated allowlist in .env.',
    );
  }

  await fastify.register(cors, {
    origin: origins.length === 0 ? false : origins.length === 1 ? origins[0] : origins,
    credentials: false,
  });
};

export default fp(corsPlugin, { name: 'cors' });
