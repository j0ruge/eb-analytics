import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { verifyToken, type JwtUser } from '../lib/jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; role: JwtUser['role'] } | null;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('user', null);

  fastify.addHook('onRequest', async (request) => {
    request.user = null;
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return;
    const token = header.slice('Bearer '.length).trim();
    if (!token) return;
    try {
      const payload = verifyToken(token);
      request.user = { id: payload.sub, role: payload.role };
    } catch (err) {
      // A token was presented but failed verification — surface at warn
      // level so forged/tampered attempts leave a trail. Request is still
      // treated as anonymous (requireAuth rejects later if needed).
      request.log.warn({ err }, 'jwt verification failed');
    }
  });
};

export default fp(authPlugin, { name: 'auth' });
