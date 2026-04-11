import { getDatabase } from '../db/client';
import { LessonStatus } from '../types/lesson';
import seedData from '../data/seed-collections.json';

export interface SeedResult {
  skipped: boolean;
  reason?: string;
  series: number;
  topics: number;
  professors: number;
  lessons: number;
}

interface SeedCatalog {
  series: Array<{ id: string; code: string; title: string; description: string | null }>;
  topics: Array<{
    id: string;
    series_id: string;
    title: string;
    sequence_order: number;
    suggested_date: string | null;
  }>;
  professors: Array<{ id: string; doc_id: string; name: string }>;
}

interface SeedCollection {
  id: string;
  client_created_at: string;
  status: string;
  lesson_instance: {
    date: string;
    series_id: string | null;
    topic_id: string | null;
    professor_id: string | null;
  };
  times: {
    expected_start: string;
    expected_end: string;
    real_start: string | null;
    real_end: string | null;
  };
  attendance: {
    start: number;
    mid: number;
    end: number;
    includes_professor: boolean;
  };
  unique_participants: number;
  notes: string | null;
}

interface SeedPayload {
  schema_version: string;
  catalog: SeedCatalog;
  collections: SeedCollection[];
}

function assertSeedPayload(data: unknown): asserts data is SeedPayload {
  if (typeof data !== 'object' || data === null) {
    throw new Error('seed-collections.json: invalid root (expected object)');
  }
  const p = data as Record<string, unknown>;
  if (p.schema_version !== '2.0') {
    throw new Error(
      `seed-collections.json: unsupported schema_version ${String(p.schema_version)} (expected "2.0")`,
    );
  }
  if (typeof p.catalog !== 'object' || p.catalog === null) {
    throw new Error('seed-collections.json: missing catalog');
  }
  if (!Array.isArray(p.collections)) {
    throw new Error('seed-collections.json: collections must be an array');
  }
}

/**
 * Dev-time service to populate the local SQLite with a curated snapshot
 * of real collection data. Idempotent via deterministic IDs + INSERT OR IGNORE.
 *
 * Runs raw SQL instead of the service layer because:
 * - professorService.createProfessor() validates CPF (seed uses placeholder doc_ids).
 * - lessonService.createLesson() hardcodes status=IN_PROGRESS and date=today.
 */
export const seedService = {
  async seed(): Promise<SeedResult> {
    const db = await getDatabase();
    assertSeedPayload(seedData);
    const payload = seedData;

    const existing = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM lessons_data WHERE id LIKE 'seed-col-%'",
    );
    if (existing && existing.count > 0) {
      return {
        skipped: true,
        reason: `Seed já aplicado (${existing.count} lições seed encontradas).`,
        series: 0,
        topics: 0,
        professors: 0,
        lessons: 0,
      };
    }

    let seriesCount = 0;
    let topicsCount = 0;
    let profsCount = 0;
    let lessonsCount = 0;
    const seedTimestamp = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      for (const s of payload.catalog.series) {
        const res = await db.runAsync(
          `INSERT OR IGNORE INTO lesson_series (id, code, title, description, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [s.id, s.code, s.title, s.description, seedTimestamp],
        );
        // INSERT OR IGNORE reports changes=0 when a row with the same PK already existed.
        if (res.changes > 0) seriesCount++;
      }

      for (const t of payload.catalog.topics) {
        const res = await db.runAsync(
          `INSERT OR IGNORE INTO lesson_topics (id, series_id, title, sequence_order, suggested_date, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [t.id, t.series_id, t.title, t.sequence_order, t.suggested_date, seedTimestamp],
        );
        if (res.changes > 0) topicsCount++;
      }

      for (const p of payload.catalog.professors) {
        const res = await db.runAsync(
          `INSERT OR IGNORE INTO professors (id, doc_id, name, created_at)
           VALUES (?, ?, ?, ?)`,
          [p.id, p.doc_id, p.name, seedTimestamp],
        );
        if (res.changes > 0) profsCount++;
      }

      const profIdToName = new Map(payload.catalog.professors.map((p) => [p.id, p.name]));
      const seriesIdToCode = new Map(payload.catalog.series.map((s) => [s.id, s.code]));
      const topicIdToTitle = new Map(payload.catalog.topics.map((t) => [t.id, t.title]));

      for (const c of payload.collections) {
        const inst = c.lesson_instance;
        const professorName = inst.professor_id ? profIdToName.get(inst.professor_id) ?? '' : '';
        const seriesCode = inst.series_id ? seriesIdToCode.get(inst.series_id) ?? '' : '';
        const topicTitle = inst.topic_id ? topicIdToTitle.get(inst.topic_id) ?? '' : '';

        const lessonTitle = c.attendance.includes_professor
          ? `${topicTitle} [inclui prof]`
          : topicTitle;

        const res = await db.runAsync(
          `INSERT OR IGNORE INTO lessons_data (
            id, date, coordinator_name, professor_name, professor_id, lesson_topic_id,
            series_name, lesson_title,
            time_expected_start, time_real_start, time_expected_end, time_real_end,
            attendance_start, attendance_mid, attendance_end, unique_participants,
            status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            c.id,
            inst.date,
            '',
            professorName,
            inst.professor_id,
            inst.topic_id,
            seriesCode,
            lessonTitle,
            c.times.expected_start,
            c.times.real_start,
            c.times.expected_end,
            c.times.real_end,
            c.attendance.start,
            c.attendance.mid,
            c.attendance.end,
            c.unique_participants,
            LessonStatus.COMPLETED,
            c.client_created_at,
          ],
        );
        if (res.changes > 0) lessonsCount++;
      }
    });

    return {
      skipped: false,
      series: seriesCount,
      topics: topicsCount,
      professors: profsCount,
      lessons: lessonsCount,
    };
  },

  // Deletes only rows created by seed() — relies on the deterministic `seed-*` id prefix.
  async clearSeed(): Promise<{ lessons: number; topics: number; series: number; professors: number }> {
    const db = await getDatabase();
    let lessons = 0;
    let topics = 0;
    let series = 0;
    let professors = 0;

    await db.withTransactionAsync(async () => {
      const l = await db.runAsync("DELETE FROM lessons_data WHERE id LIKE 'seed-col-%'");
      lessons = l.changes;
      const t = await db.runAsync("DELETE FROM lesson_topics WHERE id LIKE 'seed-top-%'");
      topics = t.changes;
      const s = await db.runAsync("DELETE FROM lesson_series WHERE id LIKE 'seed-srs-%'");
      series = s.changes;
      const p = await db.runAsync("DELETE FROM professors WHERE id LIKE 'seed-prof-%'");
      professors = p.changes;
    });

    return { lessons, topics, series, professors };
  },
};
