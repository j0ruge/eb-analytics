import { getDatabase } from '../db/client';
import { LessonTopic, LessonTopicWithSeries } from '../types/lessonTopic';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { normalizeText } from '../utils/text';

export const topicService = {
  async getTopicsBySeries(seriesId: string): Promise<LessonTopic[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync<LessonTopic>(
      `SELECT * FROM lesson_topics 
       WHERE series_id = ? 
       ORDER BY sequence_order ASC`,
      [seriesId]
    );
    return results;
  },

  async getTopicById(id: string): Promise<LessonTopic | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<LessonTopic>(
      'SELECT * FROM lesson_topics WHERE id = ?',
      [id]
    );
    return result;
  },

  async getTopicWithSeries(id: string): Promise<LessonTopicWithSeries | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<LessonTopicWithSeries>(
      `SELECT lt.*, ls.code as series_code, ls.title as series_title
       FROM lesson_topics lt
       JOIN lesson_series ls ON lt.series_id = ls.id
       WHERE lt.id = ?`,
      [id]
    );
    return result;
  },

  async getAllTopicsWithSeries(): Promise<LessonTopicWithSeries[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync<LessonTopicWithSeries>(
      `SELECT lt.*, ls.code as series_code, ls.title as series_title
       FROM lesson_topics lt
       JOIN lesson_series ls ON lt.series_id = ls.id
       ORDER BY ls.code ASC, lt.sequence_order ASC`
    );
    return results;
  },

  async createTopic(topic: Omit<LessonTopic, 'id' | 'created_at'>): Promise<LessonTopic> {
    const db = await getDatabase();
    
    const normalizedTitle = normalizeText(topic.title);
    
    // Check for duplicate title in same series
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM lesson_topics 
       WHERE series_id = ? AND UPPER(TRIM(title)) = ?`,
      [topic.series_id, normalizedTitle]
    );
    if (existing) {
      throw new Error(`Tópico com título "${topic.title}" já existe nesta série.`);
    }
    
    // Get next sequence order if not provided
    let sequenceOrder = topic.sequence_order;
    if (!sequenceOrder || sequenceOrder < 1) {
      const maxSeq = await db.getFirstAsync<{ max_seq: number | null }>(
        'SELECT MAX(sequence_order) as max_seq FROM lesson_topics WHERE series_id = ?',
        [topic.series_id]
      );
      sequenceOrder = (maxSeq?.max_seq || 0) + 1;
    }
    
    const newTopic: LessonTopic = {
      id: uuidv4(),
      series_id: topic.series_id,
      title: topic.title.trim(),
      suggested_date: topic.suggested_date?.trim() || null,
      sequence_order: sequenceOrder,
      created_at: new Date().toISOString(),
    };

    await db.runAsync(
      `INSERT INTO lesson_topics (id, series_id, title, suggested_date, sequence_order) 
       VALUES (?, ?, ?, ?, ?)`,
      [newTopic.id, newTopic.series_id, newTopic.title, newTopic.suggested_date, newTopic.sequence_order]
    );

    return newTopic;
  },

  async updateTopic(id: string, updates: Partial<Omit<LessonTopic, 'id' | 'created_at'>>): Promise<void> {
    const db = await getDatabase();
    
    const entries = Object.entries(updates).filter(([_, value]) => value !== undefined);
    if (entries.length === 0) return;

    // Get current topic to check series_id for duplicate validation
    const currentTopic = await this.getTopicById(id);
    if (!currentTopic) {
      throw new Error('Tópico não encontrado.');
    }

    // If updating title, check for duplicates in same series
    if (updates.title) {
      const normalizedTitle = normalizeText(updates.title);
      const seriesId = updates.series_id || currentTopic.series_id;
      
      const existing = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM lesson_topics 
         WHERE series_id = ? AND UPPER(TRIM(title)) = ? AND id != ?`,
        [seriesId, normalizedTitle, id]
      );
      if (existing) {
        throw new Error(`Tópico com título "${updates.title}" já existe nesta série.`);
      }
    }

    const fields = entries.map(([key]) => key);
    const values = entries.map(([_, value]) => {
      if (typeof value === 'string') return value.trim();
      return value;
    });

    const query = `UPDATE lesson_topics SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`;
    await db.runAsync(query, [...values, id]);
  },

  async deleteTopic(id: string): Promise<void> {
    const db = await getDatabase();
    
    // Check if any lessons reference this topic
    const lessonCount = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM lessons_data WHERE lesson_topic_id = ?',
      [id]
    );

    if (lessonCount && lessonCount.count > 0) {
      throw new Error(`Não é possível excluir: existem ${lessonCount.count} aula(s) vinculada(s) a este tópico.`);
    }

    await db.runAsync('DELETE FROM lesson_topics WHERE id = ?', [id]);
  },

  async getTopicCount(seriesId?: string): Promise<number> {
    const db = await getDatabase();
    
    if (seriesId) {
      const result = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM lesson_topics WHERE series_id = ?',
        [seriesId]
      );
      return result?.count || 0;
    }
    
    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM lesson_topics'
    );
    return result?.count || 0;
  },

  async getTopicCountsBySeries(seriesIds: string[]): Promise<Record<string, number>> {
    if (seriesIds.length === 0) return {};

    const db = await getDatabase();
    const placeholders = seriesIds.map(() => '?').join(', ');
    const rows = await db.getAllAsync<{ series_id: string; count: number }>(
      `SELECT series_id, COUNT(*) as count FROM lesson_topics WHERE series_id IN (${placeholders}) GROUP BY series_id`,
      seriesIds
    );

    const counts: Record<string, number> = {};
    for (const id of seriesIds) {
      counts[id] = 0;
    }
    for (const row of rows) {
      counts[row.series_id] = row.count;
    }
    return counts;
  },
};
