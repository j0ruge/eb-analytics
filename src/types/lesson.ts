export enum LessonStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  SYNCED = 'SYNCED',
}

export interface Lesson {
  id: string;
  date: string; // ISO 8601 YYYY-MM-DD
  coordinator_name: string;
  professor_name: string;
  series_name: string;
  lesson_title: string;
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
