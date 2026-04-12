/**
 * Dashboard service — computes derived, in-memory datasets for the Statistics
 * Dashboard (009-statistics-dashboard) from the existing `lessons_data` table.
 *
 * Contract: specs/009-statistics-dashboard/contracts/dashboard-service.md
 * Data model: specs/009-statistics-dashboard/data-model.md
 *
 * Invariants enforced by every function in this service:
 *   1. Status filter: WHERE status IN ('COMPLETED', 'EXPORTED', 'SYNCED').
 *   2. Parameterized queries only.
 *   3. Per-chart LIMIT from DASHBOARD_LIMITS.
 *   4. Exclusion counts are authoritative and returned alongside data.
 */
import { getDatabase } from '../db/client';
import {
  DASHBOARD_LIMITS,
  DashboardFilters,
  DashboardResult,
  LateArrivalDatum,
  AttendanceCurveDatum,
  TrendDatum,
  PunctualityDatum,
  EngagementDatum,
} from '../types/dashboard';

const STATUS_FILTER_SQL = `status IN ('COMPLETED', 'EXPORTED', 'SYNCED')`;

function parseHMM(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const match = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export const dashboardService = {
  async getLateArrivalIndex(
    _filters?: DashboardFilters,
  ): Promise<DashboardResult<LateArrivalDatum>> {
    const db = await getDatabase();

    const rows = await db.getAllAsync<{
      id: string;
      date: string;
      attendance_start: number;
      attendance_end: number;
    }>(
      `SELECT id, date, attendance_start, attendance_end
         FROM lessons_data
        WHERE ${STATUS_FILTER_SQL}
          AND attendance_start IS NOT NULL
          AND attendance_end IS NOT NULL
          AND attendance_end > 0
        ORDER BY date DESC
        LIMIT ?`,
      [DASHBOARD_LIMITS.timeSeries],
    );

    const excludedRow = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) as n
         FROM lessons_data
        WHERE ${STATUS_FILTER_SQL}
          AND (attendance_start IS NULL
               OR attendance_end IS NULL
               OR attendance_end = 0)`,
    );

    const data: LateArrivalDatum[] = rows
      .slice()
      .reverse()
      .map((r) => {
        const isInconsistent = r.attendance_end < r.attendance_start;
        const percent = isInconsistent
          ? 0
          : Math.round(
              ((r.attendance_end - r.attendance_start) / r.attendance_end) *
                1000,
            ) / 10;
        return {
          lessonId: r.id,
          date: r.date,
          percent,
          attendanceStart: r.attendance_start,
          attendanceEnd: r.attendance_end,
          lateCount: Math.max(0, r.attendance_end - r.attendance_start),
          isInconsistent,
        };
      });

    return { data, excludedCount: excludedRow?.n ?? 0 };
  },

  async getAttendanceCurves(
    _filters?: DashboardFilters,
  ): Promise<DashboardResult<AttendanceCurveDatum>> {
    const db = await getDatabase();

    const rows = await db.getAllAsync<{
      id: string;
      date: string;
      topic_title: string | null;
      attendance_start: number | null;
      attendance_mid: number | null;
      attendance_end: number | null;
    }>(
      `SELECT l.id, l.date, t.title as topic_title,
              l.attendance_start, l.attendance_mid, l.attendance_end
         FROM lessons_data l
         LEFT JOIN lesson_topics t ON t.id = l.lesson_topic_id
        WHERE ${STATUS_FILTER_SQL}
          AND ((CASE WHEN l.attendance_start IS NOT NULL THEN 1 ELSE 0 END)
             + (CASE WHEN l.attendance_mid   IS NOT NULL THEN 1 ELSE 0 END)
             + (CASE WHEN l.attendance_end   IS NOT NULL THEN 1 ELSE 0 END)) >= 2
        ORDER BY l.date DESC
        LIMIT ?`,
      [DASHBOARD_LIMITS.timeSeries],
    );

    const excludedRow = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) as n
         FROM lessons_data
        WHERE ${STATUS_FILTER_SQL}
          AND ((CASE WHEN attendance_start IS NOT NULL THEN 1 ELSE 0 END)
             + (CASE WHEN attendance_mid   IS NOT NULL THEN 1 ELSE 0 END)
             + (CASE WHEN attendance_end   IS NOT NULL THEN 1 ELSE 0 END)) < 2`,
    );

    const data: AttendanceCurveDatum[] = rows
      .slice()
      .reverse()
      .map((r) => ({
        lessonId: r.id,
        date: r.date,
        topicTitle: r.topic_title,
        start: r.attendance_start,
        mid: r.attendance_mid,
        end: r.attendance_end,
      }));

    return { data, excludedCount: excludedRow?.n ?? 0 };
  },

  async getAttendanceTrend(
    _filters?: DashboardFilters,
  ): Promise<DashboardResult<TrendDatum>> {
    const db = await getDatabase();

    const rows = await db.getAllAsync<{
      id: string;
      date: string;
      attendance_end: number;
    }>(
      `SELECT id, date, attendance_end
         FROM lessons_data
        WHERE ${STATUS_FILTER_SQL}
          AND attendance_end IS NOT NULL
        ORDER BY date DESC
        LIMIT ?`,
      [DASHBOARD_LIMITS.trend],
    );

    const excludedRow = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) as n
         FROM lessons_data
        WHERE ${STATUS_FILTER_SQL}
          AND attendance_end IS NULL`,
    );

    const data: TrendDatum[] = rows
      .slice()
      .reverse()
      .map((r) => ({
        lessonId: r.id,
        date: r.date,
        attendanceEnd: r.attendance_end,
      }));

    return { data, excludedCount: excludedRow?.n ?? 0 };
  },

  async getPunctuality(
    _filters?: DashboardFilters,
  ): Promise<DashboardResult<PunctualityDatum>> {
    const db = await getDatabase();

    const rows = await db.getAllAsync<{
      id: string;
      date: string;
      time_expected_start: string | null;
      time_real_start: string | null;
    }>(
      `SELECT id, date, time_expected_start, time_real_start
         FROM lessons_data
        WHERE ${STATUS_FILTER_SQL}
          AND time_real_start IS NOT NULL
        ORDER BY date DESC
        LIMIT ?`,
      [DASHBOARD_LIMITS.timeSeries],
    );

    const excludedRow = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) as n
         FROM lessons_data
        WHERE ${STATUS_FILTER_SQL}
          AND time_real_start IS NULL`,
    );

    const data: PunctualityDatum[] = rows
      .slice()
      .reverse()
      .map((r) => {
        const realMin = parseHMM(r.time_real_start);
        const expectedMin = parseHMM(r.time_expected_start) ?? 10 * 60;
        const minutesLate =
          realMin === null ? 0 : realMin - expectedMin;
        return {
          lessonId: r.id,
          date: r.date,
          minutesLate,
        };
      });

    return { data, excludedCount: excludedRow?.n ?? 0 };
  },

  async getEngagementRate(
    _filters?: DashboardFilters,
  ): Promise<DashboardResult<EngagementDatum>> {
    const db = await getDatabase();

    const rows = await db.getAllAsync<{
      id: string;
      date: string;
      unique_participants: number;
      attendance_end: number;
    }>(
      `SELECT id, date, unique_participants, attendance_end
         FROM lessons_data
        WHERE ${STATUS_FILTER_SQL}
          AND attendance_end IS NOT NULL
          AND attendance_end > 0
        ORDER BY date DESC
        LIMIT ?`,
      [DASHBOARD_LIMITS.timeSeries],
    );

    const excludedRow = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) as n
         FROM lessons_data
        WHERE ${STATUS_FILTER_SQL}
          AND (attendance_end IS NULL OR attendance_end = 0)`,
    );

    const data: EngagementDatum[] = rows
      .slice()
      .reverse()
      .map((r) => {
        const participants = r.unique_participants ?? 0;
        const rate =
          Math.round((participants / r.attendance_end) * 1000) / 10;
        return {
          lessonId: r.id,
          date: r.date,
          rate,
          uniqueParticipants: participants,
          attendanceEnd: r.attendance_end,
        };
      });

    return { data, excludedCount: excludedRow?.n ?? 0 };
  },
};
