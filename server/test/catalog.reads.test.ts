import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, resetDb } from './helpers/buildTestApp.js';
import { buildCollection, envelope, registerUser } from './helpers/fixtures.js';
import { prisma } from '../src/lib/prisma.js';

describe('GET /catalog (US-2)', () => {
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

  async function seedCuratedCatalog(): Promise<void> {
    const s1 = await prisma.lessonSeries.create({
      data: { code: 'EB201', title: 'Série A', isPending: false },
    });
    const s2 = await prisma.lessonSeries.create({
      data: { code: 'EB202', title: 'Série B', isPending: false },
    });
    // Insert topics out of order to prove the response sort.
    await prisma.lessonTopic.create({
      data: { seriesId: s2.id, title: 'Tópico B-2', sequenceOrder: 2, isPending: false },
    });
    await prisma.lessonTopic.create({
      data: { seriesId: s1.id, title: 'Tópico A-2', sequenceOrder: 2, isPending: false },
    });
    await prisma.lessonTopic.create({
      data: { seriesId: s2.id, title: 'Tópico B-1', sequenceOrder: 1, isPending: false },
    });
    await prisma.lessonTopic.create({
      data: { seriesId: s1.id, title: 'Tópico A-1', sequenceOrder: 1, isPending: false },
    });
    await prisma.professor.create({ data: { name: 'Prof X', isPending: false } });
  }

  it('scenario 1: baseline returns all non-pending catalog entries and server_now', async () => {
    const user = await registerUser(app);
    await seedCuratedCatalog();

    const res = await app.inject({ method: 'GET', url: '/catalog', headers: user.authHeader });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.series).toHaveLength(2);
    expect(body.topics).toHaveLength(4);
    expect(body.professors).toHaveLength(1);
    expect(typeof body.server_now).toBe('string');
  });

  it('scenario 2: ?since filters out items older than the timestamp', async () => {
    const user = await registerUser(app);
    await seedCuratedCatalog();

    // Capture a cutoff after the initial seed.
    const firstRes = await app.inject({
      method: 'GET',
      url: '/catalog',
      headers: user.authHeader,
    });
    const cutoff = firstRes.json().server_now;

    // Give Postgres a whole-millisecond tick so updatedAt of new row > cutoff.
    await new Promise((r) => setTimeout(r, 5));
    await prisma.lessonSeries.create({
      data: { code: 'EB999', title: 'New', isPending: false },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/catalog?since=${encodeURIComponent(cutoff)}`,
      headers: user.authHeader,
    });
    const body = res.json();
    expect(body.series).toHaveLength(1);
    expect(body.series[0].code).toBe('EB999');
    // topics and professors had no post-cutoff updates
    expect(body.topics).toHaveLength(0);
    expect(body.professors).toHaveLength(0);
  });

  it('scenario 3a: pending items are excluded by default', async () => {
    const user = await registerUser(app); // first registered → COORDINATOR
    await seedCuratedCatalog();
    await prisma.lessonSeries.create({
      data: { code: 'AUTO1', title: 'auto', isPending: true },
    });

    const res = await app.inject({ method: 'GET', url: '/catalog', headers: user.authHeader });
    const body = res.json();
    expect(body.series.find((s: { code: string }) => s.code === 'AUTO1')).toBeUndefined();
  });

  it('scenario 3b: include_pending=true surfaces pending items for coordinator', async () => {
    const coord = await registerUser(app);
    expect(coord.role).toBe('COORDINATOR');
    await prisma.lessonSeries.create({
      data: { code: 'AUTO2', title: 'auto', isPending: true },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/catalog?include_pending=true',
      headers: coord.authHeader,
    });
    const body = res.json();
    expect(body.series.some((s: { code: string }) => s.code === 'AUTO2')).toBe(true);
  });

  it('scenario 3c: include_pending=true by a collector returns 403 forbidden', async () => {
    await registerUser(app); // first → COORDINATOR
    const collector = await registerUser(app);
    expect(collector.role).toBe('COLLECTOR');

    const res = await app.inject({
      method: 'GET',
      url: '/catalog?include_pending=true',
      headers: collector.authHeader,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('forbidden');
  });

  it('scenario 4: topics sorted by (series_id ASC, sequence_order ASC)', async () => {
    const user = await registerUser(app);
    await seedCuratedCatalog();

    const res = await app.inject({ method: 'GET', url: '/catalog', headers: user.authHeader });
    const topics = res.json().topics as Array<{ series_id: string; sequence_order: number }>;
    for (let i = 1; i < topics.length; i += 1) {
      const prev = topics[i - 1]!;
      const curr = topics[i]!;
      if (prev.series_id === curr.series_id) {
        expect(curr.sequence_order).toBeGreaterThanOrEqual(prev.sequence_order);
      } else {
        expect(curr.series_id >= prev.series_id).toBe(true);
      }
    }
  });

  it('auto-created pending items from sync are hidden by default', async () => {
    const user = await registerUser(app);
    // Sync with fallbacks → creates pending rows.
    await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: user.authHeader,
      payload: envelope([
        buildCollection({
          id: 'cccccccc-0000-0000-0000-000000000001',
          seriesCode: 'AUTOSYNC',
          topicTitle: 'Auto Topic',
          professorName: 'Auto Prof',
        }),
      ]),
    });

    const res = await app.inject({ method: 'GET', url: '/catalog', headers: user.authHeader });
    const body = res.json();
    expect(body.series.find((s: { code: string }) => s.code === 'AUTOSYNC')).toBeUndefined();
    expect(body.professors.find((p: { name: string }) => p.name === 'Auto Prof')).toBeUndefined();
  });
});
