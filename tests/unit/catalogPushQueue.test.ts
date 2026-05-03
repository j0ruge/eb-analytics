import {
  enqueueCatalogPush,
  bumpPushAttempt,
  deletePendingPush,
  listPendingPushes,
  countPendingPushes,
} from '../../src/services/catalogPushQueue';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('uuid', () => ({ v4: jest.fn(() => 'queue-uuid-1') }));
jest.mock('react-native-get-random-values', () => ({}));

function makeMockDb() {
  return {
    runAsync: jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 0 }),
    getAllAsync: jest.fn().mockResolvedValue([]),
    getFirstAsync: jest.fn().mockResolvedValue(null),
  };
}

describe('catalogPushQueue', () => {
  describe('enqueueCatalogPush', () => {
    it('inserts a pending push with payload and entity metadata', async () => {
      const db = makeMockDb();

      await enqueueCatalogPush(db as any, {
        entityType: 'TOPIC',
        entityId: 'topic-1',
        op: 'CREATE',
        payload: { id: 'topic-1', title: 'foo' },
        lastError: 'Sem conexão',
      });

      expect(db.runAsync).toHaveBeenCalledTimes(1);
      const [sql, params] = db.runAsync.mock.calls[0];
      expect(sql).toMatch(/INSERT INTO catalog_pending_pushes/);
      expect(params).toEqual([
        'queue-uuid-1',
        'TOPIC',
        'topic-1',
        'CREATE',
        JSON.stringify({ id: 'topic-1', title: 'foo' }),
        'Sem conexão',
      ]);
    });

    it('resets attempts to 0 on conflict so a re-edit destrava entries past MAX_PUSH_ATTEMPTS', async () => {
      const db = makeMockDb();

      await enqueueCatalogPush(db as any, {
        entityType: 'TOPIC',
        entityId: 'topic-1',
        op: 'UPDATE',
        payload: { suggested_date: '2026-05-09' },
      });

      const [sql] = db.runAsync.mock.calls[0];
      // The clause must reset the counter so a stuck row (attempts >=
      // MAX_PUSH_ATTEMPTS) becomes eligible for the drainer again.
      expect(sql).toMatch(/ON CONFLICT\(entity_type, entity_id\) DO UPDATE SET[\s\S]*attempts\s*=\s*0/);
      expect(sql).toMatch(/last_attempt_at\s*=\s*NULL/);
    });

    it('coalesces null lastError to NULL in the parameter list', async () => {
      const db = makeMockDb();

      await enqueueCatalogPush(db as any, {
        entityType: 'PROFESSOR',
        entityId: 'prof-1',
        op: 'CREATE',
        payload: {},
      });

      const [, params] = db.runAsync.mock.calls[0];
      expect(params[5]).toBeNull();
    });
  });

  describe('listPendingPushes', () => {
    it('orders by attempts ASC then created_at ASC and respects limit', async () => {
      const db = makeMockDb();
      db.getAllAsync.mockResolvedValueOnce([{ id: 'p1' }]);

      const rows = await listPendingPushes(db as any, 25);

      expect(rows).toEqual([{ id: 'p1' }]);
      const [sql, params] = db.getAllAsync.mock.calls[0];
      expect(sql).toMatch(/ORDER BY attempts ASC, created_at ASC/);
      expect(params).toEqual([25]);
    });
  });

  describe('bumpPushAttempt', () => {
    it('increments attempts and stamps last_error + last_attempt_at', async () => {
      const db = makeMockDb();

      await bumpPushAttempt(db as any, 'q1', '500: server error');

      const [sql, params] = db.runAsync.mock.calls[0];
      expect(sql).toMatch(/SET\s+attempts\s*=\s*attempts\s*\+\s*1/);
      expect(sql).toMatch(/last_attempt_at\s*=\s*datetime\('now'\)/);
      expect(params).toEqual(['500: server error', 'q1']);
    });
  });

  describe('deletePendingPush', () => {
    it('removes the entry by id', async () => {
      const db = makeMockDb();

      await deletePendingPush(db as any, 'q1');

      const [sql, params] = db.runAsync.mock.calls[0];
      expect(sql).toMatch(/DELETE FROM catalog_pending_pushes WHERE id = \?/);
      expect(params).toEqual(['q1']);
    });
  });

  describe('countPendingPushes', () => {
    it('returns the row count or 0 when empty', async () => {
      const db = makeMockDb();
      db.getFirstAsync.mockResolvedValueOnce({ count: 7 });
      expect(await countPendingPushes(db as any)).toBe(7);

      db.getFirstAsync.mockResolvedValueOnce(null);
      expect(await countPendingPushes(db as any)).toBe(0);
    });
  });
});
