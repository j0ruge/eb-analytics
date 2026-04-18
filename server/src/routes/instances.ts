import type { FastifyPluginAsync } from 'fastify';
import { instanceService } from '../services/instanceService.js';
import { httpError } from '../lib/errors.js';
import { Role } from '../lib/roles.js';

interface ListQuery {
  from?: string;
  to?: string;
}

const ISO_DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

const instancesRoutes: FastifyPluginAsync = async (fastify) => {
  const coordinatorOnly = fastify.requireRole(Role.COORDINATOR);

  fastify.get<{ Querystring: ListQuery }>(
    '/instances',
    { preHandler: [coordinatorOnly] },
    async (request) => {
      const { from, to } = request.query;
      if (!from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to)) {
        throw httpError(
          'invalid_query',
          'Parâmetros from/to obrigatórios no formato YYYY-MM-DD.',
          400,
        );
      }
      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        throw httpError('invalid_query', 'Parâmetros de consulta inválidos.', 400);
      }
      return instanceService.list(fromDate, toDate);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    '/instances/:id',
    { preHandler: [coordinatorOnly] },
    async (request) => instanceService.getById(request.params.id),
  );

  fastify.post<{ Params: { id: string } }>(
    '/instances/:id/recompute',
    { preHandler: [coordinatorOnly] },
    async (request, reply) => {
      await instanceService.recompute(request.params.id);
      return reply.status(204).send();
    },
  );
};

export default instancesRoutes;
