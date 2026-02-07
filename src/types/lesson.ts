export enum LessonStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  EXPORTED = 'EXPORTED',
  SYNCED = 'SYNCED',
}

export interface Lesson {
  id: string;
  date: string; // ISO 8601 YYYY-MM-DD
  coordinator_name: string;
  professor_name: string; // DEPRECATED: Use professor_id instead
  professor_id: string | null;
  lesson_topic_id: string | null; // FK to lesson_topics.id
  series_name: string; // DEPRECATED: Use lesson_topic_id instead
  lesson_title: string; // DEPRECATED: Use lesson_topic_id instead
  time_expected_start: string; // HH:MM
  time_real_start: string | null;
  time_expected_end: string; // HH:MM
  time_real_end: string | null;
  attendance_start: number;
  attendance_mid: number;
  attendance_end: number;
  unique_participants: number;
  status: LessonStatus;
  created_at: string;
}

// Tipo expandido para exibição (com JOINs)
export interface LessonWithDetails extends Lesson {
  topic_title: string;
  series_code: string;
  series_title: string;
  professor_name_resolved: string | null;
}
