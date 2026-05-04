import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, resetDb } from './helpers/buildTestApp.js';
import { buildCollection, envelope, registerUser } from './helpers/fixtures.js';
import { prisma } from '../src/lib/prisma.js';

describe('Coordinator catalog mutations (US-6)', () => {
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

  describe('Series', () => {
    it('create → appears in GET /catalog, PATCH refreshes updated_at, DELETE works when unreferenced', async () => {
      const coord = await registerUser(app);
      const created = await app.inject({
        method: 'POST',
        url: '/catalog/series',
        headers: coord.authHeader,
        payload: { code: 'EB357', title: 'Nova Série' },
      });
      expect(created.statusCode).toBe(201);
      const id = created.json().id;

      const list = await app.inject({
        method: 'GET',
        url: '/catalog',
        headers: coord.authHeader,
      });
      expect(list.json().series.some((s: { id: string }) => s.id === id)).toBe(true);

      const firstUpdatedAt = created.json().updated_at;
      await new Promise((r) => setTimeout(r, 5));
      const patched = await app.inject({
        method: 'PATCH',
        url: `/catalog/series/${id}`,
        headers: coord.authHeader,
        payload: { title: 'Novo Título' },
      });
      expect(patched.statusCode).toBe(200);
      expect(patched.json().title).toBe('Novo Título');
      expect(patched.json().updated_at > firstUpdatedAt).toBe(true);

      const deleted = await app.inject({
        method: 'DELETE',
        url: `/catalog/series/${id}`,
        headers: coord.authHeader,
      });
      expect(deleted.statusCode).toBe(204);
    });

    it('DELETE returns 409 series_referenced when a LessonInstance uses its code', async () => {
      const coord = await registerUser(app);
      const series = await prisma.lessonSeries.create({
        data: { code: 'EB358', title: 'Ref', isPending: false },
      });
      await app.inject({
        method: 'POST',
        url: '/sync/batch',
        headers: coord.authHeader,
        payload: envelope([
          buildCollection({
            id: '1a1a0000-0000-0000-0000-000000000001',
            seriesCode: 'EB358',
            date: '2026-04-11',
          }),
        ]),
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/catalog/series/${series.id}`,
        headers: coord.authHeader,
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('series_referenced');
    });

    it('POST with duplicate code returns 409 code_already_exists', async () => {
      const coord = await registerUser(app);
      await prisma.lessonSeries.create({
        data: { code: 'DUP', title: 'First', isPending: false },
      });
      const res = await app.inject({
        method: 'POST',
        url: '/catalog/series',
        headers: coord.authHeader,
        payload: { code: 'DUP', title: 'Second' },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('code_already_exists');
    });

    it('collector cannot mutate — 403 forbidden', async () => {
      await registerUser(app); // coord
      const collector = await registerUser(app);
      const res = await app.inject({
        method: 'POST',
        url: '/catalog/series',
        headers: collector.authHeader,
        payload: { code: 'EB999', title: 'x' },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe('forbidden');
    });
  });

  describe('Topics', () => {
    it('CRUD full cycle', async () => {
      const coord = await registerUser(app);
      const series = await prisma.lessonSeries.create({
        data: { code: 'EB400', title: 's', isPending: false },
      });
      const created = await app.inject({
        method: 'POST',
        url: '/catalog/topics',
        headers: coord.authHeader,
        payload: { series_id: series.id, title: 'Tópico 1', sequence_order: 1 },
      });
      expect(created.statusCode).toBe(201);
      const id = created.json().id;

      const patched = await app.inject({
        method: 'PATCH',
        url: `/catalog/topics/${id}`,
        headers: coord.authHeader,
        payload: { sequence_order: 5 },
      });
      expect(patched.json().sequence_order).toBe(5);

      const deleted = await app.inject({
        method: 'DELETE',
        url: `/catalog/topics/${id}`,
        headers: coord.authHeader,
      });
      expect(deleted.statusCode).toBe(204);
    });

    it('DELETE returns 409 topic_referenced when used by a LessonInstance', async () => {
      const coord = await registerUser(app);
      const series = await prisma.lessonSeries.create({
        data: { code: 'EB401', title: 's', isPending: false },
      });
      const topic = await prisma.lessonTopic.create({
        data: { seriesId: series.id, title: 'T', sequenceOrder: 1, isPending: false },
      });
      await prisma.lessonInstance.create({
        data: {
          date: new Date('2026-04-11'),
          seriesCode: 'EB401',
          topicId: topic.id,
        },
      });
      const res = await app.inject({
        method: 'DELETE',
        url: `/catalog/topics/${topic.id}`,
        headers: coord.authHeader,
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('topic_referenced');
    });
  });

  describe('Professors', () => {
    it('CRUD full cycle with email', async () => {
      const coord = await registerUser(app);
      const created = await app.inject({
        method: 'POST',
        url: '/catalog/professors',
        headers: coord.authHeader,
        payload: { name: 'Prof A', email: 'a@example.com' },
      });
      expect(created.statusCode).toBe(201);
      expect(created.json().email).toBe('a@example.com');
      const id = created.json().id;

      const patched = await app.inject({
        method: 'PATCH',
        url: `/catalog/professors/${id}`,
        headers: coord.authHeader,
        payload: { name: 'Prof A (updated)' },
      });
      expect(patched.json().name).toBe('Prof A (updated)');

      const deleted = await app.inject({
        method: 'DELETE',
        url: `/catalog/professors/${id}`,
        headers: coord.authHeader,
      });
      expect(deleted.statusCode).toBe(204);
    });

    it('POST with duplicate email returns 409 email_already_exists', async () => {
      const coord = await registerUser(app);
      await prisma.professor.create({
        data: { name: 'First', email: 'dup@example.com', isPending: false },
      });
      const res = await app.inject({
        method: 'POST',
        url: '/catalog/professors',
        headers: coord.authHeader,
        payload: { name: 'Second', email: 'dup@example.com' },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('email_already_exists');
    });

    it('DELETE returns 409 professor_referenced when used by a LessonInstance', async () => {
      const coord = await registerUser(app);
      const prof = await prisma.professor.create({
        data: { name: 'Referenced', isPending: false },
      });
      await prisma.lessonInstance.create({
        data: {
          date: new Date('2026-04-11'),
          seriesCode: 'EB500',
          professorId: prof.id,
        },
      });
      const res = await app.inject({
        method: 'DELETE',
        url: `/catalog/professors/${prof.id}`,
        headers: coord.authHeader,
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('professor_referenced');
    });

    it('POST with doc_id persists and round-trips via GET /catalog', async () => {
      const coord = await registerUser(app);
      const created = await app.inject({
        method: 'POST',
        url: '/catalog/professors',
        headers: coord.authHeader,
        payload: { name: 'Prof CPF', doc_id: '11144477735' },
      });
      expect(created.statusCode).toBe(201);
      expect(created.json().doc_id).toBe('11144477735');

      const list = await app.inject({
        method: 'GET',
        url: '/catalog',
        headers: coord.authHeader,
      });
      const found = list
        .json()
        .professors.find((p: { id: string }) => p.id === created.json().id);
      expect(found.doc_id).toBe('11144477735');
    });

    it('PATCH updates doc_id', async () => {
      const coord = await registerUser(app);
      const prof = await prisma.professor.create({
        data: { name: 'Prof', isPending: false },
      });
      const patched = await app.inject({
        method: 'PATCH',
        url: `/catalog/professors/${prof.id}`,
        headers: coord.authHeader,
        payload: { doc_id: '52998224725' },
      });
      expect(patched.statusCode).toBe(200);
      expect(patched.json().doc_id).toBe('52998224725');
    });

    it('POST with duplicate doc_id returns 409 doc_id_already_exists', async () => {
      const coord = await registerUser(app);
      await prisma.professor.create({
        data: { name: 'First', docId: '11144477735', isPending: false },
      });
      const res = await app.inject({
        method: 'POST',
        url: '/catalog/professors',
        headers: coord.authHeader,
        payload: { name: 'Second', doc_id: '11144477735' },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('doc_id_already_exists');
    });

    it('POST with invalid doc_id format returns 400', async () => {
      const coord = await registerUser(app);
      const res = await app.inject({
        method: 'POST',
        url: '/catalog/professors',
        headers: coord.authHeader,
        payload: { name: 'Prof', doc_id: '123' },
      });
      // Fastify schema validation rejects pattern mismatch with 400
      expect(res.statusCode).toBe(400);
    });

    it('POST without doc_id is allowed and returns doc_id: null', async () => {
      const coord = await registerUser(app);
      const created = await app.inject({
        method: 'POST',
        url: '/catalog/professors',
        headers: coord.authHeader,
        payload: { name: 'Prof Sem CPF' },
      });
      expect(created.statusCode).toBe(201);
      expect(created.json().doc_id).toBeNull();
    });
  });

  // Tests for the idempotent-create divergence detection added alongside the
  // catalog write-back queue work. The mobile client sends client-generated
  // ids on POST so a replay of the same payload returns the existing row
  // (idempotent), but a replay with a divergent payload now surfaces
  // id_conflict instead of silently returning stale data.
  describe('Idempotent CREATE with client-supplied id', () => {
    it('series: same id, same payload → 201 returns existing row', async () => {
      const coord = await registerUser(app);
      const id = '11111111-1111-1111-1111-111111111111';
      const first = await app.inject({
        method: 'POST',
        url: '/catalog/series',
        headers: coord.authHeader,
        payload: { id, code: 'EB400', title: 'Replay' },
      });
      expect(first.statusCode).toBe(201);

      const replay = await app.inject({
        method: 'POST',
        url: '/catalog/series',
        headers: coord.authHeader,
        payload: { id, code: 'EB400', title: 'Replay' },
      });
      expect(replay.statusCode).toBe(201);
      expect(replay.json().id).toBe(id);
    });

    it('series: same id, different payload → 409 id_conflict', async () => {
      const coord = await registerUser(app);
      const id = '22222222-2222-2222-2222-222222222222';
      await app.inject({
        method: 'POST',
        url: '/catalog/series',
        headers: coord.authHeader,
        payload: { id, code: 'EB401', title: 'Original' },
      });

      const divergent = await app.inject({
        method: 'POST',
        url: '/catalog/series',
        headers: coord.authHeader,
        payload: { id, code: 'EB401', title: 'Different Title' },
      });
      expect(divergent.statusCode).toBe(409);
      expect(divergent.json().code).toBe('id_conflict');
    });

    it('series: different id, same code → 409 code_already_exists', async () => {
      const coord = await registerUser(app);
      await app.inject({
        method: 'POST',
        url: '/catalog/series',
        headers: coord.authHeader,
        payload: { code: 'EB402', title: 'A' },
      });

      const conflict = await app.inject({
        method: 'POST',
        url: '/catalog/series',
        headers: coord.authHeader,
        payload: { code: 'EB402', title: 'B' },
      });
      expect(conflict.statusCode).toBe(409);
      expect(conflict.json().code).toBe('code_already_exists');
    });

    it('topic: same id, divergent series_id → 409 id_conflict', async () => {
      const coord = await registerUser(app);
      const seriesA = await prisma.lessonSeries.create({
        data: { code: 'EB403', title: 'A', isPending: false },
      });
      const seriesB = await prisma.lessonSeries.create({
        data: { code: 'EB404', title: 'B', isPending: false },
      });
      const id = '33333333-3333-3333-3333-333333333333';

      const first = await app.inject({
        method: 'POST',
        url: '/catalog/topics',
        headers: coord.authHeader,
        payload: { id, series_id: seriesA.id, title: 'T', sequence_order: 1 },
      });
      expect(first.statusCode).toBe(201);

      const divergent = await app.inject({
        method: 'POST',
        url: '/catalog/topics',
        headers: coord.authHeader,
        payload: { id, series_id: seriesB.id, title: 'T', sequence_order: 1 },
      });
      expect(divergent.statusCode).toBe(409);
      expect(divergent.json().code).toBe('id_conflict');
    });

    it('topic: missing series_id → 404 not_found (race-safe)', async () => {
      const coord = await registerUser(app);
      const res = await app.inject({
        method: 'POST',
        url: '/catalog/topics',
        headers: coord.authHeader,
        payload: {
          series_id: '99999999-9999-9999-9999-999999999999',
          title: 'Orphan',
          sequence_order: 1,
        },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe('not_found');
    });

    it('professor: same id, different name → 409 id_conflict', async () => {
      const coord = await registerUser(app);
      const id = '44444444-4444-4444-4444-444444444444';
      await app.inject({
        method: 'POST',
        url: '/catalog/professors',
        headers: coord.authHeader,
        payload: { id, name: 'Original' },
      });
      const divergent = await app.inject({
        method: 'POST',
        url: '/catalog/professors',
        headers: coord.authHeader,
        payload: { id, name: 'Renamed' },
      });
      expect(divergent.statusCode).toBe(409);
      expect(divergent.json().code).toBe('id_conflict');
    });

    it('professor: same id, different doc_id → 409 id_conflict', async () => {
      const coord = await registerUser(app);
      const id = '55555555-5555-5555-5555-555555555555';
      await app.inject({
        method: 'POST',
        url: '/catalog/professors',
        headers: coord.authHeader,
        payload: { id, name: 'Same', doc_id: '11144477735' },
      });
      const divergent = await app.inject({
        method: 'POST',
        url: '/catalog/professors',
        headers: coord.authHeader,
        payload: { id, name: 'Same', doc_id: '52998224725' },
      });
      expect(divergent.statusCode).toBe(409);
      expect(divergent.json().code).toBe('id_conflict');
    });

    it('professor: same id, same doc_id → idempotent 201 with existing row', async () => {
      const coord = await registerUser(app);
      const id = '66666666-6666-6666-6666-666666666666';
      const first = await app.inject({
        method: 'POST',
        url: '/catalog/professors',
        headers: coord.authHeader,
        payload: { id, name: 'Replay', doc_id: '11144477735' },
      });
      expect(first.statusCode).toBe(201);

      const replay = await app.inject({
        method: 'POST',
        url: '/catalog/professors',
        headers: coord.authHeader,
        payload: { id, name: 'Replay', doc_id: '11144477735' },
      });
      expect(replay.statusCode).toBe(201);
      expect(replay.json().id).toBe(id);
      expect(replay.json().doc_id).toBe('11144477735');
    });
  });
});
