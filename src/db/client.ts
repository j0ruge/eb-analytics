import * as SQLite from 'expo-sqlite';
import { CREATE_LESSONS_TABLE, CREATE_INDEX_STATUS, CREATE_INDEX_DATE } from './schema';

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

export async function initializeDatabase() {
  const db = await getDatabase();
  
  await db.execAsync(CREATE_LESSONS_TABLE);
  await db.execAsync(CREATE_INDEX_STATUS);
  await db.execAsync(CREATE_INDEX_DATE);
  
  console.log('Database initialized successfully');
}
