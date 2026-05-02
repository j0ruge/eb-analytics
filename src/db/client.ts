import * as SQLite from 'expo-sqlite';
import {
  CREATE_LESSONS_TABLE,
  CREATE_INDEX_STATUS,
  CREATE_INDEX_DATE,
  CREATE_INDEX_PROFESSOR_ID,
  CREATE_PROFESSORS_TABLE,
  CREATE_INDEX_PROFESSORS_DOC_ID,
  CREATE_INDEX_PROFESSORS_NAME,
  CREATE_LESSON_SERIES_TABLE,
  CREATE_INDEX_SERIES_CODE,
  CREATE_LESSON_TOPICS_TABLE,
  CREATE_INDEX_TOPICS_SERIES_ID,
  CREATE_INDEX_TOPICS_SEQUENCE,
  CREATE_INDEX_LESSON_TOPIC_ID,
} from './schema';
import {
  migrateLegacyData,
  migrateAddAuthIdentity,
  migrateAddSyncStatus,
  migrateNormalizeTopicSuggestedDate,
} from './migrations';
import { DB_NAME, DEFAULT_SERIES_ID, DEFAULT_TOPIC_ID } from './constants';

// Re-export constants for backward compatibility
export { DEFAULT_SERIES_ID, DEFAULT_TOPIC_ID };

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<void> | null = null;

