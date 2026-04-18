import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, resetDb } from './helpers/buildTestApp.js';
import { buildCollection, envelope, registerUser } from './helpers/fixtures.js';
import { prisma } from '../src/lib/prisma.js';

/**
 * Regression tests for code-review findings H1 (resolveTopic/Professor race),
 * H2 (upsertInstance race), and H3 (first-user TOCTOU). Each test exercises
 * the concurrent path via Promise.all through Fastify's inject() so the
 * request flow is identical to production.
 */
describe('concurrency regressions', () => {
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

  it('H3: two concurrent first-registrations produce exactly one COORDINATOR', async () => {
    const payloadA = {
      email: 'a@example.com',
      password: 'secret-pw-1',
      display_name: 'A',
    };
    const payloadB = {
      email: 'b@example.com',
      password: 'secret-pw-2',
      display_name: 'B',
    };
    const [resA, resB] = await Promise.all([
      app.inject({ method: 'POST', url: '/auth/register', payload: payloadA }),
      app.inject({ method: 'POST', url: '/auth/register', payload: payloadB }),
    ]);
    expect(resA.statusCode).toBe(201);
    expect(resB.statusCode).toBe(201);
    const coords = await prisma.user.findMany({ where: { role: 'COORDINATOR' } });
    expect(coords).toHaveLength(1);
  });

  it('H1 (Professor): concurrent batches with the same professor_name_fallback create one pending Professor', async () => {
    const coord = await registerUser(app);
    const u2 = await registerUser(app);
    const professorName = 'Prof Concorrente';
    const batches = [coord, u2].map((u, i) =>
      app.inject({
        method: 'POST',
        url: '/sync/batch',
        headers: u.authHeader,
        payload: envelope([
          buildCollection({
            id: `f0000000-${i}000-4000-8000-000000000000`,
            date: '2026-05-01',
            professorName,
            // Different topics so LessonInstance rows differ — isolate the
            // professor race.
            topicTitle: `Topic ${i}`,
            seriesCode: `SERIES_${i}`,
          }),
        ]),
      }),
    );
    const [resA, resB] = await Promise.all(batches);
    expect(resA.statusCode).toBe(200);
    expect(resB.statusCode).toBe(200);
    const professors = await prisma.professor.findMany({ where: { name: professorName } });
    expect(professors).toHaveLength(1);
    expect(professors[0]!.isPending).toBe(true);
  });

  it('H1 (Topic): concurrent batches with the same (series, topic) create one pending LessonTopic', async () => {
    const coord = await registerUser(app);
    const u2 = await registerUser(app);
    const batches = [coord, u2].map((u, i) =>
      app.inject({
        method: 'POST',
        url: '/sync/batch',
        headers: u.authHeader,
        payload: envelope([
          buildCollection({
            id: `f1000000-${i}000-4000-8000-000000000000`,
            date: `2026-05-0${i + 2}`,
            seriesCode: 'SHAREDSERIES',
            topicTitle: 'Shared Topic',
            professorName: `Prof ${i}`,
          }),
        ]),
      }),
    );
    const [resA, resB] = await Promise.all(batches);
    expect(resA.statusCode).toBe(200);
    expect(resB.statusCode).toBe(200);
    const series = await prisma.lessonSeries.findUniqueOrThrow({
      where: { code: 'SHAREDSERIES' },
    });
    const topics = await prisma.lessonTopic.findMany({
      where: { seriesId: series.id, title: 'Shared Topic' },
    });
    expect(topics).toHaveLength(1);
  });

  it('H2: concurrent batches targeting the same LessonInstance produce exactly one instance', async () => {
    const coord = await registerUser(app);
    const u2 = await registerUser(app);
    const batches = [coord, u2].map((u, i) =>
      app.inject({
        method: 'POST',
        url: '/sync/batch',
        headers: u.authHeader,
        payload: envelope([
          buildCollection({
            id: `f2000000-${i}000-4000-8000-000000000000`,
            date: '2026-05-05',
            seriesCode: 'INSTSERIES',
            topicTitle: 'Inst Topic',
            professorName: 'Inst Prof',
            attendance: [10 + i, 10, 10],
          }),
        ]),
      }),
    );
    const [resA, resB] = await Promise.all(batches);
    expect(resA.statusCode).toBe(200);
    expect(resB.statusCode).toBe(200);
    const instances = await prisma.lessonInstance.findMany({
      where: { seriesCode: 'INSTSERIES' },
    });
    expect(instances).toHaveLength(1);
    const collections = await prisma.lessonCollection.count({
      where: { lessonInstanceId: instances[0]!.id },
    });
    expect(collections).toBe(2);
    // Aggregate reflects both collections.
    expect(instances[0]!.aggCollectorCount).toBe(2);
  });

  it('H4: re-posting a corrected version of a REJECTED collection flips status to SYNCED', async () => {
    const user = await registerUser(app);
    const id = 'f3000000-0000-4000-8000-000000000000';

    // First post: bad attendance.start → REJECTED.
    const bad = buildCollection({
      id,
      clientUpdatedAt: '2026-05-10T10:00:00.000Z',
    });
    (bad.attendance as Record<string, unknown>).start = -1;
    await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: user.authHeader,
      payload: envelope([bad]),
    });
    let row = await prisma.lessonCollection.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('REJECTED');
    expect(row.rejectionReason).toContain('invalid_collection_payload');

    // Second post: corrected + newer timestamp → SYNCED.
    const good = buildCollection({
      id,
      clientUpdatedAt: '2026-05-10T11:00:00.000Z',
      attendance: [10, 10, 10],
    });
    const res = await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: user.authHeader,
      payload: envelope([good]),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accepted).toContain(id);
    row = await prisma.lessonCollection.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('SYNCED');
    expect(row.rejectionReason).toBeNull();
    expect(row.attendanceStart).toBe(10);
  });
});
