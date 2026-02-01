import * as SQLite from 'expo-sqlite';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_SERIES_ID, DEFAULT_TOPIC_ID } from './client';
import { normalizeText, extractSeriesCode, extractSeriesTitle } from '../utils/text';

const MIGRATION_FLAG_KEY = '003_schema_migration_complete';

interface LegacyLessonRow {
  id: string;
  series_name: string | null;
  lesson_title: string | null;
}

interface SeriesMap {
  [normalizedCode: string]: {
    id: string;
    code: string;
    title: string;
    topics: { [normalizedTitle: string]: { id: string; title: string } };
  };
}

/**
 * Verifica se a migração já foi executada.
 */
async function isMigrationComplete(db: SQLite.SQLiteDatabase): Promise<boolean> {
  // Usa uma tabela simples para flags de migração
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS _migration_flags (
      key TEXT PRIMARY KEY NOT NULL,
      completed_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  const result = await db.getFirstAsync<{ key: string }>(
    `SELECT key FROM _migration_flags WHERE key = ?`,
    [MIGRATION_FLAG_KEY]
  );
  
  return result !== null;
}

/**
 * Marca a migração como completa.
 */
async function markMigrationComplete(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO _migration_flags (key) VALUES (?)`,
    [MIGRATION_FLAG_KEY]
  );
}

/**
 * Extrai séries únicas dos dados existentes.
 */
async function extractUniqueSeries(db: SQLite.SQLiteDatabase): Promise<Map<string, { code: string; title: string }>> {
  const rows = await db.getAllAsync<{ series_name: string }>(
    `SELECT DISTINCT series_name FROM lessons_data 
     WHERE series_name IS NOT NULL AND series_name != ''`
  );
  
  const seriesMap = new Map<string, { code: string; title: string }>();
  
  for (const row of rows) {
    const normalizedCode = normalizeText(extractSeriesCode(row.series_name));
    
    if (!seriesMap.has(normalizedCode)) {
      seriesMap.set(normalizedCode, {
        code: normalizedCode,
        title: extractSeriesTitle(row.series_name),
      });
    }
  }
  
  return seriesMap;
}

/**
 * Cria registros de série no banco de dados.
 */
async function createSeriesRecords(
  db: SQLite.SQLiteDatabase,
  seriesMap: Map<string, { code: string; title: string }>
): Promise<Map<string, string>> {
  const codeToIdMap = new Map<string, string>();
  
  for (const [normalizedCode, series] of seriesMap.entries()) {
    const existingId = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM lesson_series WHERE code = ?`,
      [series.code]
    );
    
    if (existingId) {
      codeToIdMap.set(normalizedCode, existingId.id);
    } else {
      const newId = uuidv4();
      await db.runAsync(
        `INSERT INTO lesson_series (id, code, title) VALUES (?, ?, ?)`,
        [newId, series.code, series.title]
      );
      codeToIdMap.set(normalizedCode, newId);
    }
  }
  
  return codeToIdMap;
}

/**
 * Extrai tópicos únicos agrupados por série.
 */
async function extractUniqueTopics(
  db: SQLite.SQLiteDatabase,
  seriesCodeToId: Map<string, string>
): Promise<Map<string, { seriesId: string; title: string }>> {
  const rows = await db.getAllAsync<{ series_name: string; lesson_title: string }>(
    `SELECT DISTINCT series_name, lesson_title FROM lessons_data 
     WHERE lesson_title IS NOT NULL AND lesson_title != ''`
  );
  
  // Key: seriesId + "|" + normalizedTitle
  const topicMap = new Map<string, { seriesId: string; title: string }>();
  
  for (const row of rows) {
    const normalizedSeriesCode = normalizeText(extractSeriesCode(row.series_name || ''));
    const seriesId = seriesCodeToId.get(normalizedSeriesCode) || DEFAULT_SERIES_ID;
    const normalizedTitle = normalizeText(row.lesson_title);
    const key = `${seriesId}|${normalizedTitle}`;
    
    if (!topicMap.has(key)) {
      topicMap.set(key, {
        seriesId,
        title: row.lesson_title.trim(),
      });
    }
  }
  
  return topicMap;
}

/**
 * Cria registros de tópicos no banco de dados.
 */
