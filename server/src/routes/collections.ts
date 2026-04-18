import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
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

      const rows = await prisma.lessonCollection.findMany({
        where: {
          collectorUserId: request.user!.id,
          ...(sinceDate ? { clientUpdatedAt: { gt: sinceDate } } : {}),
        },
        orderBy: { clientUpdatedAt: 'asc' },
      });

      return {
        collections: rows.map((r) => ({
          id: r.id,
          lesson_instance_id: r.lessonInstanceId,
          status: r.status,
          rejection_reason: r.rejectionReason,
          client_updated_at: r.clientUpdatedAt.toISOString(),
          server_received_at: r.serverReceivedAt.toISOString(),
          attendance_start: r.attendanceStart,
          attendance_mid: r.attendanceMid,
          attendance_end: r.attendanceEnd,
          includes_professor: r.includesProfessor,
          unique_participants: r.uniqueParticipants,
        })),
        server_now: new Date().toISOString(),
      };
    },
  );
};

export default collectionsRoutes;