/**
 * Returns the database connection, initializing it if needed.
 * All callers share a single connection and wait for init to complete.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  // Trigger init on first call; subsequent calls reuse the same promise
  if (!dbInitPromise) {
    dbInitPromise = _doInitializeDatabase();
  }
  await dbInitPromise;
  return dbInstance!;
}

export interface MigrationCapableDb {
  execAsync: (sql: string) => Promise<void>;
  getAllAsync: <T>(sql: string) => Promise<T[]>;
  getFirstAsync: <T>(sql: string) => Promise<T | null>;
}

export async function applyMigrations(db: MigrationCapableDb) {
  // Check if professor_id column exists in lessons_data
  const tableInfo = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(lessons_data)"
  );

  const hasProfessorId = tableInfo.some(col => col.name === 'professor_id');

  if (!hasProfessorId) {
    console.log('Applying migration: Adding professor_id column to lessons_data');
    await db.execAsync('ALTER TABLE lessons_data ADD COLUMN professor_id TEXT;');
    await db.execAsync(CREATE_INDEX_PROFESSOR_ID);
  }

  // Check if lesson_topic_id column exists in lessons_data (003-migrate-schema-structure)
  const hasLessonTopicId = tableInfo.some(col => col.name === 'lesson_topic_id');

  if (!hasLessonTopicId) {
    console.log('Applying migration: Adding lesson_topic_id column to lessons_data');
    await db.execAsync('ALTER TABLE lessons_data ADD COLUMN lesson_topic_id TEXT;');
    await db.execAsync(CREATE_INDEX_LESSON_TOPIC_ID);
  }

  // Migration: Update status CHECK constraint to include 'EXPORTED' (004-add-exported-status)
  // SQLite doesn't support ALTER TABLE to modify constraints, so we need to recreate the table
  const needsStatusMigration = await checkIfStatusMigrationNeeded(db);

  if (needsStatusMigration) {
    console.log('Applying migration: Adding EXPORTED to status CHECK constraint');
    await migrateStatusConstraint(db);
  }

  // Spec 005: add client_updated_at, includes_professor, weather, notes to lessons_data.
  // Re-fetch table info because migrateStatusConstraint may have rebuilt the table.
  const tableInfoAfter = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(lessons_data)"
  );

  const hasClientUpdatedAt = tableInfoAfter.some(col => col.name === 'client_updated_at');
  if (!hasClientUpdatedAt) {
    console.log('Applying migration: Adding client_updated_at column to lessons_data (spec 005)');
    await db.execAsync('ALTER TABLE lessons_data ADD COLUMN client_updated_at TEXT;');
  }
  // Backfill unconditionally — idempotent and crash-safe. If the app crashed
  // between ALTER and UPDATE on a previous launch, this catches the orphaned NULLs.
  await db.execAsync(
    'UPDATE lessons_data SET client_updated_at = created_at WHERE client_updated_at IS NULL;'
  );

  const hasIncludesProfessor = tableInfoAfter.some(col => col.name === 'includes_professor');
  if (!hasIncludesProfessor) {
    console.log('Applying migration: Adding includes_professor column to lessons_data (spec 005)');
    await db.execAsync(
      'ALTER TABLE lessons_data ADD COLUMN includes_professor INTEGER NOT NULL DEFAULT 0;'
    );
  }

  const hasWeather = tableInfoAfter.some(col => col.name === 'weather');
  if (!hasWeather) {
    console.log('Applying migration: Adding weather column to lessons_data (spec 005)');
    await db.execAsync('ALTER TABLE lessons_data ADD COLUMN weather TEXT;');
  }

  const hasNotes = tableInfoAfter.some(col => col.name === 'notes');
  if (!hasNotes) {
    console.log('Applying migration: Adding notes column to lessons_data (spec 005)');
    await db.execAsync('ALTER TABLE lessons_data ADD COLUMN notes TEXT;');
  }
}

async function checkIfStatusMigrationNeeded(db: MigrationCapableDb): Promise<boolean> {
  try {
    // Check table schema to see if migration was already applied
    const sql = await db.getFirstAsync<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='lessons_data'"
    );

    if (!sql || !sql.sql) {
      // Table doesn't exist yet, no migration needed (will be created fresh)
      return false;
    }

    // Check if the constraint includes 'EXPORTED'
    const hasExported = sql.sql.includes("'EXPORTED'");

    // Return true if migration is needed (constraint doesn't have EXPORTED)
    return !hasExported;
  } catch (error) {
    console.error('Error checking migration status:', error);
    // If we can't check, assume migration is needed
    return true;
  }
}

async function migrateStatusConstraint(db: MigrationCapableDb) {
  try {
    // Step 0: Clean up any incomplete previous migration
    await db.execAsync('DROP TABLE IF EXISTS lessons_data_new;');

    // Step 1: Create new table with updated constraint
    await db.execAsync(`
      CREATE TABLE lessons_data_new (
        id TEXT PRIMARY KEY NOT NULL,
        date TEXT NOT NULL,
        coordinator_name TEXT DEFAULT '',
        professor_name TEXT DEFAULT '',
        professor_id TEXT,
        lesson_topic_id TEXT,
        series_name TEXT DEFAULT '',
        lesson_title TEXT DEFAULT '',
        time_expected_start TEXT DEFAULT '10:00',
        time_real_start TEXT,
        time_expected_end TEXT DEFAULT '11:00',
        time_real_end TEXT,
        attendance_start INTEGER DEFAULT 0,
        attendance_mid INTEGER DEFAULT 0,
        attendance_end INTEGER DEFAULT 0,
        unique_participants INTEGER DEFAULT 0,
        status TEXT CHECK(status IN ('IN_PROGRESS', 'COMPLETED', 'EXPORTED', 'SYNCED')) DEFAULT 'IN_PROGRESS',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Step 2: Copy all data from old table to new table
    // Only copy valid status values, default invalid ones to 'IN_PROGRESS'
    await db.execAsync(`
      INSERT INTO lessons_data_new
      SELECT
        id,
        date,
        coordinator_name,
        professor_name,
        professor_id,
        lesson_topic_id,
        series_name,
        lesson_title,
        time_expected_start,
        time_real_start,
        time_expected_end,
        time_real_end,
        attendance_start,
        attendance_mid,
        attendance_end,
        unique_participants,
        CASE
          WHEN status IN ('IN_PROGRESS', 'COMPLETED', 'EXPORTED', 'SYNCED') THEN status
          ELSE 'IN_PROGRESS'
        END as status,
        created_at
      FROM lessons_data;
    `);

    // Step 3: Drop old table
    await db.execAsync('DROP TABLE lessons_data;');

    // Step 4: Rename new table to original name
    await db.execAsync('ALTER TABLE lessons_data_new RENAME TO lessons_data;');

    // Step 5: Recreate indexes
    await db.execAsync(CREATE_INDEX_STATUS);
    await db.execAsync(CREATE_INDEX_DATE);
    await db.execAsync(CREATE_INDEX_PROFESSOR_ID);
    await db.execAsync(CREATE_INDEX_LESSON_TOPIC_ID);

    console.log('Status constraint migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    // Try to rollback by dropping the new table if it exists
    try {
      await db.execAsync('DROP TABLE IF EXISTS lessons_data_new;');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
    throw error;
  }
}

async function insertDefaultRecords(db: SQLite.SQLiteDatabase) {
  // Série padrão para registros sem série
  await db.runAsync(
    `INSERT OR IGNORE INTO lesson_series (id, code, title, description)
     VALUES (?, ?, ?, ?)`,
    [DEFAULT_SERIES_ID, 'SEM-SERIE', 'Sem Série', 'Série padrão para registros migrados sem informação']
  );

  // Tópico padrão para registros sem tópico
  await db.runAsync(
    `INSERT OR IGNORE INTO lesson_topics (id, series_id, title, sequence_order)
     VALUES (?, ?, ?, ?)`,
    [DEFAULT_TOPIC_ID, DEFAULT_SERIES_ID, 'Sem Tópico', 1]
  );
}

export async function initializeDatabase() {
  // Just call getDatabase — it triggers init if not already started
  await getDatabase();
}

async function _doInitializeDatabase() {
  // Close any stale connection from a previous hot-reload cycle
  if (dbInstance) {
    try {
      await dbInstance.closeAsync();
    } catch (_) {
      // Ignore — connection may already be invalid
    }
    dbInstance = null;
  }

  const db = await SQLite.openDatabaseAsync(DB_NAME);
  dbInstance = db;

  // Batch all DDL into a single execAsync call to avoid multiple lock acquisitions.
  // expo-sqlite execAsync supports semicolon-separated statements.
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    ${CREATE_LESSONS_TABLE}
    ${CREATE_INDEX_STATUS}
    ${CREATE_INDEX_DATE}

    ${CREATE_PROFESSORS_TABLE}
    ${CREATE_INDEX_PROFESSORS_DOC_ID}
    ${CREATE_INDEX_PROFESSORS_NAME}

    ${CREATE_LESSON_SERIES_TABLE}
    ${CREATE_INDEX_SERIES_CODE}
    ${CREATE_LESSON_TOPICS_TABLE}
    ${CREATE_INDEX_TOPICS_SERIES_ID}
    ${CREATE_INDEX_TOPICS_SEQUENCE}
  `);

  // Apply migrations for existing databases
  await applyMigrations(db);

  // Insert default series and topic records
  await insertDefaultRecords(db);

  // Migrate legacy data to normalized schema (003-migrate-schema-structure)
  await migrateLegacyData(db);

  // Add auth identity support (006-auth-identity)
  await migrateAddAuthIdentity(db);

  // Add offline-sync columns and catalog updated_at/email (008-offline-sync-client)
  await migrateAddSyncStatus(db);

  // Normalize lesson_topics.suggested_date that older pulls stored as full ISO.
  await migrateNormalizeTopicSuggestedDate(db);

  // Boot reconciliation (008 EC-001): any row stuck in SENDING from a prior
  // crash must return to QUEUED so the sync loop can retry it. Server
  // idempotency (via collections[].id) guarantees the resend is safe.
  await db.runAsync(
    "UPDATE lessons_data SET sync_status = 'QUEUED' WHERE sync_status = 'SENDING'"
  );

  console.log('Database initialized successfully');
}
