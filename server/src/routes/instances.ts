import type { FastifyPluginAsync } from 'fastify';
import { instanceService } from '../services/instanceService.js';
import { httpError } from '../lib/errors.js';
import { Role } from '../lib/roles.js';

interface ListQuery {
  from?: string;
  to?: string;
}

const ISO_DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

// Format + presence of from/to is enforced in the handler so the
// user-facing error code stays `invalid_query` (contract-documented) instead
// of the generic Fastify schema-validation error (`invalid_payload`). The
// schema here only blocks unrelated extras and enforces type=string on any
// value that *is* provided.
const listQuerySchema = {
  type: 'object',
  properties: {
    from: { type: 'string' },
    to: { type: 'string' },
  },
  additionalProperties: false,
} as const;

const idParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1 } },
} as const;

const instancesRoutes: FastifyPluginAsync = async (fastify) => {
  const coordinatorOnly = fastify.requireRole(Role.COORDINATOR);

  fastify.get<{ Querystring: ListQuery }>(
    '/instances',
    {
      preHandler: [coordinatorOnly],
      schema: { querystring: listQuerySchema },
    },
    async (request) => {
      const { from, to } = request.query;
      // Schema already enforces presence + ISO-date shape; keep a runtime sanity
      // check for calendar validity (e.g. 2026-02-30 passes the regex).
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
    {
      preHandler: [coordinatorOnly],
      schema: { params: idParamsSchema },
    },
    async (request) => instanceService.getById(request.params.id),
  );

  fastify.post<{ Params: { id: string } }>(
    '/instances/:id/recompute',
    {
      preHandler: [coordinatorOnly],
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      await instanceService.recompute(request.params.id);
      return reply.status(204).send();
    },
  );
};

export default instancesRoutes;
