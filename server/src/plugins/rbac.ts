import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { httpError } from '../lib/errors.js';
import { Role } from '../lib/roles.js';

declare module 'fastify' {
  interface FastifyInstance {
    requireRole: (role: Role) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const rbacPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('requireAuth', async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.user) {
      throw httpError('unauthenticated', 'Credencial ausente ou inválida.', 401);
    }
  });

  fastify.decorate('requireRole', (role: Role) => {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      if (!request.user) {
        throw httpError('unauthenticated', 'Credencial ausente ou inválida.', 401);
      }
      if (request.user.role !== role) {
        throw httpError('forbidden', 'Acesso não autorizado.', 403);
      }
    };
  });
};

export default fp(rbacPlugin, { name: 'rbac', dependencies: ['auth'] });
