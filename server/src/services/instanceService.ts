import { prisma } from '../lib/prisma.js';
import { aggregateService } from './aggregateService.js';
import { httpError } from '../lib/errors.js';

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

export interface SerializedInstance {
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

function serialize(row: {
  id: string;
  date: Date;
  seriesCode: string;
  topicId: string | null;
  professorId: string | null;
  aggStart: number | null;
  aggMid: number | null;
  aggEnd: number | null;
  aggDist: number | null;
  aggCollectorCount: number;
  collections: Array<{
    id: string;
    collectorUserId: string;
    status: string;
    attendanceStart: number;
    attendanceMid: number;
    attendanceEnd: number;
    includesProfessor: boolean;
    uniqueParticipants: number;
  }>;
}): SerializedInstance {
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

export const instanceService = {
  async list(from: Date, to: Date): Promise<{ instances: SerializedInstance[] }> {
    const rows = await prisma.lessonInstance.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: [{ date: 'asc' }, { seriesCode: 'asc' }],
      include: { collections: true },
    });
    return { instances: rows.map(serialize) };
  },

  async getById(id: string): Promise<SerializedInstance> {
    const row = await prisma.lessonInstance.findUnique({
      where: { id },
      include: { collections: true },
    });
    if (!row) {
      throw httpError('not_found', 'Registro não encontrado.', 404);
    }
    return serialize(row);
  },

  async recompute(id: string): Promise<void> {
    const exists = await prisma.lessonInstance.findUnique({ where: { id } });
    if (!exists) {
      throw httpError('not_found', 'Registro não encontrado.', 404);
    }
    await prisma.$transaction(async (tx) => {
      await aggregateService.recompute(tx, id);
    });
  },
};
