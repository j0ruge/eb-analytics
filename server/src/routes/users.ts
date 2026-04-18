import type { FastifyPluginAsync } from 'fastify';
import { moderationService } from '../services/moderationService.js';
import { httpError } from '../lib/errors.js';
import { Role } from '../lib/roles.js';

interface PatchBody {
  accepted?: unknown;
}

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  const coordinatorOnly = fastify.requireRole(Role.COORDINATOR);

  fastify.get('/users', { preHandler: [coordinatorOnly] }, async () => {
    const users = await moderationService.listUsers();
    return { users };
  });

  fastify.patch<{ Params: { id: string }; Body: PatchBody }>(
    '/users/:id/accepted',
    { preHandler: [coordinatorOnly] },
    async (request) => {
      if (typeof request.body?.accepted !== 'boolean') {
        throw httpError('invalid_payload', 'Campo accepted ausente ou inválido.', 400);
      }
      return moderationService.toggleAccepted(request.params.id, request.body.accepted);
    },
  );
};

export default usersRoutes;
