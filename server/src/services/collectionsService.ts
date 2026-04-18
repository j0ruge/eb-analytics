import { prisma } from '../lib/prisma.js';

export interface CollectionMineRow {
  id: string;
  lesson_instance_id: string;
  status: string;
  rejection_reason: string | null;
  client_updated_at: string;
  server_received_at: string;
  attendance_start: number;
  attendance_mid: number;
  attendance_end: number;
  includes_professor: boolean;
  unique_participants: number;
}

export interface ListMineResponse {
  collections: CollectionMineRow[];
  server_now: string;
}

export const collectionsService = {
  async listMine(userId: string, since?: Date): Promise<ListMineResponse> {
    const rows = await prisma.lessonCollection.findMany({
      where: {
        collectorUserId: userId,
        ...(since ? { clientUpdatedAt: { gt: since } } : {}),
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
};
