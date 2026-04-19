import { lessonService } from '../../src/services/lessonService';
import { LessonStatus } from '../../src/types/lesson';

import { getDatabase } from '../../src/db/client';
import { getIncludesProfessorDefault } from '../../src/hooks/useIncludesProfessorDefault';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-0000'),
}));

jest.mock('react-native-get-random-values', () => ({}));

jest.mock('../../src/db/client', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../../src/hooks/useIncludesProfessorDefault', () => ({
  getIncludesProfessorDefault: jest.fn().mockResolvedValue(false),
}));

type RunAsyncCall = { sql: string; params: unknown[] };

interface MockDb {
  runAsync: jest.Mock;
  getFirstAsync: jest.Mock;
  getAllAsync: jest.Mock;
}

describe('lessonService', () => {
  let mockDb: MockDb;
  let runAsyncCalls: RunAsyncCall[];

  beforeEach(() => {
    runAsyncCalls = [];
    mockDb = {
      runAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
        runAsyncCalls.push({ sql, params });
        return { changes: 1, lastInsertRowId: 0 };
      }),
      getFirstAsync: jest.fn().mockResolvedValue(null),
      getAllAsync: jest.fn().mockResolvedValue([]),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);
    (getIncludesProfessorDefault as jest.Mock).mockResolvedValue(false);
  });

  // Helper: map insert-column-order to value from the INSERT params array.
  // Column order matches lessonService.createLesson INSERT statement exactly:
  //   id, date, coordinator_name, professor_name, professor_id, lesson_topic_id,
  //   series_name, lesson_title, time_expected_start, time_expected_end,
  //   status, created_at, client_updated_at, includes_professor, weather, notes
  const INSERT_COLS = [
    'id',
    'date',
    'coordinator_name',
    'professor_name',
    'professor_id',
    'lesson_topic_id',
    'series_name',
    'lesson_title',
    'time_expected_start',
    'time_expected_end',
    'status',
    'created_at',
    'client_updated_at',
    'includes_professor',
    'weather',
    'notes',
  ] as const;

  function extractInsert(): Record<string, unknown> {
    const insertCall = runAsyncCalls.find((c) => c.sql.trim().startsWith('INSERT INTO lessons_data'));
    if (!insertCall) throw new Error('No INSERT INTO lessons_data call recorded');
    const row: Record<string, unknown> = {};
    INSERT_COLS.forEach((col, i) => {
      row[col] = insertCall.params[i];
    });
    return row;
  }

  function extractUpdate(): { fields: string[]; values: Record<string, unknown> } {
    const updateCall = runAsyncCalls.find((c) => c.sql.trim().startsWith('UPDATE lessons_data'));
    if (!updateCall) throw new Error('No UPDATE lessons_data call recorded');
    // SQL shape: "UPDATE lessons_data SET field1 = ?, field2 = ? WHERE id = ?"
    const setMatch = updateCall.sql.match(/SET (.+?) WHERE id = \?/);
    if (!setMatch) throw new Error('UPDATE shape unexpected: ' + updateCall.sql);
    const fields = setMatch[1].split(',').map((s) => s.trim().split(' = ')[0]);
    const values: Record<string, unknown> = {};
    fields.forEach((f, i) => {
      values[f] = updateCall.params[i];
    });
    return { fields, values };
  }

  // ======================================================================
  // T007: createLesson XOR + client_updated_at init + includes_professor default
  // ======================================================================
  describe('createLesson', () => {
    it('clears professor_name when professor_id is provided (FR-017)', async () => {
      await lessonService.createLesson({
        professor_id: 'prof-uuid',
        professor_name: 'Should Be Cleared',
      });

      const row = extractInsert();
      expect(row.professor_id).toBe('prof-uuid');
      expect(row.professor_name).toBe('');
    });

    it('clears lesson_title and series_name when lesson_topic_id is provided (FR-017)', async () => {
      await lessonService.createLesson({
        lesson_topic_id: 'topic-uuid',
        lesson_title: 'Should Be Cleared',
        series_name: 'Eb354',
      });

      const row = extractInsert();
      expect(row.lesson_topic_id).toBe('topic-uuid');
      expect(row.lesson_title).toBe('');
      expect(row.series_name).toBe('');
    });

    it('reads includes_professor default from useIncludesProfessorDefault when caller does not specify', async () => {
      (getIncludesProfessorDefault as jest.Mock).mockResolvedValue(true);

      await lessonService.createLesson({});

      expect(getIncludesProfessorDefault).toHaveBeenCalled();
      const row = extractInsert();
      expect(row.includes_professor).toBe(1);
    });

    it('caller-provided includes_professor wins over the preference default', async () => {
      (getIncludesProfessorDefault as jest.Mock).mockResolvedValue(true);

      await lessonService.createLesson({ includes_professor: false });

      const row = extractInsert();
      expect(row.includes_professor).toBe(0);
    });

    it('initializes client_updated_at equal to created_at on insert (FR-016)', async () => {
      await lessonService.createLesson({});

      const row = extractInsert();
      expect(typeof row.created_at).toBe('string');
      expect(typeof row.client_updated_at).toBe('string');
      expect(row.client_updated_at).toBe(row.created_at);
      // ISO 8601 format with milliseconds sanity check
      expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  // ======================================================================
  // T008: updateLesson always touches client_updated_at + XOR on every update
  // ======================================================================
  describe('updateLesson', () => {
    it('touches client_updated_at even when caller passes only unrelated fields (FR-016)', async () => {
      await lessonService.updateLesson('lesson-1', { attendance_start: 25 });

      const { fields, values } = extractUpdate();
      expect(fields).toContain('client_updated_at');
      expect(fields).toContain('attendance_start');
      expect(typeof values.client_updated_at).toBe('string');
      expect(values.client_updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('no-ops when the resulting update set is empty', async () => {
      // Passing no fields at all should still produce a client_updated_at touch.
      await lessonService.updateLesson('lesson-1', {});

      const { fields } = extractUpdate();
      expect(fields).toEqual(['client_updated_at']);
    });

    it('clears professor_name when updates.professor_id is non-null (FR-017 symmetry)', async () => {
      await lessonService.updateLesson('lesson-1', {
        professor_id: 'new-prof',
        professor_name: 'Should Be Cleared',
      });

      const { values } = extractUpdate();
      expect(values.professor_id).toBe('new-prof');
      expect(values.professor_name).toBe('');
    });

    it('clears professor_id when updates.professor_name is non-empty (FR-017)', async () => {
      await lessonService.updateLesson('lesson-1', {
        professor_name: 'Jefferson Pedro',
      });

      const { values } = extractUpdate();
      expect(values.professor_name).toBe('Jefferson Pedro');
      expect(values.professor_id).toBeNull();
    });

    it('clears lesson_title and series_name when updates.lesson_topic_id is non-null', async () => {
      await lessonService.updateLesson('lesson-1', {
        lesson_topic_id: 'topic-xyz',
        lesson_title: 'Leftover',
        series_name: 'Eb999',
      });

      const { values } = extractUpdate();
      expect(values.lesson_topic_id).toBe('topic-xyz');
      expect(values.lesson_title).toBe('');
      expect(values.series_name).toBe('');
    });

    it('clears lesson_topic_id when updates write a non-empty lesson_title (free-text branch)', async () => {
      await lessonService.updateLesson('lesson-1', {
        lesson_title: 'A Graça livre',
      });

      const { values } = extractUpdate();
      expect(values.lesson_title).toBe('A Graça livre');
      expect(values.lesson_topic_id).toBeNull();
    });

    it('coerces boolean includes_professor to 0/1 integer for SQLite', async () => {
      await lessonService.updateLesson('lesson-1', { includes_professor: true });

      const { values } = extractUpdate();
      expect(values.includes_professor).toBe(1);
    });
  });

  // ======================================================================
  // T009: getAllLessonsWithDetails exposes resolved_series_id via JOIN
  // ======================================================================
  describe('getAllLessonsWithDetails', () => {
    it('SELECT query aliases lt.series_id as resolved_series_id', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      await lessonService.getAllLessonsWithDetails();

      const sql = (mockDb.getAllAsync as jest.Mock).mock.calls[0][0] as string;
      expect(sql).toMatch(/lt\.series_id\s+as\s+resolved_series_id/i);
    });
  });
});
