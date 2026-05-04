/**
 * Spec 010 — migrateProfessorDocIdNullable.
 *
 * Drops NOT NULL from `professors.doc_id` and undoes the pre-010 sync
 * workaround that wrote `doc_id = id` (server UUID) into the CPF column.
 *
 * Verifies:
 *  - Skips when the migration flag is already set.
 *  - Skips (and stamps the flag) when doc_id is already nullable.
 *  - Runs the rebuild path when doc_id is NOT NULL: creates professors_new,
 *    copies rows with the CASE-WHEN that nulls out `doc_id == id` rows,
 *    drops + renames + recreates indexes, stamps the flag.
 */

import { migrateProfessorDocIdNullable } from '../../src/db/migrations';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('uuid', () => ({ v4: jest.fn(() => 'mig-test-uuid') }));
jest.mock('react-native-get-random-values', () => ({}));

interface ColInfo {
  name: string;
  notnull: number;
}

function makeFakeDb(initialCols: ColInfo[], hasFlag = false) {
  const flags = new Set<string>();
  if (hasFlag) flags.add('010_professor_doc_id_nullable');
  const log: string[] = [];

  function norm(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim();
  }

  async function execAsync(rawSql: string): Promise<void> {
    log.push(norm(rawSql));
  }

  async function getAllAsync<T>(rawSql: string): Promise<T[]> {
    const sql = norm(rawSql);
    log.push(sql);
    if (sql.includes("PRAGMA table_info('professors')")) {
      return initialCols as unknown as T[];
    }
    return [] as T[];
  }

  async function getFirstAsync<T>(rawSql: string, params?: unknown[]): Promise<T | null> {
    const sql = norm(rawSql);
    log.push(sql);
    if (/SELECT key FROM _migration_flags/i.test(sql)) {
      const key = params?.[0] as string;
      return flags.has(key) ? ({ key } as unknown as T) : null;
    }
    return null;
  }

  async function runAsync(rawSql: string, params?: unknown[]): Promise<void> {
    const sql = norm(rawSql);
    log.push(sql);
    if (/INSERT OR IGNORE INTO _migration_flags/i.test(sql)) {
      flags.add(params?.[0] as string);
    }
  }

  return {
    db: { execAsync, getAllAsync, getFirstAsync, runAsync } as never,
    flags,
    log,
  };
}

describe('migrateProfessorDocIdNullable (spec 010)', () => {
  it('skips when the flag is already set', async () => {
    const fake = makeFakeDb(
      [
        { name: 'id', notnull: 1 },
        { name: 'doc_id', notnull: 1 },
        { name: 'name', notnull: 1 },
      ],
      true,
    );
    await migrateProfessorDocIdNullable(fake.db);
    expect(fake.log.some((l) => l.includes('CREATE TABLE professors_new'))).toBe(false);
    expect(fake.log.some((l) => l.includes('DROP TABLE professors'))).toBe(false);
  });

  it('stamps the flag and skips rebuild when doc_id is already nullable', async () => {
    const fake = makeFakeDb([
      { name: 'id', notnull: 1 },
      { name: 'doc_id', notnull: 0 },
      { name: 'name', notnull: 1 },
    ]);
    await migrateProfessorDocIdNullable(fake.db);
    expect(fake.flags.has('010_professor_doc_id_nullable')).toBe(true);
    expect(fake.log.some((l) => l.includes('CREATE TABLE professors_new'))).toBe(false);
  });

  it('rebuilds the table to drop NOT NULL and clears legacy doc_id == id rows', async () => {
    const fake = makeFakeDb([
      { name: 'id', notnull: 1 },
      { name: 'doc_id', notnull: 1 },
      { name: 'name', notnull: 1 },
      { name: 'email', notnull: 0 },
      { name: 'updated_at', notnull: 0 },
      { name: 'created_at', notnull: 0 },
    ]);
    await migrateProfessorDocIdNullable(fake.db);

    const log = fake.log.join('\n');
    expect(log).toContain('CREATE TABLE professors_new (id TEXT PRIMARY KEY NOT NULL, doc_id TEXT UNIQUE');
    // Crucial: the copy must surface legacy `doc_id == id` rows as NULL so
    // the UI no longer displays a UUID where a CPF should be.
    expect(log).toContain('CASE WHEN doc_id = id THEN NULL ELSE doc_id END');
    expect(log).toContain('DROP TABLE professors;');
    expect(log).toContain('ALTER TABLE professors_new RENAME TO professors;');
    expect(log).toContain('CREATE INDEX IF NOT EXISTS idx_professors_doc_id');
    expect(fake.flags.has('010_professor_doc_id_nullable')).toBe(true);
  });

  it('omits email/updated_at from the rebuild when those columns are absent', async () => {
    // Simulates a fresh-ish device where migration 008 hasn't yet added
    // the email/updated_at columns. The rebuild must still succeed without
    // referencing missing columns in the SELECT/INSERT.
    const fake = makeFakeDb([
      { name: 'id', notnull: 1 },
      { name: 'doc_id', notnull: 1 },
      { name: 'name', notnull: 1 },
      { name: 'created_at', notnull: 0 },
    ]);
    await migrateProfessorDocIdNullable(fake.db);

    const log = fake.log.join('\n');
    expect(log).toContain('CREATE TABLE professors_new (id TEXT PRIMARY KEY NOT NULL, doc_id TEXT UNIQUE, name TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)');
    expect(log).not.toContain('email');
    expect(log).not.toContain('updated_at');
  });
});
