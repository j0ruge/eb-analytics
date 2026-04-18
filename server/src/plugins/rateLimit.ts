import rateLimit from '@fastify/rate-limit';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'DELETE', 'PUT']);

export interface RateLimitOptions {
  max?: number;
  timeWindow?: string | number;
}

const rateLimitPlugin: FastifyPluginAsync<RateLimitOptions> = async (fastify, opts) => {
  await fastify.register(rateLimit, {
    max: opts.max ?? 60,
    timeWindow: opts.timeWindow ?? '1 minute',
    keyGenerator: (request: FastifyRequest) => request.user?.id ?? request.ip,
    // allowList skips rate limiting when it returns true — we skip all reads
    // so mutation verbs (POST/PATCH/DELETE/PUT) are the only throttled ones (research §4).
    allowList: (request: FastifyRequest) => !MUTATING_METHODS.has(request.method),
  });
};

export default fp(rateLimitPlugin, { name: 'rateLimit', dependencies: ['auth'] });
