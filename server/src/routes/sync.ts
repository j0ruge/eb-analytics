import type { FastifyPluginAsync } from 'fastify';
import { syncService, type SyncPayload } from '../services/syncService.js';

// Envelope-level schema. Deep per-collection validation remains in
// syncService so we can classify individual failures as
// `invalid_collection_payload` rejections rather than failing the whole
// batch. This schema rejects obviously-malformed envelopes at the HTTP
// boundary.
const batchBodySchema = {
  type: 'object',
  required: ['collections'],
  properties: {
    // schema_version is validated by assertSchemaVersion so the absent /
    // wrong-value case returns the specific error codes
    // `schema_version_required` / `schema_version_unsupported` (EC-006).
    schema_version: { type: 'string' },
    client: { type: 'object' },
    collector: {},
    exported_at: { type: 'string' },
    collections: {
      type: 'array',
      minItems: 1,
      items: { type: 'object' },
    },
  },
} as const;

const syncRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: SyncPayload }>(
    '/sync/batch',
    {
      bodyLimit: 5 * 1024 * 1024,
      preHandler: [fastify.requireAuth],
      schema: { body: batchBodySchema },
    },
    async (request) => {
      return syncService.ingestBatch(request.user!.id, request.body);
    },
  );
};

export default syncRoutes;
