import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, resetDb } from './helpers/buildTestApp.js';
import { buildCollection, envelope, registerUser } from './helpers/fixtures.js';
import { prisma } from '../src/lib/prisma.js';

describe('Coordinator moderation (US-5)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it('scenario 1: coordinator GET /users lists all users with accepted flag', async () => {
    const coord = await registerUser(app);
    const u2 = await registerUser(app);
    const res = await app.inject({
      method: 'GET',
      url: '/users',
      headers: coord.authHeader,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.users).toHaveLength(2);
    const ids = body.users.map((u: { id: string }) => u.id);
    expect(ids).toContain(coord.id);
    expect(ids).toContain(u2.id);
    expect(body.users[0]).toHaveProperty('accepted');
    expect(body.users[0]).toHaveProperty('created_at');
  });

  it('scenario 2: collector GET /users returns 403 forbidden', async () => {
    await registerUser(app); // COORDINATOR
    const collector = await registerUser(app);
    const res = await app.inject({
      method: 'GET',
      url: '/users',
      headers: collector.authHeader,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('forbidden');
  });

  it('scenario 3: toggling accepted=false recomputes every affected aggregate', async () => {
    const coord = await registerUser(app);
    const u2 = await registerUser(app);

    // Seed two instances where u2 contributes.
    await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: coord.authHeader,
      payload: envelope([
        buildCollection({
          id: 'eeee0000-0000-0000-0000-000000000001',
          attendance: [10, 10, 10],
          date: '2026-04-20',
        }),
        buildCollection({
          id: 'eeee0000-0000-0000-0000-000000000002',
          attendance: [10, 10, 10],
          date: '2026-04-21',
        }),
      ]),
    });
    await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: u2.authHeader,
      payload: envelope([
        buildCollection({
          id: 'eeee0000-0000-0000-0000-000000000003',
          attendance: [20, 20, 20],
          date: '2026-04-20',
        }),
        buildCollection({
          id: 'eeee0000-0000-0000-0000-000000000004',
          attendance: [30, 30, 30],
          date: '2026-04-21',
        }),
      ]),
    });

    // Before: both instances have count=2 and median includes u2.
    const before = await prisma.lessonInstance.findMany({ orderBy: { date: 'asc' } });
    expect(before).toHaveLength(2);
    expect(before.every((i) => i.aggCollectorCount === 2)).toBe(true);

    // Flip u2 off.
    const res = await app.inject({
      method: 'PATCH',
      url: `/users/${u2.id}/accepted`,
      headers: coord.authHeader,
      payload: { accepted: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accepted).toBe(false);

    const after = await prisma.lessonInstance.findMany({ orderBy: { date: 'asc' } });
    expect(after.every((i) => i.aggCollectorCount === 1)).toBe(true);
    // Only coord's value (10) remains — median is 10 on both dates.
    expect(after.every((i) => i.aggStart === 10)).toBe(true);
  });

  it('toggling back to accepted=true restores the user to aggregates', async () => {
    const coord = await registerUser(app);
    const u2 = await registerUser(app);

    await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: u2.authHeader,
      payload: envelope([
        buildCollection({
          id: 'ffff0000-0000-0000-0000-000000000001',
          attendance: [50, 50, 50],
          date: '2026-04-22',
        }),
      ]),
    });

    await app.inject({
      method: 'PATCH',
      url: `/users/${u2.id}/accepted`,
      headers: coord.authHeader,
      payload: { accepted: false },
    });
    const dropped = await prisma.lessonInstance.findFirstOrThrow();
    expect(dropped.aggCollectorCount).toBe(0);
    expect(dropped.aggStart).toBeNull();

    await app.inject({
      method: 'PATCH',
      url: `/users/${u2.id}/accepted`,
      headers: coord.authHeader,
      payload: { accepted: true },
    });
    const restored = await prisma.lessonInstance.findFirstOrThrow();
    expect(restored.aggCollectorCount).toBe(1);
    expect(restored.aggStart).toBe(50);
  });

  it('PATCH with missing accepted body returns 400 invalid_payload', async () => {
    const coord = await registerUser(app);
    const u2 = await registerUser(app);
    const res = await app.inject({
      method: 'PATCH',
      url: `/users/${u2.id}/accepted`,
      headers: coord.authHeader,
      payload: { foo: 'bar' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('invalid_payload');
  });

  it('PATCH on unknown user returns 404 not_found', async () => {
    const coord = await registerUser(app);
    const res = await app.inject({
      method: 'PATCH',
      url: '/users/00000000-0000-0000-0000-000000000000/accepted',
      headers: coord.authHeader,
      payload: { accepted: false },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('not_found');
  });

  it('SC-006: toggling a user with ~100 contributing instances completes in <1 s', async () => {
    const coord = await registerUser(app);
    const u2 = await registerUser(app);

    // Seed 100 instances (distinct dates so they don't collapse onto one).
    const batch = Array.from({ length: 100 }, (_, i) => {
      const day = (i % 28) + 1;
      const month = (Math.floor(i / 28) % 12) + 1;
      const year = 2024 + Math.floor(i / (28 * 12));
      return buildCollection({
        id: `10101010-${i.toString(16).padStart(4, '0')}-0000-0000-000000000000`,
        attendance: [10 + i, 10, 10],
        date: `${year}-${month.toString().padStart(2, '0')}-${day
          .toString()
          .padStart(2, '0')}`,
      });
    });
    await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: u2.authHeader,
      payload: envelope(batch),
    });

    const distinct = await prisma.lessonCollection.findMany({
      distinct: ['lessonInstanceId'],
      select: { lessonInstanceId: true },
      where: { collectorUserId: u2.id },
    });
    expect(distinct.length).toBe(100);

    const t0 = Date.now();
    const res = await app.inject({
      method: 'PATCH',
      url: `/users/${u2.id}/accepted`,
      headers: coord.authHeader,
      payload: { accepted: false },
    });
    const elapsed = Date.now() - t0;
    expect(res.statusCode).toBe(200);
    expect(elapsed).toBeLessThan(1000);
  });
});
