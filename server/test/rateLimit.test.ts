import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, resetDb } from './helpers/buildTestApp.js';
import { buildCollection, envelope, registerUser } from './helpers/fixtures.js';
import { prisma } from '../src/lib/prisma.js';

/**
 * T063 / FR-063: mutation verbs are throttled at the production rate of
 * 60 per window; reads are not. We run the test with `timeWindow: '2 seconds'`
 * to keep wall time small, but the `max: 60` count is the production value.
 */
describe('FR-063 rate limiting', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp({ rateLimit: { max: 60, timeWindow: '2 seconds' } });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it('61st POST /sync/batch within the window returns 429 rate_limited', async () => {
    const user = await registerUser(app);

    let throttled = false;
    let lastStatus = 0;
    for (let i = 0; i < 61; i += 1) {
      const res = await app.inject({
        method: 'POST',
        url: '/sync/batch',
        headers: user.authHeader,
        payload: envelope([
          buildCollection({
            id: `22222222-${i.toString(16).padStart(4, '0')}-0000-0000-000000000000`,
          }),
        ]),
      });
      lastStatus = res.statusCode;
      if (res.statusCode === 429) {
        expect(res.json().code).toBe('rate_limited');
        throttled = true;
        break;
      }
      expect(res.statusCode).toBe(200);
    }
    expect(throttled, `expected at least one 429 within 61 requests; last=${lastStatus}`).toBe(
      true,
    );
  });

  it('GET reads in the same window are NOT throttled', async () => {
    const user = await registerUser(app);
    // Burst 100 catalog GETs — all should succeed even though the mutation
    // limit is 60/window.
    for (let i = 0; i < 100; i += 1) {
      const res = await app.inject({
        method: 'GET',
        url: '/catalog',
        headers: user.authHeader,
      });
      expect(res.statusCode).toBe(200);
    }
  });
});
