import { getDatabase } from '../db/client';
import { LessonSeries } from '../types/lessonSeries';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { normalizeText } from '../utils/text';

export const seriesService = {
  async getAllSeries(): Promise<LessonSeries[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync<LessonSeries>(
      'SELECT * FROM lesson_series ORDER BY code ASC'
    );
    return results;
  },

  async getSeriesById(id: string): Promise<LessonSeries | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<LessonSeries>(
      'SELECT * FROM lesson_series WHERE id = ?',
      [id]
    );
    return result;
  },

  async getSeriesByCode(code: string): Promise<LessonSeries | null> {
    const db = await getDatabase();
    const normalizedCode = normalizeText(code);
    const result = await db.getFirstAsync<LessonSeries>(
      'SELECT * FROM lesson_series WHERE UPPER(TRIM(code)) = ?',
      [normalizedCode]
    );
    return result;
  },

  async createSeries(series: Omit<LessonSeries, 'id' | 'created_at'>): Promise<LessonSeries> {
    const db = await getDatabase();
    
    const normalizedCode = normalizeText(series.code);
    
    // Check for duplicate code
    const existing = await this.getSeriesByCode(normalizedCode);
    if (existing) {
      throw new Error(`Série com código "${series.code}" já existe.`);
    }
    
    const newSeries: LessonSeries = {
      id: uuidv4(),
      code: normalizedCode,
      title: series.title.trim(),
      description: series.description?.trim() || null,
      created_at: new Date().toISOString(),
    };

    await db.runAsync(
      `INSERT INTO lesson_series (id, code, title, description) VALUES (?, ?, ?, ?)`,
      [newSeries.id, newSeries.code, newSeries.title, newSeries.description]
    );

    return newSeries;
  },

  async updateSeries(id: string, updates: Partial<Omit<LessonSeries, 'id' | 'created_at'>>): Promise<void> {
    const db = await getDatabase();
    
    const entries = Object.entries(updates).filter(([_, value]) => value !== undefined);
    if (entries.length === 0) return;

    // If updating code, check for duplicates
    if (updates.code) {
      const normalizedCode = normalizeText(updates.code);
      const existing = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM lesson_series WHERE UPPER(TRIM(code)) = ? AND id != ?',
        [normalizedCode, id]
      );
      if (existing) {
        throw new Error(`Série com código "${updates.code}" já existe.`);
      }
    }

    const fields = entries.map(([key]) => key);
    const values = entries.map(([key, value]) => {
      if (key === 'code') return normalizeText(value as string);
      if (typeof value === 'string') return value.trim();
      return value;
    });

    const query = `UPDATE lesson_series SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`;
    await db.runAsync(query, [...values, id]);
  },

  async deleteSeries(id: string): Promise<void> {
    const db = await getDatabase();
    
    // Check if any lessons reference topics in this series
    const lessonCount = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM lessons_data ld
       JOIN lesson_topics lt ON ld.lesson_topic_id = lt.id
       WHERE lt.series_id = ?`,
      [id]
    );

    if (lessonCount && lessonCount.count > 0) {
      throw new Error(`Não é possível excluir: existem ${lessonCount.count} aula(s) vinculada(s) a esta série.`);
    }

    // Delete topics first (FK constraint)
    await db.runAsync('DELETE FROM lesson_topics WHERE series_id = ?', [id]);
    
    // Then delete series
    await db.runAsync('DELETE FROM lesson_series WHERE id = ?', [id]);
  },

  async getSeriesCount(): Promise<number> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM lesson_series'
    );
    return result?.count || 0;
  },
};
