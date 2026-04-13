import { lessonService } from '../../src/services/lessonService';

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

import { getDatabase } from '../../src/db/client';

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
