import type { FastifyPluginAsync } from 'fastify';
import { collectionsService } from '../services/collectionsService.js';
import { httpError } from '../lib/errors.js';

interface MineQuery {
  mine?: string;
  since?: string;
}

const collectionsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: MineQuery }>(
    '/collections',
    { preHandler: [fastify.requireAuth] },
    async (request) => {
      const { mine, since } = request.query;
      if (mine !== 'true') {
        throw httpError('invalid_query', 'Parâmetros de consulta inválidos.', 400);
      }
      let sinceDate: Date | undefined;
      if (since !== undefined) {
        const parsed = Date.parse(since);
        if (Number.isNaN(parsed)) {
          throw httpError('invalid_query', 'Parâmetros de consulta inválidos.', 400);
        }
        sinceDate = new Date(parsed);
      }
      return collectionsService.listMine(request.user!.id, sinceDate);
    },
  );
};

export default collectionsRoutes;
