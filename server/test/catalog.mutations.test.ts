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
  });
});
