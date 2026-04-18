import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, resetDb } from './helpers/buildTestApp.js';
import { buildCollection, envelope, registerUser } from './helpers/fixtures.js';
import { prisma } from '../src/lib/prisma.js';

describe('GET /collections?mine=true (FR-043)', () => {
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

  it('returns only the caller\'s collections, ignoring others', async () => {
    const alice = await registerUser(app);
    const bob = await registerUser(app);

    await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: alice.authHeader,
      payload: envelope([
        buildCollection({ id: 'b0000000-0000-0000-0000-000000000001' }),
        buildCollection({ id: 'b0000000-0000-0000-0000-000000000002' }),
      ]),
    });
    await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: bob.authHeader,
      payload: envelope([buildCollection({ id: 'b0000000-0000-0000-0000-000000000003' })]),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/collections?mine=true',
      headers: alice.authHeader,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.collections).toHaveLength(2);
    expect(body.collections.map((c: { id: string }) => c.id).sort()).toEqual([
      'b0000000-0000-0000-0000-000000000001',
      'b0000000-0000-0000-0000-000000000002',
    ]);
    expect(typeof body.server_now).toBe('string');
  });

  it('includes both SYNCED and REJECTED rows with rejection_reason populated', async () => {
    const user = await registerUser(app);
    const good = buildCollection({ id: 'c0000000-0000-0000-0000-000000000001' });
    const bad = buildCollection({ id: 'c0000000-0000-0000-0000-000000000002' });
    (bad.attendance as Record<string, unknown>).start = -1;

    await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: user.authHeader,
      payload: envelope([good, bad]),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/collections?mine=true',
      headers: user.authHeader,
    });
    const body = res.json();
    expect(body.collections).toHaveLength(2);
    const syncedRow = body.collections.find((c: { status: string }) => c.status === 'SYNCED');
    const rejectedRow = body.collections.find((c: { status: string }) => c.status === 'REJECTED');
    expect(syncedRow?.rejection_reason).toBeNull();
    expect(rejectedRow?.rejection_reason).toContain('invalid_collection_payload');
  });

  it('filters by since parameter (client_updated_at > since)', async () => {
    const user = await registerUser(app);
    await app.inject({
      method: 'POST',
      url: '/sync/batch',
      headers: user.authHeader,
      payload: envelope([
        buildCollection({
          id: 'd0000000-0000-0000-0000-000000000001',
          clientUpdatedAt: '2026-04-10T10:00:00.000Z',
        }),
        buildCollection({
          id: 'd0000000-0000-0000-0000-000000000002',
          clientUpdatedAt: '2026-04-12T10:00:00.000Z',
        }),
      ]),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/collections?mine=true&since=2026-04-11T00:00:00.000Z',
      headers: user.authHeader,
    });
    const body = res.json();
    expect(body.collections).toHaveLength(1);
    expect(body.collections[0].id).toBe('d0000000-0000-0000-0000-000000000002');
  });

  it('rejects mine values other than "true" with 400 invalid_query', async () => {
    const user = await registerUser(app);
    const res = await app.inject({
      method: 'GET',
      url: '/collections?mine=false',
      headers: user.authHeader,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('invalid_query');
  });

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/collections?mine=true' });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('unauthenticated');
  });
});
