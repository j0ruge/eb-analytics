import type { Page } from '@playwright/test';

/**
 * Waits for the dev-only E2E harness (`window.__e2e`) to be registered.
 * The harness is installed in `app/_layout.tsx` after DB initialization.
 * Call after the first `page.goto(...)` so the app has had time to boot.
 */
export async function waitForHarness(page: Page, timeoutMs = 15_000): Promise<void> {
  await page.waitForFunction(
    () => Boolean((window as unknown as { __e2e?: unknown }).__e2e),
    null,
    { timeout: timeoutMs },
  );
}

export interface PrimeCatalogOptions {
  seriesId?: string;
  seriesCode?: string;
  topicId?: string;
  topicTitle?: string;
  professorId?: string;
  professorName?: string;
  professorDocId?: string;
}

/**
 * Insert a minimal catalog (one series, one topic, one professor) using the
 * harness-exposed database handle. Guarantees foreign-key targets exist for
 * subsequent `createLesson` calls.
 */
export async function primeMinimalCatalog(
  page: Page,
  options: PrimeCatalogOptions = {},
): Promise<Required<PrimeCatalogOptions>> {
  const defaults: Required<PrimeCatalogOptions> = {
    seriesId: options.seriesId ?? 'e2e-series-1',
    seriesCode: options.seriesCode ?? 'Eb999',
    topicId: options.topicId ?? 'e2e-topic-1',
    topicTitle: options.topicTitle ?? 'E2E Topic',
    professorId: options.professorId ?? 'e2e-prof-1',
    professorName: options.professorName ?? 'E2E Professor',
    professorDocId: options.professorDocId ?? 'e2e-prof-1',
  };

  await page.evaluate(async (c) => {
    const h = (window as unknown as { __e2e: { getDatabase: () => Promise<unknown> } }).__e2e;
    const db = (await h.getDatabase()) as {
      runAsync: (sql: string, params: unknown[]) => Promise<unknown>;
    };
    await db.runAsync(
      `INSERT OR IGNORE INTO lesson_series (id, code, title, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [c.seriesId, c.seriesCode, 'Série E2E', null, new Date().toISOString(), new Date().toISOString()],
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO lesson_topics (id, series_id, title, sequence_order, suggested_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [c.topicId, c.seriesId, c.topicTitle, 1, null, new Date().toISOString(), new Date().toISOString()],
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO professors (id, doc_id, name, email, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [c.professorId, c.professorDocId, c.professorName, null, new Date().toISOString(), new Date().toISOString()],
    );
  }, defaults);

  return defaults;
}

export interface PrimeLessonOptions {
  id?: string;
  series_id?: string | null;
  lesson_topic_id?: string | null;
  professor_id?: string | null;
  lesson_title?: string;
  status?: 'IN_PROGRESS' | 'COMPLETED' | 'EXPORTED';
  sync_status?: 'LOCAL' | 'QUEUED' | 'SENDING' | 'SYNCED' | 'REJECTED';
  collector_user_id?: string | null;
}

/**
 * Creates a completed lesson row directly in SQLite via the harness. Returns
 * the new lesson id. All FK targets must already exist (see primeMinimalCatalog).
 */
export async function primeCompletedLesson(
  page: Page,
  options: PrimeLessonOptions = {},
): Promise<string> {
  return page.evaluate(async (opts) => {
    const h = (window as unknown as {
      __e2e: {
        lessonService: {
          createLesson: (partial: unknown, collectorUserId?: string | null) => Promise<{ id: string }>;
          completeLesson: (id: string) => Promise<void>;
        };
        getDatabase: () => Promise<unknown>;
      };
    }).__e2e;

    const created = await h.lessonService.createLesson(
      {
        series_name: 'Eb999',
        series_id: opts.series_id ?? null,
        lesson_topic_id: opts.lesson_topic_id ?? null,
        professor_id: opts.professor_id ?? null,
        lesson_title: opts.lesson_title ?? 'E2E Lesson',
        time_expected_start: '10:00',
        time_expected_end: '11:00',
      },
      opts.collector_user_id ?? null,
    );

    // Force desired status / sync_status directly — createLesson always
    // starts at IN_PROGRESS + LOCAL.
    const db = (await h.getDatabase()) as {
      runAsync: (sql: string, params: unknown[]) => Promise<unknown>;
    };
    await db.runAsync(
      `UPDATE lessons_data SET status = ?, sync_status = ? WHERE id = ?`,
      [opts.status ?? 'COMPLETED', opts.sync_status ?? 'LOCAL', created.id],
    );

    return created.id;
  }, options);
}

/**
 * Returns current pending count + first lesson sync_status, for assertions
 * that don't need full UI state.
 */
export async function getHarnessState(
  page: Page,
  userId: string,
): Promise<{ pending: number; lessons: Array<{ id: string; sync_status: string }> }> {
  return page.evaluate(async (uid) => {
    const h = (window as unknown as {
      __e2e: {
        syncService: { countPending: (u: string) => Promise<number> };
        getDatabase: () => Promise<unknown>;
      };
    }).__e2e;
    const pending = await h.syncService.countPending(uid);
    const db = (await h.getDatabase()) as {
      getAllAsync: (sql: string, params: unknown[]) => Promise<Array<{ id: string; sync_status: string }>>;
    };
    const lessons = await db.getAllAsync(
      'SELECT id, sync_status FROM lessons_data ORDER BY created_at DESC',
      [],
    );
    return { pending, lessons };
  }, userId);
}
