import { dashboardService } from '../../src/services/dashboardService';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

jest.mock('../../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

import { getDatabase } from '../../src/db/client';

type Row = Record<string, unknown>;

interface MockDb {
  getAllAsync: jest.Mock;
  getFirstAsync: jest.Mock;
  runAsync: jest.Mock;
}

describe('dashboardService', () => {
  let mockDb: MockDb;

  beforeEach(() => {
    mockDb = {
      getAllAsync: jest.fn(),
      getFirstAsync: jest.fn(),
      runAsync: jest.fn(),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);
  });

  // ------------------------------------------------------------------
  // getLateArrivalIndex
  // ------------------------------------------------------------------
  describe('getLateArrivalIndex', () => {
    const mkRow = (
      id: string,
      date: string,
      start: number,
      end: number,
    ): Row => ({
      id,
      date,
      attendance_start: start,
      attendance_end: end,
    });

    it('computes percent matching US1 acceptance scenario 1', async () => {
      // Rows returned DESC by SQL → reversed to chronological ASC
      mockDb.getAllAsync.mockResolvedValueOnce([
        mkRow('4', '2026-02-14', 4, 24), // newest
        mkRow('3', '2026-02-07', 16, 26),
        mkRow('2', '2026-01-31', 10, 28),
        mkRow('1', '2026-01-24', 7, 25), // oldest
      ]);
      mockDb.getFirstAsync.mockResolvedValueOnce({ n: 0 });

      const result = await dashboardService.getLateArrivalIndex();

      expect(result.excludedCount).toBe(0);
      expect(result.data).toHaveLength(4);
      expect(result.data[0].lessonId).toBe('1');
      expect(result.data[3].lessonId).toBe('4');
      expect(result.data[0].percent).toBeCloseTo(72.0, 1);
      expect(result.data[1].percent).toBeCloseTo(64.3, 1);
      expect(result.data[2].percent).toBeCloseTo(38.5, 1);
      expect(result.data[3].percent).toBeCloseTo(83.3, 1);
    });

    it('filters IN_PROGRESS via the SQL status predicate', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]);
      mockDb.getFirstAsync.mockResolvedValueOnce({ n: 0 });

      await dashboardService.getLateArrivalIndex();

      const calledSql = mockDb.getAllAsync.mock.calls[0][0] as string;
      expect(calledSql).toMatch(/status IN \('COMPLETED', 'EXPORTED', 'SYNCED'\)/);
      expect(calledSql).not.toMatch(/IN_PROGRESS/);
    });

    it('includes COMPLETED / EXPORTED / SYNCED rows (caller responsibility, we just verify SQL)', async () => {
      // The SQL filter is asserted above; here we assert the function does not
      // apply any additional JS-level filtering that would drop these rows.
      mockDb.getAllAsync.mockResolvedValueOnce([
        { id: 'a', date: '2026-01-01', attendance_start: 5, attendance_end: 10 },
        { id: 'b', date: '2026-01-08', attendance_start: 5, attendance_end: 10 },
        { id: 'c', date: '2026-01-15', attendance_start: 5, attendance_end: 10 },
      ]);
      mockDb.getFirstAsync.mockResolvedValueOnce({ n: 0 });

      const result = await dashboardService.getLateArrivalIndex();
      expect(result.data).toHaveLength(3);
    });

    it('excluded count reflects null/zero end and null start', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]);
      mockDb.getFirstAsync.mockResolvedValueOnce({ n: 3 });

      const result = await dashboardService.getLateArrivalIndex();
      expect(result.excludedCount).toBe(3);
    });

    it('flags inconsistent rows (end < start) with percent=0 and isInconsistent=true', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([
        { id: 'bad', date: '2026-01-01', attendance_start: 20, attendance_end: 10 },
      ]);
      mockDb.getFirstAsync.mockResolvedValueOnce({ n: 0 });

      const result = await dashboardService.getLateArrivalIndex();
      expect(result.data[0].percent).toBe(0);
      expect(result.data[0].isInconsistent).toBe(true);
      expect(result.data[0].lateCount).toBe(0);
    });

    it('limits to DASHBOARD_LIMITS.timeSeries via SQL param', async () => {
      const twenty = Array.from({ length: 20 }, (_, i) =>
        mkRow(`l${i}`, `2026-01-${String(i + 1).padStart(2, '0')}`, 5, 10),
      );
      // Simulate SQL honoring LIMIT 12 — return only the 12 most recent rows.
      const sqlOutput = twenty.slice(-12).reverse(); // DESC order
      mockDb.getAllAsync.mockResolvedValueOnce(sqlOutput);
      mockDb.getFirstAsync.mockResolvedValueOnce({ n: 0 });

      const result = await dashboardService.getLateArrivalIndex();
      expect(result.data).toHaveLength(12);
      // Verify the LIMIT parameter is 12
      const params = mockDb.getAllAsync.mock.calls[0][1];
      expect(params).toEqual([12]);
    });

    it('returns data in chronological ascending order', async () => {
      // SQL returns DESC; service reverses.
      mockDb.getAllAsync.mockResolvedValueOnce([
        { id: '3', date: '2026-03-01', attendance_start: 1, attendance_end: 2 },
        { id: '2', date: '2026-02-01', attendance_start: 1, attendance_end: 2 },
        { id: '1', date: '2026-01-01', attendance_start: 1, attendance_end: 2 },
      ]);
      mockDb.getFirstAsync.mockResolvedValueOnce({ n: 0 });

      const result = await dashboardService.getLateArrivalIndex();
      expect(result.data.map((d) => d.lessonId)).toEqual(['1', '2', '3']);
    });

    it('returns empty result on empty DB without throwing', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]);
      mockDb.getFirstAsync.mockResolvedValueOnce({ n: 0 });

      const result = await dashboardService.getLateArrivalIndex();
      expect(result).toEqual({ data: [], excludedCount: 0 });
    });
  });

  // ------------------------------------------------------------------
  // getAttendanceCurves
  // ------------------------------------------------------------------
  describe('getAttendanceCurves', () => {
    it('maps fields and preserves null topic title', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([
        {
          id: 'l1',
          date: '2026-01-01',
          topic_title: 'Gálatas 1',
          attendance_start: 16,
          attendance_mid: 25,
          attendance_end: 31,
        },
        {
          id: 'l2',
          date: '2025-12-25',
          topic_title: null,
          attendance_start: 10,
          attendance_mid: 12,
          attendance_end: 14,
        },
      ]);
      mockDb.getFirstAsync.mockResolvedValueOnce({ n: 0 });

      const result = await dashboardService.getAttendanceCurves();
      // DESC → reversed to ASC
      expect(result.data[0].lessonId).toBe('l2');
      expect(result.data[0].topicTitle).toBeNull();
      expect(result.data[1].lessonId).toBe('l1');
      expect(result.data[1].topicTitle).toBe('Gálatas 1');
    });

    it('uses LEFT JOIN on lesson_topics', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]);
      mockDb.getFirstAsync.mockResolvedValueOnce({ n: 0 });
      await dashboardService.getAttendanceCurves();
      const sql = mockDb.getAllAsync.mock.calls[0][0] as string;
      expect(sql).toMatch(/LEFT JOIN lesson_topics/);
    });

    it('enforces 12-row limit', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]);
      mockDb.getFirstAsync.mockResolvedValueOnce({ n: 0 });
      await dashboardService.getAttendanceCurves();
      expect(mockDb.getAllAsync.mock.calls[0][1]).toEqual([12]);
    });

    it('returns empty safely', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]);
      mockDb.getFirstAsync.mockResolvedValueOnce({ n: 0 });
      const result = await dashboardService.getAttendanceCurves();
      expect(result).toEqual({ data: [], excludedCount: 0 });
    });
  });

  // ------------------------------------------------------------------
  // getAttendanceTrend
  // ------------------------------------------------------------------
  describe('getAttendanceTrend', () => {
    it('uses 26-row limit', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]);
      mockDb.getFirstAsync.mockResolvedValueOnce({ n: 0 });
      await dashboardService.getAttendanceTrend();
      expect(mockDb.getAllAsync.mock.calls[0][1]).toEqual([26]);
    });

    it('includes rows with attendance_end = 0', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([
        { id: 'l1', date: '2026-01-01', attendance_end: 0 },
        { id: 'l2', date: '2026-01-08', attendance_end: 25 },
      ]);
      mockDb.getFirstAsync.mockResolvedValueOnce({ n: 0 });

      const result = await dashboardService.getAttendanceTrend();
      expect(result.data).toHaveLength(2);
      expect(result.data.map((d) => d.attendanceEnd)).toContain(0);
    });

    it('returns empty safely', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]);
      mockDb.getFirstAsync.mockResolvedValueOnce({ n: 0 });
      const result = await dashboardService.getAttendanceTrend();
      expect(result).toEqual({ data: [], excludedCount: 0 });
    });
  });

  // ------------------------------------------------------------------
  // getPunctuality
  // ------------------------------------------------------------------
  describe('getPunctuality', () => {
    it('computes minutes late from HH:MM strings', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([
        {
          id: 'l4',
          date: '2026-01-22',
          time_expected_start: '10:00',
          time_real_start: '10:10',
        },
        {
          id: 'l3',
          date: '2026-01-15',
          time_expected_start: '10:00',
          time_real_start: '10:02',
        },
        {
          id: 'l2',
          date: '2026-01-08',
          time_expected_start: '10:00',
          time_real_start: '10:00',
        },
        {
          id: 'l1',
          date: '2026-01-01',
          time_expected_start: '10:00',
          time_real_start: '10:07',
        },
      ]);
      mockDb.getFirstAsync.mockResolvedValueOnce({ n: 0 });

      const result = await dashboardService.getPunctuality();
      // Chronological: l1(7), l2(0), l3(2), l4(10)
      expect(result.data.map((d) => d.minutesLate)).toEqual([7, 0, 2, 10]);
    });

    it('preserves negative (early) values', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([
        {
          id: 'l1',
          date: '2026-01-01',
          time_expected_start: '10:00',
          time_real_start: '09:55',
        },
      ]);
      mockDb.getFirstAsync.mockResolvedValueOnce({ n: 0 });

      const result = await dashboardService.getPunctuality();
      expect(result.data[0].minutesLate).toBe(-5);
    });

    it('enforces 12-row limit', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]);
      mockDb.getFirstAsync.mockResolvedValueOnce({ n: 0 });
      await dashboardService.getPunctuality();
      expect(mockDb.getAllAsync.mock.calls[0][1]).toEqual([12]);
    });

    it('returns empty safely', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]);
      mockDb.getFirstAsync.mockResolvedValueOnce({ n: 0 });
      const result = await dashboardService.getPunctuality();
      expect(result).toEqual({ data: [], excludedCount: 0 });
    });
  });

  // ------------------------------------------------------------------
  // getEngagementRate
  // ------------------------------------------------------------------
  describe('getEngagementRate', () => {
    it('computes rate from unique_participants / attendance_end', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([
        {
          id: 'l1',
          date: '2026-01-01',
          unique_participants: 5,
          attendance_end: 25,
        },
      ]);
      mockDb.getFirstAsync.mockResolvedValueOnce({ n: 0 });

      const result = await dashboardService.getEngagementRate();
      expect(result.data[0].rate).toBeCloseTo(20.0, 1);
    });

    it('includes rows with unique_participants = 0', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([
        {
          id: 'l1',
          date: '2026-01-01',
          unique_participants: 0,
          attendance_end: 25,
        },
      ]);
      mockDb.getFirstAsync.mockResolvedValueOnce({ n: 0 });

      const result = await dashboardService.getEngagementRate();
      expect(result.data[0].rate).toBe(0);
    });

    it('enforces 12-row limit', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]);
      mockDb.getFirstAsync.mockResolvedValueOnce({ n: 0 });
      await dashboardService.getEngagementRate();
      expect(mockDb.getAllAsync.mock.calls[0][1]).toEqual([12]);
    });

    it('returns empty safely', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]);
      mockDb.getFirstAsync.mockResolvedValueOnce({ n: 0 });
      const result = await dashboardService.getEngagementRate();
      expect(result).toEqual({ data: [], excludedCount: 0 });
    });
  });
});
