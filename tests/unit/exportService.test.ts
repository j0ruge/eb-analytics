import { LessonStatus, LessonWithDetails } from '../../src/types/lesson';
import { SyncStatus } from '../../src/types/sync';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

jest.mock('uuid', () => {
  let n = 0;
  return {
    v4: jest.fn(() => `test-uuid-${++n}`),
  };
});

jest.mock('react-native-get-random-values', () => ({}));

jest.mock('expo-file-system', () => {
  class FakeFile {
    uri: string;
    written: string | null = null;
    constructor(_dir: unknown, name: string) {
      this.uri = `file://cache/${name}`;
    }
    write(content: string) {
      this.written = content;
    }
  }
  return {
    Paths: { cache: '/cache' },
    File: FakeFile,
  };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '1.0.0' },
  },
}));

jest.mock('../../src/services/lessonService', () => ({
  lessonService: {
    getAllLessonsWithDetails: jest.fn(),
  },
}));

jest.mock('../../src/services/authService', () => ({
  authService: {
    getSession: jest.fn().mockResolvedValue(null),
  },
}));

// Mock AsyncStorage so getDeviceId persists between calls within a test.
// Variable name MUST start with `mock` so Jest allows the reference from the
// jest.mock factory (which is hoisted above the declaration).
const mockAsyncStorageMap: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockAsyncStorageMap[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockAsyncStorageMap[key] = value;
    }),
    removeItem: jest.fn(async (key: string) => {
      delete mockAsyncStorageMap[key];
    }),
  },
}));

import { exportService } from '../../src/services/exportService';
import { lessonService } from '../../src/services/lessonService';
import { authService } from '../../src/services/authService';
import { __resetDeviceIdCache } from '../../src/services/deviceIdService';

// Fixture: a single COMPLETED lesson with catalog professor/topic.
const catalogLesson: LessonWithDetails = {
  id: 'lesson-uuid-1',
  date: '2026-04-11',
  coordinator_name: '',
  professor_name: '', // XOR: catalog path, legacy empty
  professor_id: 'prof-uuid',
  lesson_topic_id: 'topic-uuid',
  series_name: '', // XOR: catalog path, legacy empty
  lesson_title: '',
  time_expected_start: '10:00',
  time_real_start: '10:07',
  time_expected_end: '11:00',
  time_real_end: '11:03',
  attendance_start: 22,
  attendance_mid: 28,
  attendance_end: 25,
  unique_participants: 31,
  status: LessonStatus.COMPLETED,
  created_at: '2026-04-11T13:05:00.000Z',
  client_updated_at: '2026-04-11T13:18:42.456Z',
  includes_professor: false,
  weather: 'Ensolarado 28°C',
  notes: 'Tudo ok',
  collector_user_id: null,
  // Spec 008 — sync state defaults (LOCAL row never sent).
  sync_status: SyncStatus.LOCAL,
  sync_error: null,
  sync_attempt_count: 0,
  sync_next_attempt_at: null,
  synced_at: null,
  topic_title: 'Inveja',
  series_code: 'Eb356',
  series_title: 'Série EB356',
  professor_name_resolved: 'Alex Tolomei',
  resolved_series_id: 'series-uuid',
};

const freeTextLesson: LessonWithDetails = {
  ...catalogLesson,
  id: 'lesson-uuid-2',
  professor_id: null,
  professor_name: 'Jefferson Pedro',
  lesson_topic_id: null,
  lesson_title: 'A Graça',
  series_name: 'Eb356',
  resolved_series_id: null,
  professor_name_resolved: null,
  topic_title: '',
};

