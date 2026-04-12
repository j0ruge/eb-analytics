import { Paths, File } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import Constants from 'expo-constants';
import { lessonService } from './lessonService';
import { getDeviceId } from './deviceIdService';
import { LessonStatus, LessonWithDetails } from '../types/lesson';

// ============================================================================
// v2 envelope types — private to this service. See
// specs/005-export-contract-v2/data-model.md and
// specs/005-export-contract-v2/contracts/export-envelope.v2.schema.json.
// ============================================================================

interface ClientInfo {
  app_version: string;
  device_id: string;
}

interface LessonInstanceRef {
  date: string;
  series_id: string | null;
  series_code_fallback: string | null;
  topic_id: string | null;
  topic_title_fallback: string | null;
  professor_id: string | null;
  professor_name_fallback: string | null;
}

interface TimesBlock {
  expected_start: string;
  expected_end: string;
  real_start: string | null;
  real_end: string | null;
}

interface AttendanceBlock {
  start: number;
  mid: number;
  end: number;
  includes_professor: boolean;
}

interface CollectionSubmission {
  id: string;
  client_created_at: string;
  client_updated_at: string;
  status: 'COMPLETED';
  lesson_instance: LessonInstanceRef;
  times: TimesBlock;
  attendance: AttendanceBlock;
  unique_participants: number;
  weather: string | null;
  notes: string | null;
}

interface ExportEnvelopeV2 {
  schema_version: '2.0';
  client: ClientInfo;
  collector: null;
  exported_at: string;
  collections: CollectionSubmission[];
}

// ============================================================================
// Helpers
// ============================================================================

function emptyToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (value === '') return null;
  return value;
}

function toBoolean(value: unknown): boolean {
  // SQLite stores booleans as 0/1 integers.
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value === 'true' || value === '1';
  return false;
}

// FR-009/FR-009a: resolve the XOR for topic / series / professor at emit time.
// The write-path (lessonService) already keeps the invariant on disk; this
// function trusts that and picks the non-empty branch defensively.
function buildLessonInstance(row: LessonWithDetails): LessonInstanceRef {
  const hasTopic = row.lesson_topic_id !== null && row.lesson_topic_id !== undefined;

  const topic_id = hasTopic ? row.lesson_topic_id : null;
  const topic_title_fallback = hasTopic ? null : emptyToNull(row.lesson_title);

  // Series is derived from lesson_topics.series_id via LEFT JOIN.
  // When the topic is in the catalog, series_id comes from the JOIN alias.
  // When the topic is free-text, series falls back to the legacy series_name.
  const series_id = hasTopic ? row.resolved_series_id ?? null : null;
  const series_code_fallback = hasTopic ? null : emptyToNull(row.series_name);

  const hasProfessor = row.professor_id !== null && row.professor_id !== undefined;
  const professor_id = hasProfessor ? row.professor_id : null;
  const professor_name_fallback = hasProfessor ? null : emptyToNull(row.professor_name);

  return {
    date: row.date,
    series_id,
    series_code_fallback,
    topic_id,
    topic_title_fallback,
    professor_id,
    professor_name_fallback,
  };
}

function buildCollection(row: LessonWithDetails): CollectionSubmission {
  return {
    id: row.id,
    client_created_at: row.created_at,
    client_updated_at: row.client_updated_at ?? row.created_at,
    status: 'COMPLETED',
    lesson_instance: buildLessonInstance(row),
    times: {
      expected_start: row.time_expected_start,
      expected_end: row.time_expected_end,
      real_start: row.time_real_start,
      real_end: row.time_real_end,
    },
    attendance: {
      start: row.attendance_start,
      mid: row.attendance_mid,
      end: row.attendance_end,
      includes_professor: toBoolean(row.includes_professor),
    },
    unique_participants: row.unique_participants,
    weather: emptyToNull(row.weather),
    notes: emptyToNull(row.notes),
  };
}

// Internal: assemble the envelope. Exported for unit tests via
// `__buildEnvelopeForTest` so the test does not have to stub expo-sharing.
async function buildEnvelope(): Promise<ExportEnvelopeV2> {
  const allLessons = await lessonService.getAllLessonsWithDetails();
  const completed = allLessons.filter((l) => l.status === LessonStatus.COMPLETED);

  if (completed.length === 0) {
    throw new Error('Não há aulas finalizadas para exportar.');
  }

  const envelope: ExportEnvelopeV2 = {
    schema_version: '2.0',
    client: {
      app_version: Constants.expoConfig?.version ?? 'unknown',
      device_id: await getDeviceId(),
    },
    collector: null,
    exported_at: new Date().toISOString(),
    collections: completed.map(buildCollection),
  };

  return envelope;
}

export const exportService = {
  async exportData(): Promise<boolean> {
    try {
      const envelope = await buildEnvelope();

      const ts = new Date().toISOString().replace(/[:.]/g, '-').split('Z')[0];
      const fileName = `EBD_Export_${ts}.json`;
      const file = new File(Paths.cache, fileName);
      file.write(JSON.stringify(envelope, null, 2));

      if (!(await isAvailableAsync())) {
        throw new Error('Sharing is not available on this device.');
      }

      await shareAsync(file.uri);
      return true;
    } catch (error) {
      console.error('Export Error:', error);
      throw error;
    }
  },

  // Exported for unit tests (SC-002, SC-006 validation).
  __buildEnvelopeForTest: buildEnvelope,
};
