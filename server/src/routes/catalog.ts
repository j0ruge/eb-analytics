import type { FastifyPluginAsync } from 'fastify';
import { catalogService } from '../services/catalogService.js';
import { httpError } from '../lib/errors.js';
import { Role } from '../lib/roles.js';

interface CatalogQuery {
  since?: string;
  include_pending?: string;
}

const catalogRoutes: FastifyPluginAsync = async (fastify) => {
  const coordinatorOnly = fastify.requireRole(Role.COORDINATOR);

  fastify.get<{ Querystring: CatalogQuery }>(
    '/catalog',
    { preHandler: [fastify.requireAuth] },
    async (request) => {
      const { since, include_pending } = request.query;

      let sinceDate: Date | undefined;
      if (since !== undefined) {
        const parsed = Date.parse(since);
        if (Number.isNaN(parsed)) {
          throw httpError('invalid_query', 'Parâmetros de consulta inválidos.', 400);
        }
        sinceDate = new Date(parsed);
      }

      const includePending = include_pending === 'true';
      if (includePending && request.user!.role !== Role.COORDINATOR) {
        throw httpError('forbidden', 'Acesso restrito a coordenadores.', 403);
      }

      return catalogService.listCatalog({
        since: sinceDate,
        includePending,
        actorRole: request.user!.role,
      });
    },
  );

  // ---------------- Series CRUD ----------------

  fastify.post<{ Body: { code?: string; title?: string; description?: string | null } }>(
    '/catalog/series',
    { preHandler: [coordinatorOnly] },
    async (request, reply) => {
      const row = await catalogService.createSeries({
        code: request.body?.code ?? '',
        title: request.body?.title ?? '',
        description: request.body?.description ?? null,
      });
      return reply.status(201).send(row);
    },
  );

  fastify.patch<{
    Params: { id: string };
    Body: { code?: string; title?: string; description?: string | null };
  }>(
    '/catalog/series/:id',
    { preHandler: [coordinatorOnly] },
    async (request) => catalogService.updateSeries(request.params.id, request.body ?? {}),
  );

  fastify.delete<{ Params: { id: string } }>(
    '/catalog/series/:id',
    { preHandler: [coordinatorOnly] },
    async (request, reply) => {
      await catalogService.deleteSeries(request.params.id);
      return reply.status(204).send();
    },
  );

  // ---------------- Topic CRUD ----------------

  fastify.post<{
    Body: {
      series_id?: string;
      title?: string;
      sequence_order?: number;
      suggested_date?: string | null;
    };
  }>(
    '/catalog/topics',
    { preHandler: [coordinatorOnly] },
    async (request, reply) => {
      const row = await catalogService.createTopic({
        series_id: request.body?.series_id ?? '',
        title: request.body?.title ?? '',
        sequence_order: request.body?.sequence_order ?? NaN,
        suggested_date: request.body?.suggested_date ?? null,
      });
      return reply.status(201).send(row);
    },
  );

  fastify.patch<{
    Params: { id: string };
    Body: { title?: string; sequence_order?: number; suggested_date?: string | null };
  }>(
    '/catalog/topics/:id',
    { preHandler: [coordinatorOnly] },
    async (request) => catalogService.updateTopic(request.params.id, request.body ?? {}),
  );

  fastify.delete<{ Params: { id: string } }>(
    '/catalog/topics/:id',
    { preHandler: [coordinatorOnly] },
    async (request, reply) => {
      await catalogService.deleteTopic(request.params.id);
      return reply.status(204).send();
    },
  );

  // ---------------- Professor CRUD ----------------

  fastify.post<{ Body: { name?: string; email?: string | null } }>(
    '/catalog/professors',
    { preHandler: [coordinatorOnly] },
    async (request, reply) => {
      const row = await catalogService.createProfessor({
        name: request.body?.name ?? '',
        email: request.body?.email ?? null,
      });
      return reply.status(201).send(row);
    },
  );

  fastify.patch<{
    Params: { id: string };
    Body: { name?: string; email?: string | null };
  }>(
    '/catalog/professors/:id',
    { preHandler: [coordinatorOnly] },
    async (request) => catalogService.updateProfessor(request.params.id, request.body ?? {}),
  );

  fastify.delete<{ Params: { id: string } }>(
    '/catalog/professors/:id',
    { preHandler: [coordinatorOnly] },
    async (request, reply) => {
      await catalogService.deleteProfessor(request.params.id);
      return reply.status(204).send();
    },
  );
};

export default catalogRoutes;
