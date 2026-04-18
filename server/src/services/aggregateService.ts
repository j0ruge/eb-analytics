import { prisma } from '../lib/prisma.js';
import { median } from '../lib/median.js';

type TransactionFn = Parameters<typeof prisma.$transaction>[0];
export type Tx = Parameters<Extract<TransactionFn, (...args: never[]) => unknown>>[0];

interface EligibleCollection {
  attendanceStart: number;
  attendanceMid: number;
  attendanceEnd: number;
  uniqueParticipants: number;
  includesProfessor: boolean;
}

function normalize(value: number, includesProfessor: boolean): number {
  // Strict `=== true` guards against any future driver quirk that returns
  // booleans as truthy non-boolean values (e.g. the string "t").
  return includesProfessor === true ? Math.max(0, value - 1) : value;
}

/**
 * Recompute aggregate cache for a single LessonInstance.
 *
 * Rules (Aggregation Rules §1-4, research §9):
 *  - Acquire pg_advisory_xact_lock(hashtext(id)) to serialize same-instance work.
 *  - Eligibility: status = SYNCED AND (acceptedOverride = true OR
 *    (acceptedOverride IS NULL AND user.accepted = true)).
 *  - Normalize attendance* by −1 when includesProfessor is true.
 *  - Aggregate = median (lower-middle tie-break).
 *  - When no eligible rows: set all agg* to null and aggCollectorCount = 0.
 */
export const aggregateService = {
  async recompute(tx: Tx, lessonInstanceId: string): Promise<void> {
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      lessonInstanceId,
    );

    const rows = await tx.$queryRawUnsafe<EligibleCollection[]>(
      `
      SELECT c."attendanceStart"          AS "attendanceStart",
             c."attendanceMid"            AS "attendanceMid",
             c."attendanceEnd"            AS "attendanceEnd",
             c."uniqueParticipants"       AS "uniqueParticipants",
             c."includesProfessor"::bool  AS "includesProfessor"
      FROM "LessonCollection" c
      JOIN "User" u ON u.id = c."collectorUserId"
      WHERE c."lessonInstanceId" = $1
        AND c."status" = 'SYNCED'
        AND (c."acceptedOverride" = true
             OR (c."acceptedOverride" IS NULL AND u."accepted" = true))
      `,
      lessonInstanceId,
    );

    if (rows.length === 0) {
      await tx.lessonInstance.update({
        where: { id: lessonInstanceId },
        data: {
          aggStart: null,
          aggMid: null,
          aggEnd: null,
          aggDist: null,
          aggCollectorCount: 0,
        },
      });
      return;
    }

    const starts = rows.map((r: EligibleCollection) => normalize(r.attendanceStart, r.includesProfessor));
    const mids = rows.map((r: EligibleCollection) => normalize(r.attendanceMid, r.includesProfessor));
    const ends = rows.map((r: EligibleCollection) => normalize(r.attendanceEnd, r.includesProfessor));
    const dist = rows.map((r: EligibleCollection) => r.uniqueParticipants);

    await tx.lessonInstance.update({
      where: { id: lessonInstanceId },
      data: {
        aggStart: median(starts),
        aggMid: median(mids),
        aggEnd: median(ends),
        aggDist: median(dist),
        aggCollectorCount: rows.length,
      },
    });
  },
};
