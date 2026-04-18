import { prisma } from '../lib/prisma.js';
import { aggregateService } from './aggregateService.js';
import { httpError } from '../lib/errors.js';
import type { Role } from '../lib/roles.js';

export interface UserDto {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  accepted: boolean;
  created_at: string;
}

function toUserDto(row: {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  accepted: boolean;
  createdAt: Date;
}): UserDto {
  return {
    id: row.id,
    email: row.email,
    display_name: row.displayName,
    role: row.role,
    accepted: row.accepted,
    created_at: row.createdAt.toISOString(),
  };
}

export const moderationService = {
  async listUsers(): Promise<UserDto[]> {
    const rows = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map(toUserDto);
  },

  /**
   * Toggle accepted flag AND cascade-recompute every LessonInstance the user
   * has contributed to. Both happen inside a single transaction so readers
   * never observe the flag flip without the corresponding aggregate update
   * (FR-051, SC-006).
   */
  async toggleAccepted(userId: string, accepted: boolean): Promise<UserDto> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { id: userId } });
      if (!existing) {
        throw httpError('not_found', 'Registro não encontrado.', 404);
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: { accepted },
      });

      const instances = await tx.lessonCollection.findMany({
        where: { collectorUserId: userId },
        distinct: ['lessonInstanceId'],
        select: { lessonInstanceId: true },
      });

      // Canonical (sorted) order prevents deadlock with concurrent sync
      // batches that also acquire per-instance advisory locks. Both paths
      // must lock ids in the same order; lexicographic sort on the UUID
      // id works for both.
      const sorted = [...instances]
        .map((i) => i.lessonInstanceId)
        .sort();

      for (const lessonInstanceId of sorted) {
        await aggregateService.recompute(tx, lessonInstanceId);
      }

      return toUserDto(updated);
    });
  },
};
