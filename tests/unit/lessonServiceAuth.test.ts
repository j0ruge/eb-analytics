import { lessonService } from '../../src/services/lessonService';

import { getDatabase } from '../../src/db/client';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-auth'),
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

describe('lessonService — collector identity (006)', () => {
  let mockDb: MockDb;
  let runAsyncCalls: RunAsyncCall[];

  beforeEach(() => {
    runAsyncCalls = [];
    mockDb = {
      runAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
        runAsyncCalls.push({ sql, params });
        return { changes: 1 };
      }),
      getFirstAsync: jest.fn().mockResolvedValue(null),
      getAllAsync: jest.fn().mockResolvedValue([]),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);
  });

  test('createLesson with collectorUserId sets the field', async () => {
    const lesson = await lessonService.createLesson(undefined, 'user-123');

    expect(lesson.collector_user_id).toBe('user-123');

    const insertCall = runAsyncCalls.find((c) => c.sql.includes('INSERT'));
    expect(insertCall).toBeDefined();
    expect(insertCall!.sql).toContain('collector_user_id');
    // collector_user_id is the last param
    expect(insertCall!.params[insertCall!.params.length - 1]).toBe('user-123');
  });

  test('createLesson without collectorUserId leaves it null', async () => {
    const lesson = await lessonService.createLesson();

    expect(lesson.collector_user_id).toBeNull();

    const insertCall = runAsyncCalls.find((c) => c.sql.includes('INSERT'));
    expect(insertCall!.params[insertCall!.params.length - 1]).toBeNull();
  });

  test('createLesson does NOT carry collector_user_id from previous lesson', async () => {
    // Mock getLastLesson returning a lesson with a collector_user_id
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 'prev-lesson',
      collector_user_id: 'prev-user',
      professor_name: '',
      professor_id: null,
      lesson_topic_id: null,
      series_name: '',
      lesson_title: '',
      coordinator_name: '',
      time_expected_start: '10:00',
      time_expected_end: '11:00',
      includes_professor: 0,
    });

    const lesson = await lessonService.createLesson();

    // collector_user_id should NOT be inherited from the previous lesson
    expect(lesson.collector_user_id).toBeNull();
  });

  test('updateLesson cannot change collector_user_id', async () => {
    await lessonService.updateLesson('lesson-1', {
      notes: 'updated',
      collector_user_id: 'hacker-id',
    } as any);

    const updateCall = runAsyncCalls.find((c) => c.sql.includes('UPDATE'));
    expect(updateCall).toBeDefined();
    // collector_user_id should be stripped from the SET clause
    expect(updateCall!.sql).not.toContain('collector_user_id');
    expect(updateCall!.sql).toContain('notes');
  });
});
