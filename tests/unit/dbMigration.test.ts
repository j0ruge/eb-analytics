/**
 * SC-007: Migration safety — running the 005 migration on a database populated
 * by specs 001–004 must preserve every row (no count loss) and backfill
 * `client_updated_at` for every row. This test drives the `applyMigrations`
 * function from `src/db/client.ts` against an in-memory fake SQLite that
 * simulates only the subset of operations the migration touches.
 */

import { LessonStatus } from '../../src/types/lesson';

import { applyMigrations } from '../../src/db/client';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-0000'),
}));

jest.mock('react-native-get-random-values', () => ({}));

type ColumnDef = { name: string; value: unknown; notNull?: boolean; defaultValue?: unknown };
type Row = Record<string, unknown>;

interface MigrationDb {
  execAsync: (sql: string) => Promise<void>;
  getAllAsync: <T>(sql: string) => Promise<T[]>;
  getFirstAsync: <T>(sql: string) => Promise<T | null>;
}

function makeFakeDb(initialColumns: ColumnDef[], initialRows: Row[]) {
  const columns: ColumnDef[] = initialColumns.map((c) => ({ ...c }));
  const rows: Row[] = initialRows.map((r) => ({ ...r }));
  const log: string[] = [];

  function normalizeSql(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim();
  }

  async function execAsync(rawSql: string): Promise<void> {
    const sql = normalizeSql(rawSql);
    log.push(sql);

    // ALTER TABLE lessons_data ADD COLUMN <name> <rest...>
    const alter = sql.match(/^ALTER TABLE lessons_data ADD COLUMN (\w+) ([^;]+?);?$/i);
    if (alter) {
      const name = alter[1];
      const rest = alter[2];
      const notNull = /NOT NULL/i.test(rest);
      const defMatch = rest.match(/DEFAULT\s+(\S+)/i);
      let defaultValue: unknown = null;
      if (defMatch) {
        const raw = defMatch[1];
        if (raw === '0') defaultValue = 0;
        else if (raw === '1') defaultValue = 1;
        else defaultValue = raw.replace(/['";]/g, '');
      }
      columns.push({ name, value: defaultValue, notNull, defaultValue });
      // Apply default to existing rows
      for (const row of rows) {
        row[name] = defaultValue;
      }
      return;
    }

    // UPDATE lessons_data SET client_updated_at = created_at WHERE client_updated_at IS NULL;
    if (/UPDATE lessons_data SET client_updated_at = created_at WHERE client_updated_at IS NULL/i.test(sql)) {
      for (const row of rows) {
        if (row.client_updated_at === null || row.client_updated_at === undefined) {
          row.client_updated_at = row.created_at;
        }
      }
      return;
    }

    // Full-table recreation migration (from spec 004) — recognize and no-op.
    // We don't simulate it because our fixture already has all required columns.
    if (sql.startsWith('DROP TABLE IF EXISTS lessons_data_new')) return;
    if (/^CREATE TABLE lessons_data_new/i.test(sql)) return;
    if (/^INSERT INTO lessons_data_new/i.test(sql)) return;
    if (/^DROP TABLE lessons_data/i.test(sql)) return;
    if (/^ALTER TABLE lessons_data_new RENAME TO lessons_data/i.test(sql)) return;
    // Index recreation statements
    if (/^CREATE INDEX/i.test(sql)) return;

    throw new Error('Unexpected SQL in fake db: ' + sql);
  }

  async function getAllAsync<T>(sql: string): Promise<T[]> {
    const normalized = normalizeSql(sql);
    log.push(normalized);
    if (/PRAGMA table_info\(lessons_data\)/i.test(normalized)) {
      return columns.map((c) => ({ name: c.name })) as unknown as T[];
    }
    if (/^SELECT \* FROM lessons_data$/i.test(normalized)) {
      return rows.slice() as unknown as T[];
    }
    throw new Error('Unexpected getAllAsync SQL: ' + normalized);
  }

  async function getFirstAsync<T>(sql: string): Promise<T | null> {
    const normalized = normalizeSql(sql);
    log.push(normalized);
    if (/SELECT sql FROM sqlite_master WHERE type='table' AND name='lessons_data'/i.test(normalized)) {
      // Return a CREATE TABLE sql that already includes EXPORTED so the
      // status-constraint migration from spec 004 does NOT fire in this test.
      return {
        sql: "CREATE TABLE lessons_data (... status TEXT CHECK(status IN ('IN_PROGRESS', 'COMPLETED', 'EXPORTED', 'SYNCED')) ...)",
      } as unknown as T;
    }
    return null;
  }

  return {
    db: { execAsync, getAllAsync, getFirstAsync } as MigrationDb,
    columns,
    rows,
    log,
  };
}

describe('SC-007: Migration safety', () => {
  const baseColumns: ColumnDef[] = [
    { name: 'id', value: null },
    { name: 'date', value: null },
    { name: 'coordinator_name', value: '' },
    { name: 'professor_name', value: '' },
    { name: 'professor_id', value: null },
    { name: 'lesson_topic_id', value: null },
    { name: 'series_name', value: '' },
    { name: 'lesson_title', value: '' },
    { name: 'time_expected_start', value: '10:00' },
    { name: 'time_real_start', value: null },
    { name: 'time_expected_end', value: '11:00' },
    { name: 'time_real_end', value: null },
    { name: 'attendance_start', value: 0 },
    { name: 'attendance_mid', value: 0 },
    { name: 'attendance_end', value: 0 },
    { name: 'unique_participants', value: 0 },
    { name: 'status', value: 'IN_PROGRESS' },
    { name: 'created_at', value: null },
  ];

  // Fixture: 4 rows, one per status, with distinct created_at timestamps.
  const preMigrationRows: Row[] = [
    {
      id: 'row-in-progress',
      status: LessonStatus.IN_PROGRESS,
      created_at: '2026-01-01T10:00:00.000Z',
      date: '2026-01-01',
    },
    {
      id: 'row-completed',
      status: LessonStatus.COMPLETED,
      created_at: '2026-02-01T10:00:00.000Z',
      date: '2026-02-01',
    },
    {
      id: 'row-exported',
      status: LessonStatus.EXPORTED,
      created_at: '2026-03-01T10:00:00.000Z',
      date: '2026-03-01',
    },
    {
      id: 'row-synced',
      status: LessonStatus.SYNCED,
      created_at: '2026-04-01T10:00:00.000Z',
      date: '2026-04-01',
    },
  ];

  it('preserves row count, backfills client_updated_at, and leaves every legacy status intact', async () => {
    const fake = makeFakeDb(baseColumns, preMigrationRows);

    await applyMigrations(fake.db);

    // Row count unchanged
    expect(fake.rows).toHaveLength(preMigrationRows.length);

    // All new 005 columns exist
    const columnNames = fake.columns.map((c) => c.name);
    expect(columnNames).toContain('client_updated_at');
    expect(columnNames).toContain('includes_professor');
    expect(columnNames).toContain('weather');
    expect(columnNames).toContain('notes');

    // Every row has client_updated_at backfilled to created_at
    for (const row of fake.rows) {
      expect(row.client_updated_at).toBe(row.created_at);
      expect(row.client_updated_at).not.toBeNull();
    }

    // Defaults applied
    for (const row of fake.rows) {
      expect(row.includes_professor).toBe(0);
      expect(row.weather).toBeNull();
      expect(row.notes).toBeNull();
    }

    // Status values preserved verbatim — especially EXPORTED rows must NOT be silently downgraded.
    const statusById = Object.fromEntries(fake.rows.map((r) => [r.id, r.status]));
    expect(statusById['row-in-progress']).toBe(LessonStatus.IN_PROGRESS);
    expect(statusById['row-completed']).toBe(LessonStatus.COMPLETED);
    expect(statusById['row-exported']).toBe(LessonStatus.EXPORTED);
    expect(statusById['row-synced']).toBe(LessonStatus.SYNCED);
  });

  it('is idempotent — running the migration twice does not change anything on the second run', async () => {
    const fake = makeFakeDb(baseColumns, preMigrationRows);

    await applyMigrations(fake.db);
    const columnCountAfterFirst = fake.columns.length;
    const rowSnapshotAfterFirst = JSON.stringify(fake.rows);

    await applyMigrations(fake.db);

    expect(fake.columns.length).toBe(columnCountAfterFirst);
    expect(JSON.stringify(fake.rows)).toBe(rowSnapshotAfterFirst);
  });
});
