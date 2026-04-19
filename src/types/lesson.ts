import { SyncStatus } from './sync';

export enum LessonStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  // EXPORTED: legacy — preserved for backwards compatibility with rows created before
  // spec 005. No longer written by application code. Spec 008 keeps both columns
  // side by side (FR-005): `status` (LessonStatus) is the UX lifecycle; `sync_status`
  // (SyncStatus) is the cloud-sync state. They are written independently.
  EXPORTED = 'EXPORTED',
  SYNCED = 'SYNCED',
}

export const STATUS_LABELS: Record<LessonStatus, string> = {
  [LessonStatus.IN_PROGRESS]: 'Em Andamento',
  [LessonStatus.COMPLETED]: 'Completa',
  [LessonStatus.EXPORTED]: 'Exportada',
  [LessonStatus.SYNCED]: 'Sincronizada',
};

export interface Lesson {
  id: string;
  date: string; // ISO 8601 YYYY-MM-DD
  coordinator_name: string;
  professor_name: string; // Legacy free-text fallback; enforced empty when professor_id is set (FR-017)
  professor_id: string | null;
  lesson_topic_id: string | null; // FK to lesson_topics.id
  series_name: string; // Legacy free-text fallback; enforced empty when lesson_topic_id is set (FR-017)
  lesson_title: string; // Legacy free-text fallback; enforced empty when lesson_topic_id is set (FR-017)
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
  client_updated_at: string | null; // ISO 8601 UTC, ms precision; touched by lessonService.updateLesson on every call (FR-016)
  includes_professor: boolean; // Whether attendance counters include the professor (FR-004, FR-019)
  weather: string | null; // Free-text weather note; null when empty (FR-020)
  notes: string | null; // Free-text general notes; null when empty (FR-020)
  collector_user_id: string | null; // Authenticated user who created this lesson (spec 006 FR-006); null = anonymous
  // Spec 008 — Offline-first sync state. See specs/008-offline-sync-client/data-model.md §1.
  sync_status: SyncStatus;
  sync_error: string | null;
  sync_attempt_count: number;
  sync_next_attempt_at: string | null; // ISO 8601 — next retry time
  synced_at: string | null; // ISO 8601 — timestamp of SENDING→SYNCED transition, set once
}

// Tipo expandido para exibição (com JOINs)
export interface LessonWithDetails extends Lesson {
  topic_title: string;
  series_code: string;
  series_title: string;
  professor_name_resolved: string | null;
  resolved_series_id: string | null; // Series UUID resolved via LEFT JOIN lesson_topics.series_id; used by exportService (FR-009a)
}
