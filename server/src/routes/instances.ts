import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { aggregateService } from '../services/aggregateService.js';
import { httpError } from '../lib/errors.js';
import { Role } from '../lib/roles.js';

interface ListQuery {
  from?: string;
  to?: string;
}

const ISO_DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

interface SerializedCollection {
  id: string;
  collector_user_id: string;
  status: string;
  attendance_start: number;
  attendance_mid: number;
  attendance_end: number;
  includes_professor: boolean;
  unique_participants: number;
}

interface SerializedInstance {
  id: string;
  date: string;
  series_code: string;
  topic_id: string | null;
  professor_id: string | null;
  agg_start: number | null;
  agg_mid: number | null;
  agg_end: number | null;
  agg_dist: number | null;
  agg_collector_count: number;
  collections: SerializedCollection[];
}

type InstanceWithCollections = NonNullable<
  Awaited<ReturnType<typeof prisma.lessonInstance.findUnique>>
> & {
  collections: Array<NonNullable<Awaited<ReturnType<typeof prisma.lessonCollection.findUnique>>>>;
};

function serializeInstance(row: InstanceWithCollections): SerializedInstance {
  return {
    id: row.id,
    date: row.date.toISOString().slice(0, 10),
    series_code: row.seriesCode,
    topic_id: row.topicId,
    professor_id: row.professorId,
    agg_start: row.aggStart,
    agg_mid: row.aggMid,
    agg_end: row.aggEnd,
    agg_dist: row.aggDist,
    agg_collector_count: row.aggCollectorCount,
    collections: row.collections.map((c) => ({
      id: c.id,
      collector_user_id: c.collectorUserId,
      status: c.status,
      attendance_start: c.attendanceStart,
      attendance_mid: c.attendanceMid,
      attendance_end: c.attendanceEnd,
      includes_professor: c.includesProfessor,
      unique_participants: c.uniqueParticipants,
    })),
  };
}

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
      const rows = await prisma.lessonInstance.findMany({
        where: { date: { gte: fromDate, lte: toDate } },
        orderBy: [{ date: 'asc' }, { seriesCode: 'asc' }],
        include: { collections: true },
      });
      return { instances: rows.map(serializeInstance) };
    },
  );

  fastify.get<{ Params: { id: string } }>(
    '/instances/:id',
    { preHandler: [coordinatorOnly] },
    async (request) => {
      const row = await prisma.lessonInstance.findUnique({
        where: { id: request.params.id },
        include: { collections: true },
      });
      if (!row) {
        throw httpError('not_found', 'Registro não encontrado.', 404);
      }
      return serializeInstance(row);
    },
  );

  fastify.post<{ Params: { id: string } }>(
    '/instances/:id/recompute',
    { preHandler: [coordinatorOnly] },
    async (request, reply) => {
      const exists = await prisma.lessonInstance.findUnique({
        where: { id: request.params.id },
      });
      if (!exists) {
        throw httpError('not_found', 'Registro não encontrado.', 404);
      }
      await prisma.$transaction(async (tx) => {
        await aggregateService.recompute(tx, request.params.id);
      });
      return reply.status(204).send();
    },
  );
};

export default instancesRoutes;
