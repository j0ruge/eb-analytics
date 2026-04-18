import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, resetDb } from './helpers/buildTestApp.js';
import { buildCollection, envelope, registerUser } from './helpers/fixtures.js';
import { prisma } from '../src/lib/prisma.js';

describe('POST /sync/batch (US-1)', () => {
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

  it('scenario 1: inserts all new collections and recomputes aggregates', async () => {
    const user = await registerUser(app);
    const batch = envelope([
      buildCollection({ id: '10000000-0000-0000-0000-000000000001', attendance: [10, 12, 11] }),
      buildCollection({ id: '10000000-0000-0000-0000-000000000002', attendance: [14, 16, 18] }),
      buildCollection({ id: '10000000-0000-0000-0000-000000000003', attendance: [20, 22, 24] }),
    ]);
    const res = await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: user.authHeader,
      payload: batch,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accepted).toHaveLength(3);
    expect(body.rejected).toEqual([]);
    expect(typeof body.server_now).toBe('string');

    const count = await prisma.lessonCollection.count();
    expect(count).toBe(3);

    const instances = await prisma.lessonInstance.findMany();
    expect(instances).toHaveLength(1);
    expect(instances[0]!.aggCollectorCount).toBe(3);
    // attendance_start medians [10,14,20] → median = 14 (middle of sorted).
    expect(instances[0]!.aggStart).toBe(14);
  });

  it('scenario 2: reposting the same batch is idempotent (row count unchanged)', async () => {
    const user = await registerUser(app);
    const batch = envelope([
      buildCollection({ id: '20000000-0000-0000-0000-000000000001' }),
      buildCollection({ id: '20000000-0000-0000-0000-000000000002' }),
      buildCollection({ id: '20000000-0000-0000-0000-000000000003' }),
    ]);
    for (let i = 0; i < 3; i += 1) {
      const res = await app.inject({
        method: 'POST',
        url: '/sync/batch',
        headers: user.authHeader,
        payload: batch,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().accepted).toHaveLength(3);
    }
    expect(await prisma.lessonCollection.count()).toBe(3);
  });

  it('scenario 3: newer client_updated_at triggers field-level update', async () => {
    const user = await registerUser(app);
    const id = '30000000-0000-0000-0000-000000000001';
    await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: user.authHeader,
      payload: envelope([
        buildCollection({
          id,
          attendance: [10, 12, 11],
          clientUpdatedAt: '2026-04-11T10:00:00.000Z',
          notes: 'original',
        }),
      ]),
    });
    await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: user.authHeader,
      payload: envelope([
        buildCollection({
          id,
          attendance: [99, 99, 99],
          clientUpdatedAt: '2026-04-11T11:00:00.000Z',
          notes: 'updated',
        }),
      ]),
    });
    const row = await prisma.lessonCollection.findUnique({ where: { id } });
    expect(row?.attendanceStart).toBe(99);
    expect(row?.notes).toBe('updated');
    expect(await prisma.lessonCollection.count()).toBe(1);
  });

  it('scenario 4: older client_updated_at is ignored', async () => {
    const user = await registerUser(app);
    const id = '40000000-0000-0000-0000-000000000001';
    await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: user.authHeader,
      payload: envelope([
        buildCollection({
          id,
          attendance: [10, 12, 11],
          clientUpdatedAt: '2026-04-11T12:00:00.000Z',
          notes: 'newer',
        }),
      ]),
    });
    await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: user.authHeader,
      payload: envelope([
        buildCollection({
          id,
          attendance: [1, 1, 1],
          clientUpdatedAt: '2026-04-11T10:00:00.000Z',
          notes: 'older',
        }),
      ]),
    });
    const row = await prisma.lessonCollection.findUnique({ where: { id } });
    expect(row?.attendanceStart).toBe(10);
    expect(row?.notes).toBe('newer');
  });

  it('scenario 5: missing JWT returns 401 and persists nothing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sync/batch',
      payload: envelope([buildCollection({ id: '50000000-0000-0000-0000-000000000001' })]),
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('unauthenticated');
    expect(await prisma.lessonCollection.count()).toBe(0);
  });

  it('EC-001: missing_catalog_reference when both series_id and series_code_fallback are null', async () => {
    const user = await registerUser(app);
    const bad = buildCollection({ id: '60000000-0000-0000-0000-000000000001' });
    (bad.lesson_instance as Record<string, unknown>).series_code_fallback = null;
    (bad.lesson_instance as Record<string, unknown>).series_id = null;

    const res = await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: user.authHeader,
      payload: envelope([bad]),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accepted).toEqual([]);
    expect(res.json().rejected[0]).toMatchObject({
      id: '60000000-0000-0000-0000-000000000001',
      code: 'missing_catalog_reference',
    });
  });

  it('EC-002: free-text fallback auto-creates pending catalog items (Professor.email=null)', async () => {
    const user = await registerUser(app);
    await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: user.authHeader,
      payload: envelope([
        buildCollection({
          id: '70000000-0000-0000-0000-000000000001',
          seriesCode: 'EB999',
          topicTitle: 'Lição Auto',
          professorName: 'Prof Auto',
        }),
      ]),
    });
    const series = await prisma.lessonSeries.findUnique({ where: { code: 'EB999' } });
    expect(series?.isPending).toBe(true);
    const professor = await prisma.professor.findFirst({ where: { name: 'Prof Auto' } });
    expect(professor?.isPending).toBe(true);
    expect(professor?.email).toBeNull();
    const topic = await prisma.lessonTopic.findFirst({ where: { title: 'Lição Auto' } });
    expect(topic?.isPending).toBe(true);
  });

  it('EC-003: partial batch — valid collections accepted, invalid one rejected, HTTP still 200', async () => {
    const user = await registerUser(app);
    const good = buildCollection({ id: '80000000-0000-0000-0000-000000000001' });
    const bad = buildCollection({ id: '80000000-0000-0000-0000-000000000002' });
    (bad.attendance as Record<string, unknown>).start = -1; // malformed

    const res = await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: user.authHeader,
      payload: envelope([good, bad]),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accepted).toContain('80000000-0000-0000-0000-000000000001');
    expect(res.json().rejected[0]).toMatchObject({
      id: '80000000-0000-0000-0000-000000000002',
      code: 'invalid_collection_payload',
    });
  });

  it('EC-006: missing schema_version → 400 schema_version_required', async () => {
    const user = await registerUser(app);
    const payload = envelope([buildCollection({ id: '90000000-0000-0000-0000-000000000001' })]);
    delete (payload as Record<string, unknown>).schema_version;
    const res = await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: user.authHeader,
      payload,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('schema_version_required');
  });

  it('EC-006: schema_version="2" (not "2.0") → 400 schema_version_unsupported', async () => {
    const user = await registerUser(app);
    const payload = envelope([buildCollection({ id: '90000000-0000-0000-0000-000000000002' })]);
    (payload as Record<string, unknown>).schema_version = '2';
    const res = await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: user.authHeader,
      payload,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('schema_version_unsupported');
  });

  it('EC-006: only schema_version="2.0" is accepted', async () => {
    const user = await registerUser(app);
    const res = await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: user.authHeader,
      payload: envelope([buildCollection({ id: '90000000-0000-0000-0000-000000000003' })]),
    });
    expect(res.statusCode).toBe(200);
  });

  it('EC-007: batch with > 500 collections → 413 batch_too_large', async () => {
    const user = await registerUser(app);
    const collections = Array.from({ length: 501 }, (_, i) =>
      buildCollection({
        id: `99999999-0000-0000-0000-${i.toString().padStart(12, '0')}`,
      }),
    );
    const res = await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: user.authHeader,
      payload: envelope(collections),
    });
    expect(res.statusCode).toBe(413);
    expect(res.json().code).toBe('batch_too_large');
  });

  it('preserves server-only fields (acceptedOverride, status) on re-sync with newer client data (FR-021)', async () => {
    const user = await registerUser(app);
    const id = 'a0000000-0000-0000-0000-000000000001';

    // First ingest.
    await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: user.authHeader,
      payload: envelope([
        buildCollection({
          id,
          attendance: [10, 12, 11],
          clientUpdatedAt: '2026-04-11T10:00:00.000Z',
          notes: 'original',
        }),
      ]),
    });

    // Server-side moderation touches acceptedOverride directly.
    await prisma.lessonCollection.update({
      where: { id },
      data: { acceptedOverride: true },
    });

    // Client re-syncs with newer timestamp and updated client-authored fields.
    await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: user.authHeader,
      payload: envelope([
        buildCollection({
          id,
          attendance: [99, 99, 99],
          clientUpdatedAt: '2026-04-11T11:00:00.000Z',
          notes: 'updated',
        }),
      ]),
    });

    const row = await prisma.lessonCollection.findUnique({ where: { id } });
    // Client fields updated.
    expect(row?.attendanceStart).toBe(99);
    expect(row?.notes).toBe('updated');
    // Server-only fields preserved.
    expect(row?.acceptedOverride).toBe(true);
    expect(row?.status).toBe('SYNCED');
  });
});
