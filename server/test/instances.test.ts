import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, resetDb } from './helpers/buildTestApp.js';
import { buildCollection, envelope, registerUser } from './helpers/fixtures.js';
import { prisma } from '../src/lib/prisma.js';

describe('Coordinator /instances endpoints (US-3)', () => {
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

  /**
   * Seed: a single lesson instance with three contributing collections
   * (attendance_start = [10, 12, 15] → median 12).
   */
  async function seedInstance(): Promise<{
    coord: Awaited<ReturnType<typeof registerUser>>;
    others: Awaited<ReturnType<typeof registerUser>>[];
    instanceId: string;
  }> {
    const coord = await registerUser(app); // first → COORDINATOR
    const u2 = await registerUser(app);
    const u3 = await registerUser(app);

    const date = '2026-04-11';
    const col = (id: string, start: number, mid: number, end: number) =>
      buildCollection({ id, attendance: [start, mid, end], date });

    for (const [user, c] of [
      [coord, col('aaaa0000-0000-0000-0000-000000000001', 10, 10, 10)],
      [u2, col('aaaa0000-0000-0000-0000-000000000002', 12, 12, 12)],
      [u3, col('aaaa0000-0000-0000-0000-000000000003', 15, 15, 15)],
    ] as const) {
      await app.inject({
        method: 'POST',
        url: '/sync/batch',
        headers: user.authHeader,
        payload: envelope([c]),
      });
    }
    const instance = await prisma.lessonInstance.findFirstOrThrow();
    return { coord, others: [u2, u3], instanceId: instance.id };
  }

  it('scenario 1: GET /instances returns instances with aggregates within [from,to]', async () => {
    const { coord } = await seedInstance();
    const res = await app.inject({
      method: 'GET',
      url: '/instances?from=2026-04-01&to=2026-04-30',
      headers: coord.authHeader,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.instances).toHaveLength(1);
    expect(body.instances[0]).toMatchObject({
      agg_start: 12,
      agg_collector_count: 3,
      date: '2026-04-11',
    });
    expect(body.instances[0].collections).toHaveLength(3);
  });

  it('scenario 2: toggling a contributor acceptance recomputes the aggregate', async () => {
    const { coord, others, instanceId } = await seedInstance();

    // Manually un-accept u2 (moderation endpoint not yet implemented — US-5).
    await prisma.user.update({
      where: { id: others[0]!.id },
      data: { accepted: false },
    });
    // Force recompute (US-3 scenario 3 / FR-042).
    await app.inject({
      method: 'POST',
      url: `/instances/${instanceId}/recompute`,
      headers: coord.authHeader,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/instances/${instanceId}`,
      headers: coord.authHeader,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Remaining attendance values [10, 15] — median with lower-middle = 10.
    expect(body.agg_start).toBe(10);
    expect(body.agg_collector_count).toBe(2);
  });

  it('scenario 3: includes_professor=true subtracts 1 before computing median', async () => {
    const coord = await registerUser(app);
    const u2 = await registerUser(app);
    // One collector counted the professor, the other didn't.
    await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: coord.authHeader,
      payload: envelope([
        buildCollection({
          id: 'bbbb0000-0000-0000-0000-000000000001',
          attendance: [11, 11, 11],
          includesProfessor: true,
          date: '2026-04-12',
        }),
      ]),
    });
    await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: u2.authHeader,
      payload: envelope([
        buildCollection({
          id: 'bbbb0000-0000-0000-0000-000000000002',
          attendance: [10, 10, 10],
          includesProfessor: false,
          date: '2026-04-12',
        }),
      ]),
    });
    const instance = await prisma.lessonInstance.findFirstOrThrow();
    // Normalized [10, 10] — median = 10.
    expect(instance.aggStart).toBe(10);
  });

  it('FR-040: plain collector cannot reach /instances (forbidden)', async () => {
    await registerUser(app); // COORDINATOR
    const collector = await registerUser(app);
    const res = await app.inject({
      method: 'GET',
      url: '/instances?from=2026-04-01&to=2026-04-30',
      headers: collector.authHeader,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('forbidden');
  });

  it('FR-041: GET /instances/:id returns the single instance with collections', async () => {
    const { coord, instanceId } = await seedInstance();
    const res = await app.inject({
      method: 'GET',
      url: `/instances/${instanceId}`,
      headers: coord.authHeader,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(instanceId);
    expect(res.json().collections).toHaveLength(3);
  });

  it('FR-041: unknown id returns 404 not_found', async () => {
    const coord = await registerUser(app);
    const res = await app.inject({
      method: 'GET',
      url: '/instances/00000000-0000-0000-0000-000000000000',
      headers: coord.authHeader,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('not_found');
  });

  it('FR-042: POST /instances/:id/recompute returns 204 and refreshes aggregates', async () => {
    const { coord, instanceId } = await seedInstance();
    // Poison the cache directly — recompute must correct it.
    await prisma.lessonInstance.update({
      where: { id: instanceId },
      data: { aggStart: 999, aggCollectorCount: 99 },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/instances/${instanceId}/recompute`,
      headers: coord.authHeader,
    });
    expect(res.statusCode).toBe(204);
    const row = await prisma.lessonInstance.findUniqueOrThrow({ where: { id: instanceId } });
    expect(row.aggStart).toBe(12);
    expect(row.aggCollectorCount).toBe(3);
  });

  it('invalid from/to returns 400 invalid_query', async () => {
    const coord = await registerUser(app);
    const res = await app.inject({
      method: 'GET',
      url: '/instances?from=bad&to=2026-04-30',
      headers: coord.authHeader,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('invalid_query');
  });
});
