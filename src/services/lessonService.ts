import { getDatabase } from '../db/client';
import { Lesson, LessonStatus, LessonWithDetails } from '../types/lesson';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { getIncludesProfessorDefault } from '../hooks/useIncludesProfessorDefault';

type LessonUpdates = Partial<Lesson>;

// Apply the FR-017 XOR invariant defensively to a create or update payload.
// When a catalog id is set, clear the paired legacy text field in the same
// statement so the row on disk never holds both sides at once.
function applyWritePathXor<T extends LessonUpdates>(updates: T): T {
  const next: T = { ...updates };

  // professor pair
  if (next.professor_id !== undefined && next.professor_id !== null) {
    next.professor_name = '';
  } else if (
    next.professor_name !== undefined &&
    next.professor_name !== null &&
    next.professor_name !== ''
  ) {
    next.professor_id = null;
  }

  // topic pair (+ series side effect: catalog topic wins over free-text series)
  if (next.lesson_topic_id !== undefined && next.lesson_topic_id !== null) {
    next.lesson_title = '';
    next.series_name = '';
  } else if (
    (next.lesson_title !== undefined &&
      next.lesson_title !== null &&
      next.lesson_title !== '') ||
    (next.series_name !== undefined &&
      next.series_name !== null &&
      next.series_name !== '')
  ) {
    // Free-text topic wins — if any free-text field is being set to a non-empty value,
    // ensure the catalog id is null (usually already the caller's intent).
    next.lesson_topic_id = null;
  }

  return next;
}

