import { getDatabase } from '../db/client';
import { Lesson, LessonStatus } from '../types/lesson';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export const lessonService = {
  async createLesson(partialLesson?: Partial<Lesson>): Promise<Lesson> {
    const db = await getDatabase();
    
    // T011: Smart Defaults - Fetch last lesson to pre-fill metadata
    const lastLesson = await this.getLastLesson();
    
    const newLesson: Lesson = {
      id: uuidv4(),
      date: new Date().toISOString().split('T')[0],
      coordinator_name: partialLesson?.coordinator_name || lastLesson?.coordinator_name || '',
      professor_name: partialLesson?.professor_name || lastLesson?.professor_name || '',
      professor_id: partialLesson?.professor_id || lastLesson?.professor_id || null,
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
      created_at: new Date().toISOString(),
      ...partialLesson,
    };

    await db.runAsync(
      `INSERT INTO lessons_data (
        id, date, coordinator_name, professor_name, professor_id, series_name, lesson_title,
        time_expected_start, time_expected_end, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newLesson.id,
        newLesson.date,
        newLesson.coordinator_name,
        newLesson.professor_name,
        newLesson.professor_id,
        newLesson.series_name,
        newLesson.lesson_title,
        newLesson.time_expected_start,
        newLesson.time_expected_end,
        newLesson.status,
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
    
    // Filter out ID and ensure we have valid keys
    const entries = Object.entries(updates).filter(([key]) => key !== 'id');
    
    if (entries.length === 0) return;

    const fields = entries.map(([key]) => key);
    // Explicitly map values and convert undefined to null to avoid native NPE
    const values = entries.map(([_, value]) => value === undefined ? null : value);

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
  }
};
