import cors from '@fastify/cors';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  const raw = process.env.CORS_ORIGIN ?? '';
  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  await fastify.register(cors, {
    origin: origins.length === 0 ? false : origins.length === 1 ? origins[0] : origins,
    credentials: false,
  });
};

export default fp(corsPlugin, { name: 'cors' });
