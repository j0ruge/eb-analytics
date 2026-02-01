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
import { migrateLegacyData } from './migrations';

const DB_NAME = 'ebd_insights.db';

// UUIDs fixos para registros padrão
export const DEFAULT_SERIES_ID = '00000000-0000-0000-0000-000000000001';
export const DEFAULT_TOPIC_ID = '00000000-0000-0000-0000-000000000001';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
      return dbInstance;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

async function applyMigrations(db: SQLite.SQLiteDatabase) {
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
  const db = await getDatabase();
  
  await db.execAsync(CREATE_LESSONS_TABLE);
  await db.execAsync(CREATE_INDEX_STATUS);
  await db.execAsync(CREATE_INDEX_DATE);
  
  await db.execAsync(CREATE_PROFESSORS_TABLE);
  await db.execAsync(CREATE_INDEX_PROFESSORS_DOC_ID);
  await db.execAsync(CREATE_INDEX_PROFESSORS_NAME);
  
  // Create lesson_series and lesson_topics tables (003-migrate-schema-structure)
  await db.execAsync(CREATE_LESSON_SERIES_TABLE);
  await db.execAsync(CREATE_INDEX_SERIES_CODE);
  await db.execAsync(CREATE_LESSON_TOPICS_TABLE);
  await db.execAsync(CREATE_INDEX_TOPICS_SERIES_ID);
  await db.execAsync(CREATE_INDEX_TOPICS_SEQUENCE);
  
  // Apply migrations for existing databases
  await applyMigrations(db);
  
  // Insert default series and topic records
  await insertDefaultRecords(db);
  
  // Migrate legacy data to normalized schema (003-migrate-schema-structure)
  await migrateLegacyData(db);
  
  console.log('Database initialized successfully');
}
