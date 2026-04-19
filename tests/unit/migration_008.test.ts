/**
 * Spec 008 — migrateAddSyncStatus idempotency.
 *
 * The migration must (a) add all sync_* columns to lessons_data plus the
 * catalog updated_at/email columns, (b) create the two sync indexes, and
 * (c) be safe to run a second time (no-op).
 */

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

jest.mock('uuid', () => ({ v4: jest.fn(() => 'mig-test-uuid') }));
jest.mock('react-native-get-random-values', () => ({}));

import { migrateAddSyncStatus } from '../../src/db/migrations';

type ColumnDef = { name: string };

interface TableMap {
  [tableName: string]: ColumnDef[];
}

function makeFakeDb(initialTables: TableMap) {
  const tables: TableMap = {};
  for (const [name, cols] of Object.entries(initialTables)) {
    tables[name] = cols.map((c) => ({ ...c }));
  }
  const flags = new Set<string>();
  const log: string[] = [];

  function norm(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim();
  }

  async function execAsync(rawSql: string): Promise<void> {
    const sql = norm(rawSql);
    log.push(sql);

    if (/^CREATE TABLE IF NOT EXISTS _migration_flags/i.test(sql)) return;

    const alter = sql.match(/^ALTER TABLE (\w+) ADD COLUMN (\w+) /i);
    if (alter) {
      const tbl = alter[1];
      const col = alter[2];
      if (!tables[tbl]) throw new Error(`ALTER on unknown table ${tbl}`);
      if (tables[tbl].some((c) => c.name === col)) {
        throw new Error(`Duplicate ALTER: ${tbl}.${col} already exists`);
      }
      tables[tbl].push({ name: col });
      return;
    }

    if (/^CREATE INDEX IF NOT EXISTS/i.test(sql)) return;
    throw new Error('Unexpected execAsync: ' + sql);
  }

  async function getAllAsync<T>(rawSql: string): Promise<T[]> {
    const sql = norm(rawSql);
    log.push(sql);
    const m = sql.match(/^PRAGMA table_info\((\w+)\)$/i);
    if (m) {
      const tbl = m[1];
      return (tables[tbl] ?? []).map((c) => ({ name: c.name })) as unknown as T[];
    }
    throw new Error('Unexpected getAllAsync: ' + sql);
  }

  async function getFirstAsync<T>(rawSql: string, params?: unknown[]): Promise<T | null> {
    const sql = norm(rawSql);
    log.push(sql);
    if (/^SELECT key FROM _migration_flags WHERE key = \?$/i.test(sql)) {
      const key = params?.[0] as string;
      return flags.has(key) ? ({ key } as unknown as T) : null;
    }
    throw new Error('Unexpected getFirstAsync: ' + sql);
  }

  async function runAsync(rawSql: string, params?: unknown[]): Promise<void> {
    const sql = norm(rawSql);
    log.push(sql);
    if (/INSERT OR IGNORE INTO _migration_flags/i.test(sql)) {
      flags.add(params?.[0] as string);
      return;
    }
    throw new Error('Unexpected runAsync: ' + sql);
  }

  return {
    db: { execAsync, getAllAsync, getFirstAsync, runAsync } as never,
    tables,
    flags,
    log,
  };
}

describe('migrateAddSyncStatus (spec 008)', () => {
  const baseTables: TableMap = {
    lessons_data: [
      { name: 'id' },
      { name: 'date' },
      { name: 'status' },
      { name: 'collector_user_id' },
    ],
    professors: [{ name: 'id' }, { name: 'name' }, { name: 'doc_id' }],
    lesson_series: [{ name: 'id' }, { name: 'code' }, { name: 'title' }],
    lesson_topics: [{ name: 'id' }, { name: 'series_id' }, { name: 'title' }],
  };

  it('adds all sync_* columns and catalog updated_at/email columns', async () => {
    const fake = makeFakeDb(baseTables);

    await migrateAddSyncStatus(fake.db);

    const lessons = fake.tables.lessons_data.map((c) => c.name);
    expect(lessons).toEqual(
      expect.arrayContaining([
        'sync_status',
        'sync_error',
        'sync_attempt_count',
        'sync_next_attempt_at',
        'synced_at',
      ]),
    );

    expect(fake.tables.professors.map((c) => c.name)).toEqual(
      expect.arrayContaining(['email', 'updated_at']),
    );
    expect(fake.tables.lesson_series.map((c) => c.name)).toContain('updated_at');
    expect(fake.tables.lesson_topics.map((c) => c.name)).toContain('updated_at');

    expect(fake.flags.has('008_offline_sync_complete')).toBe(true);
  });

  it('is idempotent — running twice does not duplicate any column', async () => {
    const fake = makeFakeDb(baseTables);

    await migrateAddSyncStatus(fake.db);
    const snapshot1 = {
      lessons_data: fake.tables.lessons_data.map((c) => c.name).slice().sort(),
      professors: fake.tables.professors.map((c) => c.name).slice().sort(),
      lesson_series: fake.tables.lesson_series.map((c) => c.name).slice().sort(),
      lesson_topics: fake.tables.lesson_topics.map((c) => c.name).slice().sort(),
    };

    // Second run must short-circuit on the flag; the fake would throw on
    // duplicate ALTER.
    await expect(migrateAddSyncStatus(fake.db)).resolves.toBeUndefined();

    const snapshot2 = {
      lessons_data: fake.tables.lessons_data.map((c) => c.name).slice().sort(),
      professors: fake.tables.professors.map((c) => c.name).slice().sort(),
      lesson_series: fake.tables.lesson_series.map((c) => c.name).slice().sort(),
      lesson_topics: fake.tables.lesson_topics.map((c) => c.name).slice().sort(),
    };

    expect(snapshot2).toEqual(snapshot1);
  });

  it('recovers from a partial previous run (flag missing, columns present)', async () => {
    // Simulate a crash between ALTER and flag INSERT: columns already present,
    // flag not yet set. The PRAGMA guard should skip duplicate ALTERs and still
    // mark the flag.
    const partial: TableMap = {
      lessons_data: [
        { name: 'id' },
        { name: 'status' },
        { name: 'sync_status' },
        { name: 'sync_error' },
        { name: 'sync_attempt_count' },
        { name: 'sync_next_attempt_at' },
        { name: 'synced_at' },
      ],
      professors: [{ name: 'id' }, { name: 'email' }, { name: 'updated_at' }],
      lesson_series: [{ name: 'id' }, { name: 'updated_at' }],
      lesson_topics: [{ name: 'id' }, { name: 'updated_at' }],
    };
    const fake = makeFakeDb(partial);

    await expect(migrateAddSyncStatus(fake.db)).resolves.toBeUndefined();

    expect(fake.flags.has('008_offline_sync_complete')).toBe(true);
    // No duplicate columns — fake would have thrown during ALTER otherwise.
  });
});