async function createTopicRecords(
  db: SQLite.SQLiteDatabase,
  topicMap: Map<string, { seriesId: string; title: string }>
): Promise<Map<string, string>> {
  // Key: seriesId + "|" + normalizedTitle => topicId
  const keyToIdMap = new Map<string, string>();
  
  // Track sequence order per series
  const seriesSequence = new Map<string, number>();
  
  for (const [key, topic] of topicMap.entries()) {
    const normalizedTitle = normalizeText(topic.title);
    
    // Check if topic already exists
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM lesson_topics WHERE series_id = ? AND UPPER(TRIM(title)) = ?`,
      [topic.seriesId, normalizedTitle]
    );
    
    if (existing) {
      keyToIdMap.set(key, existing.id);
    } else {
      const sequenceOrder = (seriesSequence.get(topic.seriesId) || 0) + 1;
      seriesSequence.set(topic.seriesId, sequenceOrder);
      
      const newId = uuidv4();
      await db.runAsync(
        `INSERT INTO lesson_topics (id, series_id, title, sequence_order) VALUES (?, ?, ?, ?)`,
        [newId, topic.seriesId, topic.title, sequenceOrder]
      );
      keyToIdMap.set(key, newId);
    }
  }
  
  return keyToIdMap;
}

/**
 * Atualiza lessons_data com lesson_topic_id.
 */
async function updateLessonsWithTopicId(
  db: SQLite.SQLiteDatabase,
  seriesCodeToId: Map<string, string>,
  topicKeyToId: Map<string, string>
): Promise<number> {
  // Get all lessons without lesson_topic_id
  const lessons = await db.getAllAsync<LegacyLessonRow>(
    `SELECT id, series_name, lesson_title FROM lessons_data 
     WHERE lesson_topic_id IS NULL`
  );
  
  let updatedCount = 0;
  
  for (const lesson of lessons) {
    let topicId: string;
    
    if (!lesson.lesson_title || lesson.lesson_title.trim() === '') {
      // Link to default topic
      topicId = DEFAULT_TOPIC_ID;
    } else {
      const normalizedSeriesCode = normalizeText(extractSeriesCode(lesson.series_name || ''));
      const seriesId = seriesCodeToId.get(normalizedSeriesCode) || DEFAULT_SERIES_ID;
      const normalizedTitle = normalizeText(lesson.lesson_title);
      const key = `${seriesId}|${normalizedTitle}`;
      
      topicId = topicKeyToId.get(key) || DEFAULT_TOPIC_ID;
    }
    
    await db.runAsync(
      `UPDATE lessons_data SET lesson_topic_id = ? WHERE id = ?`,
      [topicId, lesson.id]
    );
    updatedCount++;
  }
  
  return updatedCount;
}

/**
 * Executa a migração completa dos dados legados para a nova estrutura.
 * Esta função é idempotente - não re-executa se já foi completada.
 */
export async function migrateLegacyData(db: SQLite.SQLiteDatabase): Promise<void> {
  // Check if migration already complete
  if (await isMigrationComplete(db)) {
    console.log('Migration 003 already complete, skipping');
    return;
  }
  
  console.log('Starting migration 003: Legacy data to normalized schema...');
  
  try {
    // Step 1: Extract and create series
    console.log('Step 1: Extracting unique series from legacy data...');
    const uniqueSeries = await extractUniqueSeries(db);
    console.log(`Found ${uniqueSeries.size} unique series`);
    
    const seriesCodeToId = await createSeriesRecords(db, uniqueSeries);
    console.log(`Created/found ${seriesCodeToId.size} series records`);
    
    // Step 2: Extract and create topics
    console.log('Step 2: Extracting unique topics from legacy data...');
    const uniqueTopics = await extractUniqueTopics(db, seriesCodeToId);
    console.log(`Found ${uniqueTopics.size} unique topics`);
    
    const topicKeyToId = await createTopicRecords(db, uniqueTopics);
    console.log(`Created/found ${topicKeyToId.size} topic records`);
    
    // Step 3: Update lessons with lesson_topic_id
    console.log('Step 3: Updating lessons with topic references...');
    const updatedCount = await updateLessonsWithTopicId(db, seriesCodeToId, topicKeyToId);
    console.log(`Updated ${updatedCount} lesson records`);
    
    // Mark migration as complete
    await markMigrationComplete(db);
    console.log('Migration 003 completed successfully');
    
  } catch (error) {
    console.error('Migration 003 failed:', error);
    throw error;
  }
}
