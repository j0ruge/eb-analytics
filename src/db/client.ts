import * as SQLite from 'expo-sqlite';
import { CREATE_LESSONS_TABLE, CREATE_INDEX_STATUS, CREATE_INDEX_DATE, CREATE_INDEX_PROFESSOR_ID, CREATE_PROFESSORS_TABLE, CREATE_INDEX_PROFESSORS_DOC_ID, CREATE_INDEX_PROFESSORS_NAME } from './schema';

const DB_NAME = 'ebd_insights.db';

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
}

export async function initializeDatabase() {
  const db = await getDatabase();
  
  await db.execAsync(CREATE_LESSONS_TABLE);
  await db.execAsync(CREATE_INDEX_STATUS);
  await db.execAsync(CREATE_INDEX_DATE);
  
  await db.execAsync(CREATE_PROFESSORS_TABLE);
  await db.execAsync(CREATE_INDEX_PROFESSORS_DOC_ID);
  await db.execAsync(CREATE_INDEX_PROFESSORS_NAME);
  
  // Apply migrations for existing databases
  await applyMigrations(db);
  
  console.log('Database initialized successfully');
}