describe('exportService v2 envelope', () => {
  beforeEach(() => {
    // Clear the map object keys (cannot reassign a const).
    for (const k of Object.keys(mockAsyncStorageMap)) delete mockAsyncStorageMap[k];
    __resetDeviceIdCache();
    (lessonService.getAllLessonsWithDetails as jest.Mock).mockReset();
    (authService.getSession as jest.Mock).mockReset().mockResolvedValue(null);
  });

  // ==================================================================
  // Envelope shape (FR-001, FR-002, FR-010, FR-010a, FR-011)
  // ==================================================================
  describe('envelope shape', () => {
    it('builds a v2 envelope with schema_version "2.0", collector null, and client info', async () => {
      (lessonService.getAllLessonsWithDetails as jest.Mock).mockResolvedValue([catalogLesson]);

      const envelope = await exportService.__buildEnvelopeForTest();

      expect(envelope.schema_version).toBe('2.0');
      expect(envelope.collector).toBeNull();
      expect(envelope.client).toBeDefined();
      expect(envelope.client.app_version).toBe('1.0.0');
      expect(envelope.client.device_id).toMatch(/^test-uuid-\d+$/);
      expect(envelope.exported_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(envelope.collections).toHaveLength(1);
    });

    it('excludes IN_PROGRESS lessons from the export (FR-005)', async () => {
      const inProgressLesson: LessonWithDetails = {
        ...catalogLesson,
        id: 'lesson-uuid-draft',
        status: LessonStatus.IN_PROGRESS,
      };
      (lessonService.getAllLessonsWithDetails as jest.Mock).mockResolvedValue([
        catalogLesson,
        inProgressLesson,
      ]);

      const envelope = await exportService.__buildEnvelopeForTest();

      expect(envelope.collections).toHaveLength(1);
      expect(envelope.collections[0].id).toBe('lesson-uuid-1');
    });

    it('falls back to "unknown" when expoConfig.version is missing', async () => {
      // Override the mock for this single test
      const expoConstants = require('expo-constants').default;
      const originalVersion = expoConstants.expoConfig.version;
      expoConstants.expoConfig.version = undefined;

      (lessonService.getAllLessonsWithDetails as jest.Mock).mockResolvedValue([catalogLesson]);

      const envelope = await exportService.__buildEnvelopeForTest();
      expect(envelope.client.app_version).toBe('unknown');

      expoConstants.expoConfig.version = originalVersion;
    });
  });

  // ==================================================================
  // FR-008: empty guard
  // ==================================================================
  describe('empty guard', () => {
    it('throws when zero completed lessons exist', async () => {
      (lessonService.getAllLessonsWithDetails as jest.Mock).mockResolvedValue([]);

      await expect(exportService.__buildEnvelopeForTest()).rejects.toThrow(
        'Não há aulas finalizadas para exportar.',
      );
    });

    it('throws when only IN_PROGRESS lessons exist (no COMPLETED)', async () => {
      const draft: LessonWithDetails = {
        ...catalogLesson,
        status: LessonStatus.IN_PROGRESS,
      };
      (lessonService.getAllLessonsWithDetails as jest.Mock).mockResolvedValue([draft]);

      await expect(exportService.__buildEnvelopeForTest()).rejects.toThrow(/Não há aulas finalizadas/);
    });
  });

  // ==================================================================
  // SC-006: stable IDs on re-export
  // ==================================================================
  describe('stable re-export (SC-006)', () => {
    it('re-exporting the same completed lesson twice produces identical collection ids and timestamps', async () => {
      (lessonService.getAllLessonsWithDetails as jest.Mock).mockResolvedValue([catalogLesson]);

      const first = await exportService.__buildEnvelopeForTest();
      const second = await exportService.__buildEnvelopeForTest();

      expect(first.collections[0].id).toBe(second.collections[0].id);
      expect(first.collections[0].client_created_at).toBe(second.collections[0].client_created_at);
      expect(first.collections[0].client_updated_at).toBe(second.collections[0].client_updated_at);
    });

    it('device_id is persisted across calls (AsyncStorage cache hit)', async () => {
      (lessonService.getAllLessonsWithDetails as jest.Mock).mockResolvedValue([catalogLesson]);

      const first = await exportService.__buildEnvelopeForTest();
      const second = await exportService.__buildEnvelopeForTest();

      expect(first.client.device_id).toBe(second.client.device_id);
      // Verify AsyncStorage was written on first call
      expect(mockAsyncStorageMap['@eb-insights/device-id']).toBe(first.client.device_id);
    });
  });

  // ==================================================================
  // T013: XOR emission (FR-009, FR-009a, FR-017)
  // ==================================================================
  describe('XOR emission', () => {
    it('catalog professor path: professor_id set, professor_name_fallback null', async () => {
      (lessonService.getAllLessonsWithDetails as jest.Mock).mockResolvedValue([catalogLesson]);

      const envelope = await exportService.__buildEnvelopeForTest();
      const inst = envelope.collections[0].lesson_instance;

      expect(inst.professor_id).toBe('prof-uuid');
      expect(inst.professor_name_fallback).toBeNull();
    });

    it('free-text professor path: professor_id null, professor_name_fallback populated', async () => {
      (lessonService.getAllLessonsWithDetails as jest.Mock).mockResolvedValue([freeTextLesson]);

      const envelope = await exportService.__buildEnvelopeForTest();
      const inst = envelope.collections[0].lesson_instance;

      expect(inst.professor_id).toBeNull();
      expect(inst.professor_name_fallback).toBe('Jefferson Pedro');
    });

    it('catalog topic path: topic_id + series_id resolved via JOIN, both fallbacks null', async () => {
      (lessonService.getAllLessonsWithDetails as jest.Mock).mockResolvedValue([catalogLesson]);

      const envelope = await exportService.__buildEnvelopeForTest();
      const inst = envelope.collections[0].lesson_instance;

      expect(inst.topic_id).toBe('topic-uuid');
      expect(inst.topic_title_fallback).toBeNull();
      expect(inst.series_id).toBe('series-uuid');
      expect(inst.series_code_fallback).toBeNull();
    });

    it('free-text topic path: topic_id and series_id null, both fallbacks populated from legacy columns', async () => {
      (lessonService.getAllLessonsWithDetails as jest.Mock).mockResolvedValue([freeTextLesson]);

      const envelope = await exportService.__buildEnvelopeForTest();
      const inst = envelope.collections[0].lesson_instance;

      expect(inst.topic_id).toBeNull();
      expect(inst.topic_title_fallback).toBe('A Graça');
      expect(inst.series_id).toBeNull();
      expect(inst.series_code_fallback).toBe('Eb356');
    });
  });

  // ==================================================================
  // SC-002: v1 feature parity (weather + notes round-trip, empty → null)
  // ==================================================================
  describe('feature parity & empty-string coercion', () => {
    it('weather and notes are emitted verbatim when populated', async () => {
      (lessonService.getAllLessonsWithDetails as jest.Mock).mockResolvedValue([catalogLesson]);

      const envelope = await exportService.__buildEnvelopeForTest();
      const col = envelope.collections[0];

      expect(col.weather).toBe('Ensolarado 28°C');
      expect(col.notes).toBe('Tudo ok');
    });

    it('empty strings in weather/notes are coerced to null', async () => {
      const lessonWithEmpty: LessonWithDetails = {
        ...catalogLesson,
        weather: '',
        notes: '',
      };
      (lessonService.getAllLessonsWithDetails as jest.Mock).mockResolvedValue([lessonWithEmpty]);

      const envelope = await exportService.__buildEnvelopeForTest();
      const col = envelope.collections[0];

      expect(col.weather).toBeNull();
      expect(col.notes).toBeNull();
    });

    it('every v1 field maps into v2 without information loss', async () => {
      (lessonService.getAllLessonsWithDetails as jest.Mock).mockResolvedValue([catalogLesson]);

      const envelope = await exportService.__buildEnvelopeForTest();
      const col = envelope.collections[0];

      expect(col.id).toBe(catalogLesson.id);
      expect(col.client_created_at).toBe(catalogLesson.created_at);
      expect(col.client_updated_at).toBe(catalogLesson.client_updated_at);
      expect(col.status).toBe('COMPLETED');
      expect(col.lesson_instance.date).toBe(catalogLesson.date);
      expect(col.times.expected_start).toBe('10:00');
      expect(col.times.expected_end).toBe('11:00');
      expect(col.times.real_start).toBe('10:07');
      expect(col.times.real_end).toBe('11:03');
      expect(col.attendance.start).toBe(22);
      expect(col.attendance.mid).toBe(28);
      expect(col.attendance.end).toBe(25);
      expect(col.attendance.includes_professor).toBe(false);
      expect(col.unique_participants).toBe(31);
    });
  });

  // ==================================================================
  // includes_professor int → boolean coercion (SQLite stores as 0/1)
  // ==================================================================
  describe('includes_professor coercion', () => {
    it('integer 1 from SQLite becomes boolean true in payload', async () => {
      const lessonWithInclude: LessonWithDetails = {
        ...catalogLesson,
        includes_professor: 1 as unknown as boolean, // SQLite returns integer
      };
      (lessonService.getAllLessonsWithDetails as jest.Mock).mockResolvedValue([lessonWithInclude]);

      const envelope = await exportService.__buildEnvelopeForTest();
      expect(envelope.collections[0].attendance.includes_professor).toBe(true);
    });

    it('integer 0 from SQLite becomes boolean false', async () => {
      const lessonWithExclude: LessonWithDetails = {
        ...catalogLesson,
        includes_professor: 0 as unknown as boolean,
      };
      (lessonService.getAllLessonsWithDetails as jest.Mock).mockResolvedValue([lessonWithExclude]);

      const envelope = await exportService.__buildEnvelopeForTest();
      expect(envelope.collections[0].attendance.includes_professor).toBe(false);
    });
  });

  // ==================================================================
  // Collector identity (006 FR-009)
  // ==================================================================
  describe('collector identity', () => {
    it('collector is null when no user is logged in', async () => {
      (lessonService.getAllLessonsWithDetails as jest.Mock).mockResolvedValue([catalogLesson]);
      (authService.getSession as jest.Mock).mockResolvedValue(null);

      const envelope = await exportService.__buildEnvelopeForTest();
      expect(envelope.collector).toBeNull();
    });

    it('collector includes user_id and display_name when logged in', async () => {
      (lessonService.getAllLessonsWithDetails as jest.Mock).mockResolvedValue([catalogLesson]);
      (authService.getSession as jest.Mock).mockResolvedValue({
        jwt: 'fake-jwt',
        user: {
          id: 'user-uuid-1',
          email: 'test@example.com',
          display_name: 'Test User',
          role: 'COLLECTOR',
          accepted: true,
          created_at: '2026-04-12T00:00:00.000Z',
        },
      });

      const envelope = await exportService.__buildEnvelopeForTest();
      expect(envelope.collector).toEqual({
        user_id: 'user-uuid-1',
        display_name: 'Test User',
      });
    });
  });
});
