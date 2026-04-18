import type { FastifyPluginAsync } from 'fastify';
import { syncService, type SyncPayload } from '../services/syncService.js';

const syncRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: SyncPayload }>(
    '/sync/batch',
    {
      bodyLimit: 5 * 1024 * 1024,
      preHandler: [fastify.requireAuth],
    },
    async (request) => {
      // request.user is guaranteed non-null by requireAuth preHandler.
      return syncService.ingestBatch(request.user!.id, request.body);
    },
  );
};

export default syncRoutes;
