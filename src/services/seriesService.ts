import { getDatabase } from '../db/client';
import { LessonSeries } from '../types/lessonSeries';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { normalizeText } from '../utils/text';
import { apiClient, CATALOG_WRITE_TIMEOUT_MS } from './apiClient';
import { enqueueCatalogPush } from './catalogPushQueue';

const SERIES_PATCHABLE_COLUMNS = ['code', 'title', 'description'] as const;

export const seriesService = {
  async getAllSeries(): Promise<LessonSeries[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync<LessonSeries>(
      'SELECT * FROM lesson_series ORDER BY code ASC',
    );
    return results;
  },

  async getSeriesById(id: string): Promise<LessonSeries | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<LessonSeries>(
      'SELECT * FROM lesson_series WHERE id = ?',
      [id],
    );
    return result;
  },

  async getSeriesByCode(code: string): Promise<LessonSeries | null> {
    const db = await getDatabase();
    const normalizedCode = normalizeText(code);
    const result = await db.getFirstAsync<LessonSeries>(
      'SELECT * FROM lesson_series WHERE UPPER(TRIM(code)) = ?',
      [normalizedCode],
    );
    return result;
  },

  async createSeries(
    series: Omit<LessonSeries, 'id' | 'created_at'>,
  ): Promise<LessonSeries> {
    const db = await getDatabase();

    const normalizedCode = normalizeText(series.code);

    const newSeries: LessonSeries = {
      id: uuidv4(),
      code: normalizedCode,
      title: series.title.trim(),
      description: series.description?.trim() || null,
      created_at: new Date().toISOString(),
    };

    // Atomic: uniqueness check + INSERT in one transaction.
    await db.withTransactionAsync(async () => {
      const existing = await db.getFirstAsync<LessonSeries>(
        'SELECT * FROM lesson_series WHERE UPPER(TRIM(code)) = ?',
        [normalizedCode],
      );
      if (existing) {
        throw new Error(`Série com código "${series.code}" já existe.`);
      }
      await db.runAsync(
        `INSERT INTO lesson_series (id, code, title, description) VALUES (?, ?, ?, ?)`,
        [newSeries.id, newSeries.code, newSeries.title, newSeries.description],
      );
    });

    // Push to backend with timeout — enqueue on failure (offline-first).
    const payload = {
      id: newSeries.id,
      code: newSeries.code,
      title: newSeries.title,
      description: newSeries.description,
    };
    const r = await apiClient.postWithTimeout(
      '/catalog/series',
      payload,
      CATALOG_WRITE_TIMEOUT_MS,
    );
    if (r.error) {
      await enqueueCatalogPush(db, {
        entityType: 'SERIES',
        entityId: newSeries.id,
        op: 'CREATE',
        payload,
        lastError: r.error,
      });
    }

    return newSeries;
  },

  async updateSeries(
    id: string,
    updates: Partial<Omit<LessonSeries, 'id' | 'created_at'>>,
  ): Promise<void> {
    const db = await getDatabase();

    const entries = Object.entries(updates).filter(
      ([key, value]) =>
        value !== undefined &&
        (SERIES_PATCHABLE_COLUMNS as readonly string[]).includes(key),
    );
    if (entries.length === 0) return;

    // Pre-compute normalized values once.
    const normalizedCode =
      updates.code !== undefined ? normalizeText(updates.code) : null;
    const trimmedTitle =
      updates.title !== undefined ? updates.title.trim() : null;
    const trimmedDescription =
      updates.description !== undefined
        ? updates.description?.trim() || null
        : undefined;

    // Atomic: uniqueness check + UPDATE in one tx.
    await db.withTransactionAsync(async () => {
      if (normalizedCode !== null) {
        const dup = await db.getFirstAsync<{ id: string }>(
          'SELECT id FROM lesson_series WHERE UPPER(TRIM(code)) = ? AND id != ?',
          [normalizedCode, id],
        );
        if (dup) {
          throw new Error(`Série com código "${updates.code}" já existe.`);
        }
      }
      const fields: string[] = [];
      const values: unknown[] = [];
      if (normalizedCode !== null) {
        fields.push('code');
        values.push(normalizedCode);
      }
      if (trimmedTitle !== null) {
        fields.push('title');
        values.push(trimmedTitle);
      }
      if (trimmedDescription !== undefined) {
        fields.push('description');
        values.push(trimmedDescription);
      }
      if (fields.length === 0) return;
      await db.runAsync(
        `UPDATE lesson_series SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`,
        [...values, id],
      );
    });

    // Push to backend (catalog write-back). Local UPDATE stays even on failure.
    const body: Record<string, unknown> = {};
    if (normalizedCode !== null) body.code = normalizedCode;
    if (trimmedTitle !== null) body.title = trimmedTitle;
    if (trimmedDescription !== undefined) body.description = trimmedDescription;
    if (Object.keys(body).length === 0) return;

    const r = await apiClient.patchWithTimeout(
      `/catalog/series/${id}`,
      body,
      CATALOG_WRITE_TIMEOUT_MS,
    );
    if (r.status === 404) {
      const local = await this.getSeriesById(id);
      if (!local) return; // local row gone — nothing to push
      const fullPayload = {
        id: local.id,
        code: local.code,
        title: local.title,
        description: local.description,
      };
      const post = await apiClient.postWithTimeout(
        '/catalog/series',
        fullPayload,
        CATALOG_WRITE_TIMEOUT_MS,
      );
      if (post.error) {
        await enqueueCatalogPush(db, {
          entityType: 'SERIES',
          entityId: id,
          op: 'CREATE',
          payload: fullPayload,
          lastError: post.error,
        });
      }
    } else if (r.error) {
      await enqueueCatalogPush(db, {
        entityType: 'SERIES',
        entityId: id,
        op: 'UPDATE',
        payload: body,
        lastError: r.error,
      });
    }
  },

  async deleteSeries(id: string): Promise<void> {
    const db = await getDatabase();

    const lessonCount = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM lessons_data ld
       JOIN lesson_topics lt ON ld.lesson_topic_id = lt.id
       WHERE lt.series_id = ?`,
      [id],
    );

    if (lessonCount && lessonCount.count > 0) {
      throw new Error(
        `Não é possível excluir: existem ${lessonCount.count} aula(s) vinculada(s) a esta série.`,
      );
    }

    await db.runAsync('DELETE FROM lesson_topics WHERE series_id = ?', [id]);
    await db.runAsync('DELETE FROM lesson_series WHERE id = ?', [id]);
  },

  async getSeriesCount(): Promise<number> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM lesson_series',
    );
    return result?.count || 0;
  },
};
