import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';

import authPlugin from './plugins/auth.js';
import corsPlugin from './plugins/cors.js';
import errorHandlerPlugin from './plugins/errorHandler.js';
import rateLimitPlugin from './plugins/rateLimit.js';
import rbacPlugin from './plugins/rbac.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import collectionsRoutes from './routes/collections.js';
import healthRoutes from './routes/health.js';
import instancesRoutes from './routes/instances.js';
import syncRoutes from './routes/sync.js';
import usersRoutes from './routes/users.js';

export interface BuildAppOptions {
  rateLimit?: { max?: number; timeWindow?: string | number };
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const logLevel = process.env.LOG_LEVEL ?? 'info';
  const isProd = process.env.NODE_ENV === 'production';

  // TRUST_PROXY controls whether Fastify derives request.ip from
  // X-Forwarded-For. Required when the server sits behind a load balancer
  // or reverse proxy — otherwise every client shares the same IP for
  // rate-limit keying. Accepts a hop count ("1") or "true" for all proxies.
  const trustProxyRaw = process.env.TRUST_PROXY;
  const trustProxy: boolean | number =
    trustProxyRaw === undefined || trustProxyRaw === ''
      ? false
      : trustProxyRaw === 'true'
        ? true
        : Number.isFinite(Number(trustProxyRaw))
          ? Number(trustProxyRaw)
          : true;

  const app = Fastify({
    bodyLimit: 5 * 1024 * 1024,
    genReqId: () => randomUUID(),
    trustProxy,
    logger: {
      level: logLevel,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.body.password',
          'res.payload.jwt',
          'res.headers["set-cookie"]',
        ],
        remove: false,
      },
      ...(isProd ? {} : { transport: { target: 'pino-pretty' } }),
    },
  });

  await app.register(errorHandlerPlugin);
  await app.register(corsPlugin);
  await app.register(authPlugin);
  await app.register(rbacPlugin);
  await app.register(rateLimitPlugin, opts.rateLimit ?? {});

  // Public routes — no auth (FR-060 exempts /health, /auth/register, /auth/login)
  await app.register(healthRoutes);
  await app.register(authRoutes);

  // Authenticated routes
  await app.register(syncRoutes);
  await app.register(collectionsRoutes);
  await app.register(catalogRoutes);
  await app.register(instancesRoutes);
  await app.register(usersRoutes);

  return app;
}

async function main(): Promise<void> {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 3000);
  try {
    await app.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error({ err }, 'failed to start');
    process.exit(1);
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  void main();
}
