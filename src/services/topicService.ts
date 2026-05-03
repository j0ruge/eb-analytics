import { getDatabase } from '../db/client';
import { LessonTopic, LessonTopicWithSeries } from '../types/lessonTopic';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { normalizeText } from '../utils/text';
import { toIsoDateForWire } from '../utils/date';
import { apiClient, CATALOG_WRITE_TIMEOUT_MS } from './apiClient';
import { enqueueCatalogPush } from './catalogPushQueue';

const TOPIC_PATCHABLE_COLUMNS = [
  'series_id',
  'title',
  'suggested_date',
  'sequence_order',
] as const;

export const topicService = {
  async getTopicsBySeries(seriesId: string): Promise<LessonTopic[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync<LessonTopic>(
      `SELECT * FROM lesson_topics
       WHERE series_id = ?
       ORDER BY sequence_order ASC`,
      [seriesId],
    );
    return results;
  },

  async getTopicById(id: string): Promise<LessonTopic | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<LessonTopic>(
      'SELECT * FROM lesson_topics WHERE id = ?',
      [id],
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
      [id],
    );
    return result;
  },

  async getAllTopicsWithSeries(): Promise<LessonTopicWithSeries[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync<LessonTopicWithSeries>(
      `SELECT lt.*, ls.code as series_code, ls.title as series_title
       FROM lesson_topics lt
       JOIN lesson_series ls ON lt.series_id = ls.id
       ORDER BY ls.code ASC, lt.sequence_order ASC`,
    );
    return results;
  },

  async createTopic(
    topic: Omit<LessonTopic, 'id' | 'created_at'>,
  ): Promise<LessonTopic> {
    const db = await getDatabase();

    const normalizedTitle = normalizeText(topic.title);

    let sequenceOrder = topic.sequence_order;
    if (!sequenceOrder || sequenceOrder < 1) {
      const maxSeq = await db.getFirstAsync<{ max_seq: number | null }>(
        'SELECT MAX(sequence_order) as max_seq FROM lesson_topics WHERE series_id = ?',
        [topic.series_id],
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

    // Atomic: duplicate-title check + INSERT in one tx.
    await db.withTransactionAsync(async () => {
      const existing = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM lesson_topics
         WHERE series_id = ? AND UPPER(TRIM(title)) = ?`,
        [topic.series_id, normalizedTitle],
      );
      if (existing) {
        throw new Error(`Tópico com título "${topic.title}" já existe nesta série.`);
      }
      await db.runAsync(
        `INSERT INTO lesson_topics (id, series_id, title, suggested_date, sequence_order)
         VALUES (?, ?, ?, ?, ?)`,
        [
          newTopic.id,
          newTopic.series_id,
          newTopic.title,
          newTopic.suggested_date,
          newTopic.sequence_order,
        ],
      );
    });

    // Push to backend with timeout — enqueue on failure.
    // suggested_date is normalized to ISO YYYY-MM-DD on the wire because the
    // server's parseOptionalDate uses `new Date()`, which rejects pt-BR
    // abbreviations that don't overlap with English (FEV/ABR/MAI/AGO/SET/OUT/DEZ).
    const payload = {
      id: newTopic.id,
      series_id: newTopic.series_id,
      title: newTopic.title,
      sequence_order: newTopic.sequence_order,
      suggested_date: toIsoDateForWire(newTopic.suggested_date),
    };
    const r = await apiClient.postWithTimeout(
      '/catalog/topics',
      payload,
      CATALOG_WRITE_TIMEOUT_MS,
    );
    if (r.error) {
      await enqueueCatalogPush(db, {
        entityType: 'TOPIC',
        entityId: newTopic.id,
        op: 'CREATE',
        payload,
        lastError: r.error,
      });
    }

    return newTopic;
  },

  async updateTopic(
    id: string,
    updates: Partial<Omit<LessonTopic, 'id' | 'created_at'>>,
  ): Promise<void> {
    const db = await getDatabase();

    const entries = Object.entries(updates).filter(
      ([key, value]) =>
        value !== undefined &&
        (TOPIC_PATCHABLE_COLUMNS as readonly string[]).includes(key),
    );
    if (entries.length === 0) return;

    const currentTopic = await this.getTopicById(id);
    if (!currentTopic) {
      throw new Error('Tópico não encontrado.');
    }

    const trimmedTitle =
      updates.title !== undefined ? updates.title.trim() : null;
    const trimmedDate =
      updates.suggested_date !== undefined
        ? updates.suggested_date?.trim() || null
        : undefined;
    const newSeriesId =
      updates.series_id !== undefined ? updates.series_id : null;
    const newOrder =
      updates.sequence_order !== undefined ? updates.sequence_order : null;

    // Atomic: duplicate-title check + UPDATE in one tx.
    await db.withTransactionAsync(async () => {
      if (trimmedTitle !== null) {
        const normalizedTitle = normalizeText(trimmedTitle);
        const seriesId = newSeriesId ?? currentTopic.series_id;
        const dup = await db.getFirstAsync<{ id: string }>(
          `SELECT id FROM lesson_topics
           WHERE series_id = ? AND UPPER(TRIM(title)) = ? AND id != ?`,
          [seriesId, normalizedTitle, id],
        );
        if (dup) {
          throw new Error(
            `Tópico com título "${updates.title}" já existe nesta série.`,
          );
        }
      }
      const fields: string[] = [];
      const values: unknown[] = [];
      if (newSeriesId !== null) {
        fields.push('series_id');
        values.push(newSeriesId);
      }
      if (trimmedTitle !== null) {
        fields.push('title');
        values.push(trimmedTitle);
      }
      if (trimmedDate !== undefined) {
        fields.push('suggested_date');
        values.push(trimmedDate);
      }
      if (newOrder !== null) {
        fields.push('sequence_order');
        values.push(newOrder);
      }
      if (fields.length === 0) return;
      await db.runAsync(
        `UPDATE lesson_topics SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`,
        [...values, id],
      );
    });

    // Push to backend.
    const body: Record<string, unknown> = {};
    if (trimmedTitle !== null) body.title = trimmedTitle;
    if (newOrder !== null) body.sequence_order = newOrder;
    if (trimmedDate !== undefined) body.suggested_date = toIsoDateForWire(trimmedDate);
    if (Object.keys(body).length === 0) return;

    const r = await apiClient.patchWithTimeout(
      `/catalog/topics/${id}`,
      body,
      CATALOG_WRITE_TIMEOUT_MS,
    );
    if (r.status === 404) {
      const local = await this.getTopicById(id);
      if (!local) return;
      const fullPayload = {
        id: local.id,
        series_id: local.series_id,
        title: local.title,
        sequence_order: local.sequence_order,
        suggested_date: toIsoDateForWire(local.suggested_date),
      };
      const post = await apiClient.postWithTimeout(
        '/catalog/topics',
        fullPayload,
        CATALOG_WRITE_TIMEOUT_MS,
      );
      if (post.error) {
        await enqueueCatalogPush(db, {
          entityType: 'TOPIC',
          entityId: id,
          op: 'CREATE',
          payload: fullPayload,
          lastError: post.error,
        });
      }
    } else if (r.error) {
      await enqueueCatalogPush(db, {
        entityType: 'TOPIC',
        entityId: id,
        op: 'UPDATE',
        payload: body,
        lastError: r.error,
      });
    }
  },

  async deleteTopic(id: string): Promise<void> {
    const db = await getDatabase();

    const lessonCount = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM lessons_data WHERE lesson_topic_id = ?',
      [id],
    );

    if (lessonCount && lessonCount.count > 0) {
      throw new Error(
        `Não é possível excluir: existem ${lessonCount.count} aula(s) vinculada(s) a este tópico.`,
      );
    }

    await db.runAsync('DELETE FROM lesson_topics WHERE id = ?', [id]);
  },

  async getTopicCount(seriesId?: string): Promise<number> {
    const db = await getDatabase();

    if (seriesId) {
      const result = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM lesson_topics WHERE series_id = ?',
        [seriesId],
      );
      return result?.count || 0;
    }

    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM lesson_topics',
    );
    return result?.count || 0;
  },

  async getTopicCountsBySeries(
    seriesIds: string[],
  ): Promise<Record<string, number>> {
    if (seriesIds.length === 0) return {};

    const db = await getDatabase();
    const placeholders = seriesIds.map(() => '?').join(', ');
    const rows = await db.getAllAsync<{ series_id: string; count: number }>(
      `SELECT series_id, COUNT(*) as count FROM lesson_topics WHERE series_id IN (${placeholders}) GROUP BY series_id`,
      seriesIds,
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
