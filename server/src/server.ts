import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';

import authPlugin from './plugins/auth.js';
import corsPlugin from './plugins/cors.js';
import errorHandlerPlugin from './plugins/errorHandler.js';
import rateLimitPlugin from './plugins/rateLimit.js';
import rbacPlugin from './plugins/rbac.js';

export interface BuildAppOptions {
  rateLimit?: { max?: number; timeWindow?: string | number };
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const logLevel = process.env.LOG_LEVEL ?? 'info';
  const isProd = process.env.NODE_ENV === 'production';

  const app = Fastify({
    bodyLimit: 5 * 1024 * 1024,
    genReqId: () => randomUUID(),
    logger: {
      level: logLevel,
      redact: {
        paths: ['req.headers.authorization', 'req.body.password'],
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
