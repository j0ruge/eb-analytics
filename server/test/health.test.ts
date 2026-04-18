import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from './helpers/buildTestApp.js';
import { prisma } from '../src/lib/prisma.js';

describe('GET /health (US-7)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('scenario 1: Postgres reachable → 200 {status:"ok", postgres:"up"}', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', postgres: 'up' });
  });

  it('scenario 1b: /health requires no auth (FR-060 exemption)', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
  });

  it('scenario 2: Postgres probe failure → 503 {status:"degraded", postgres:"down"}', async () => {
    // Stub $queryRawUnsafe to simulate a DB outage.
    const spy = vi
      .spyOn(prisma, '$queryRawUnsafe')
      .mockRejectedValueOnce(new Error('connection refused'));
    try {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual({ status: 'degraded', postgres: 'down' });
    } finally {
      spy.mockRestore();
    }
  });
});