export const lessonService = {
  async createLesson(partialLesson?: Partial<Lesson>): Promise<Lesson> {
    const db = await getDatabase();

    // Smart defaults: reuse last lesson's metadata
    const lastLesson = await this.getLastLesson();
    const now = new Date().toISOString();

    // Resolve initial includes_professor: caller wins → last lesson → user preference
    let includesProfessor: boolean;
    if (typeof partialLesson?.includes_professor === 'boolean') {
      includesProfessor = partialLesson.includes_professor;
    } else if (typeof lastLesson?.includes_professor === 'boolean') {
      includesProfessor = lastLesson.includes_professor;
    } else {
      includesProfessor = await getIncludesProfessorDefault();
    }

    const merged: Lesson = {
      id: uuidv4(),
      date: new Date().toISOString().split('T')[0],
      coordinator_name: partialLesson?.coordinator_name || lastLesson?.coordinator_name || '',
      professor_name: partialLesson?.professor_name || lastLesson?.professor_name || '',
      professor_id: partialLesson?.professor_id ?? lastLesson?.professor_id ?? null,
      lesson_topic_id: partialLesson?.lesson_topic_id ?? lastLesson?.lesson_topic_id ?? null,
      series_name: partialLesson?.series_name || lastLesson?.series_name || '',
      lesson_title: partialLesson?.lesson_title || '',
      time_expected_start: partialLesson?.time_expected_start || '10:00',
      time_real_start: null,
      time_expected_end: partialLesson?.time_expected_end || '11:00',
      time_real_end: null,
      attendance_start: 0,
      attendance_mid: 0,
      attendance_end: 0,
      unique_participants: 0,
      status: LessonStatus.IN_PROGRESS,
      created_at: now,
      client_updated_at: now,
      includes_professor: includesProfessor,
      weather: null,
      notes: null,
      ...partialLesson,
    };

    // FR-017: enforce XOR invariant defensively — catalog id wins, legacy field cleared.
    const newLesson: Lesson = applyWritePathXor(merged);

    await db.runAsync(
      `INSERT INTO lessons_data (
        id, date, coordinator_name, professor_name, professor_id, lesson_topic_id, series_name, lesson_title,
        time_expected_start, time_expected_end, status, created_at, client_updated_at, includes_professor, weather, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newLesson.id,
        newLesson.date,
        newLesson.coordinator_name,
        newLesson.professor_name,
        newLesson.professor_id,
        newLesson.lesson_topic_id,
        newLesson.series_name,
        newLesson.lesson_title,
        newLesson.time_expected_start,
        newLesson.time_expected_end,
        newLesson.status,
        newLesson.created_at,
        newLesson.client_updated_at,
        newLesson.includes_professor ? 1 : 0,
        newLesson.weather,
        newLesson.notes,
      ]
    );

    return newLesson;
  },

  async getLastLesson(): Promise<Lesson | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<Lesson>(
      'SELECT * FROM lessons_data ORDER BY created_at DESC LIMIT 1'
    );
    return result;
  },

  async getById(id: string): Promise<Lesson | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<Lesson>(
      'SELECT * FROM lessons_data WHERE id = ?',
      [id]
    );
    return result;
  },

  async getAllLessons(): Promise<Lesson[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync<Lesson>(
      'SELECT * FROM lessons_data ORDER BY date DESC, created_at DESC'
    );
    return results;
  },

  async updateLesson(id: string, updates: Partial<Lesson>): Promise<void> {
    const db = await getDatabase();

    // FR-017: enforce XOR on every update, not only on create.
    const enforced = applyWritePathXor(updates);

    // FR-016: always touch client_updated_at, even when the caller passes nothing else.
    const withTimestamp: LessonUpdates = {
      ...enforced,
      client_updated_at: new Date().toISOString(),
    };

    // Filter out ID and ensure we have valid keys
    const entries = Object.entries(withTimestamp).filter(([key]) => key !== 'id');

    if (entries.length === 0) return;

    const fields = entries.map(([key]) => key);
    // Explicitly map values and convert undefined to null to avoid native NPE.
    // Booleans are coerced to 0/1 for SQLite INTEGER storage (includes_professor).
    const values = entries.map(([_, value]) => {
      if (value === undefined) return null;
      if (typeof value === 'boolean') return value ? 1 : 0;
      return value;
    });

    const query = `UPDATE lessons_data SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`;
    const params = [...values, id];

    await db.runAsync(query, params);
  },

  async getCompletedLessons(): Promise<Lesson[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync<Lesson>(
      'SELECT * FROM lessons_data WHERE status = ?',
      [LessonStatus.COMPLETED]
    );
    return results;
  },

  /**
   * @deprecated since spec 005 — lessons stay COMPLETED after export.
   * Method kept for schema backwards compatibility and is no longer called from
   * the application code path. May be removed in spec 008 when `sync_status`
   * replaces the legacy `EXPORTED` state.
   */
  async markLessonsAsExported(lessonIds: string[]): Promise<void> {
    if (lessonIds.length === 0) return;

    const db = await getDatabase();
    const placeholders = lessonIds.map(() => '?').join(', ');

    await db.runAsync(
      `UPDATE lessons_data SET status = ? WHERE id IN (${placeholders})`,
      [LessonStatus.EXPORTED, ...lessonIds]
    );
  },

  async getExportedLessons(): Promise<Lesson[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync<Lesson>(
      'SELECT * FROM lessons_data WHERE status = ?',
      [LessonStatus.EXPORTED]
    );
    return results;
  },

  async getByIdWithDetails(id: string): Promise<LessonWithDetails | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<LessonWithDetails>(
      `SELECT
        ld.*,
        lt.title as topic_title,
        lt.series_id as resolved_series_id,
        ls.code as series_code,
        ls.title as series_title,
        p.name as professor_name_resolved
       FROM lessons_data ld
       LEFT JOIN lesson_topics lt ON ld.lesson_topic_id = lt.id
       LEFT JOIN lesson_series ls ON lt.series_id = ls.id
       LEFT JOIN professors p ON ld.professor_id = p.id
       WHERE ld.id = ?`,
      [id]
    );
    return result;
  },

  async getAllLessonsWithDetails(): Promise<LessonWithDetails[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync<LessonWithDetails>(
      `SELECT
        ld.*,
        lt.title as topic_title,
        lt.series_id as resolved_series_id,
        ls.code as series_code,
        ls.title as series_title,
        p.name as professor_name_resolved
       FROM lessons_data ld
       LEFT JOIN lesson_topics lt ON ld.lesson_topic_id = lt.id
       LEFT JOIN lesson_series ls ON lt.series_id = ls.id
       LEFT JOIN professors p ON ld.professor_id = p.id
       ORDER BY ld.date DESC, ld.created_at DESC`
    );
    return results;
  },

  async deleteLesson(id: string): Promise<void> {
    const db = await getDatabase();

    // Validar que a aula existe
    const lesson = await this.getById(id);

    if (!lesson) {
      throw new Error('Aula não encontrada');
    }

    // Validar status - apenas IN_PROGRESS pode ser deletada
    if (lesson.status !== LessonStatus.IN_PROGRESS) {
      throw new Error('Não é possível excluir aulas finalizadas. Apenas aulas em andamento podem ser excluídas.');
    }

    // Hard delete
    await db.runAsync('DELETE FROM lessons_data WHERE id = ?', [id]);
  }
};
