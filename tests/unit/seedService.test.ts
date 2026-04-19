import { seedService } from '../../src/services/seedService';

import { getDatabase } from '../../src/db/client';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

jest.mock('../../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../../src/data/seed-collections.json', () => ({
  schema_version: '2.0',
  generated_at: '2026-04-11T00:00:00Z',
  source: 'test',
  catalog: {
    series: [
      { id: 'seed-srs-1', code: 'EB001', title: 'Série 1', description: null },
    ],
    topics: [
      {
        id: 'seed-top-1',
        series_id: 'seed-srs-1',
        title: 'Tópico 1',
        sequence_order: 1,
        suggested_date: '2026-01-01',
      },
    ],
    professors: [
      { id: 'seed-prof-1', doc_id: 'seed-doc-1', name: 'Professor 1' },
    ],
  },
  collector: null,
  collections: [
    {
      id: 'seed-col-1',
      client_created_at: '2026-01-01T10:00:00Z',
      client_updated_at: '2026-01-01T11:00:00Z',
      status: 'COMPLETED',
      lesson_instance: {
        date: '2026-01-01',
        series_id: 'seed-srs-1',
        series_code_fallback: null,
        topic_id: 'seed-top-1',
        topic_title_fallback: null,
        professor_id: 'seed-prof-1',
        professor_name_fallback: null,
      },
      times: {
        expected_start: '10:00',
        expected_end: '11:00',
        real_start: '10:05',
        real_end: '10:58',
      },
      attendance: { start: 10, mid: 20, end: 25, includes_professor: false },
      unique_participants: 4,
      weather: null,
      notes: null,
    },
  ],
}));

describe('Seed Service', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      runAsync: jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 0 }),
      getFirstAsync: jest.fn(),
      withTransactionAsync: jest.fn(async (cb: () => Promise<void>) => cb()),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);
  });

  describe('seed', () => {
    it('populates empty DB with catalog and collections', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ count: 0 });

      const result = await seedService.seed();

      expect(result.skipped).toBe(false);
      expect(result.series).toBe(1);
      expect(result.topics).toBe(1);
      expect(result.professors).toBe(1);
      expect(result.lessons).toBe(1);
      expect(mockDb.withTransactionAsync).toHaveBeenCalledTimes(1);
      // 1 series + 1 topic + 1 professor + 1 lesson = 4 inserts
      expect(mockDb.runAsync).toHaveBeenCalledTimes(4);
    });

    it('writes includes_professor, notes, client_updated_at and respects XOR for legacy columns', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ count: 0 });

      await seedService.seed();

      // Find the lesson INSERT call (it's the 4th runAsync call: 1 series + 1 topic + 1 professor + 1 lesson)
      const insertCalls = (mockDb.runAsync as jest.Mock).mock.calls;
      const lessonInsert = insertCalls.find(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('INSERT OR IGNORE INTO lessons_data')
      );
      expect(lessonInsert).toBeDefined();

      const params = lessonInsert![1] as unknown[];
      // Column order in the INSERT:
      //   0:id, 1:date, 2:coordinator_name, 3:professor_name, 4:professor_id, 5:lesson_topic_id,
      //   6:series_name, 7:lesson_title, 8:time_expected_start, 9:time_real_start,
      //   10:time_expected_end, 11:time_real_end, 12:attendance_start, 13:attendance_mid,
      //   14:attendance_end, 15:unique_participants, 16:status, 17:created_at,
      //   18:client_updated_at, 19:includes_professor, 20:weather, 21:notes

      // FR-017 XOR: catalog professor path → professor_name must be empty
      expect(params[3]).toBe('');     // professor_name cleared (professor_id = 'seed-prof-1')
      expect(params[4]).toBe('seed-prof-1');

      // FR-017 XOR: catalog topic path → lesson_title and series_name must be empty
      expect(params[6]).toBe('');     // series_name cleared
      expect(params[7]).toBe('');     // lesson_title cleared
      expect(params[5]).toBe('seed-top-1');

      // New 005 columns persisted from seed JSON
      expect(params[18]).toBe('2026-01-01T11:00:00Z');  // client_updated_at from JSON
      expect(params[19]).toBe(0);                        // includes_professor: false → 0
      expect(params[20]).toBeNull();                     // weather: null in fixture
      expect(params[21]).toBeNull();                     // notes: null in fixture
    });

    it('is idempotent when seed rows already exist', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ count: 12 });

      const result = await seedService.seed();

      expect(result.skipped).toBe(true);
      expect(result.reason).toMatch(/12 lições seed/);
      expect(mockDb.withTransactionAsync).not.toHaveBeenCalled();
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    it('counts only actual inserts when INSERT OR IGNORE reports no changes', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ count: 0 });
      mockDb.runAsync.mockResolvedValue({ changes: 0, lastInsertRowId: 0 });

      const result = await seedService.seed();

      expect(result.skipped).toBe(false);
      expect(result.series).toBe(0);
      expect(result.topics).toBe(0);
      expect(result.professors).toBe(0);
      expect(result.lessons).toBe(0);
    });
  });

  describe('clearSeed', () => {
    it('deletes only rows with seed-* prefix', async () => {
      mockDb.runAsync.mockResolvedValue({ changes: 5, lastInsertRowId: 0 });

      const result = await seedService.clearSeed();

      expect(result.lessons).toBe(5);
      expect(result.topics).toBe(5);
      expect(result.series).toBe(5);
      expect(result.professors).toBe(5);

      const deleteCalls = mockDb.runAsync.mock.calls.map((c: any[]) => c[0]);
      expect(deleteCalls).toEqual([
        "DELETE FROM lessons_data WHERE id LIKE 'seed-col-%'",
        "DELETE FROM lesson_topics WHERE id LIKE 'seed-top-%'",
        "DELETE FROM lesson_series WHERE id LIKE 'seed-srs-%'",
        "DELETE FROM professors WHERE id LIKE 'seed-prof-%'",
      ]);
    });
  });
});
