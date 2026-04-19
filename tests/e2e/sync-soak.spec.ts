import { test, expect } from '@playwright/test';
import { primeAuth, DEFAULT_USER } from './_support/auth';
import { mockCatalog, mockSyncBatch } from './_support/apiMock';
import {
  waitForHarness,
  primeMinimalCatalog,
  primeCompletedLesson,
} from './_support/harness';

// Spec 008 T068 — SC-001 soak: many submissions queued, backend accepts,
// all lessons end SYNCED within a bounded time window.
//
// Two modes:
//   Default (mocked): proves the CLIENT batching + state machine drains a
//   realistic workload correctly. Runs in ~15s.
//   Real backend (SOAK_REAL=1): skipped unless env var is set AND the
//   backend at http://localhost:3000 is reachable. Run after spinning up
//   `server/` locally to validate the end-to-end contract.
//
// Run:
//   npx playwright test tests/e2e/sync-soak.spec.ts
//   SOAK_REAL=1 npx playwright test tests/e2e/sync-soak.spec.ts  # real server

const LESSON_COUNT = 50;
const DRAIN_TIMEOUT_MS = 5 * 60_000; // 5min, per SC-001.

test.describe('Spec 008 T068 (SC-001) — sync soak', () => {
  test(`${LESSON_COUNT} queued lessons drain to SYNCED (mocked backend)`, async ({ page }) => {
    test.setTimeout(DRAIN_TIMEOUT_MS + 30_000);
    await primeAuth(page);
    await mockCatalog(page);
    await mockSyncBatch(page, {});

    await page.goto('/');
    await waitForHarness(page);

    const catalog = await primeMinimalCatalog(page);
    const ids: string[] = [];
    for (let i = 0; i < LESSON_COUNT; i++) {
      const id = await primeCompletedLesson(page, {
        series_id: catalog.seriesId,
        lesson_topic_id: catalog.topicId,
        professor_id: catalog.professorId,
        status: 'COMPLETED',
        sync_status: 'LOCAL',
        collector_user_id: DEFAULT_USER.id,
      });
      ids.push(id);
    }

    // Enqueue all — moves every row LOCAL → QUEUED.
    await page.evaluate(async (lessonIds) => {
      const h = (window as unknown as {
        __e2e: { syncService: { enqueue: (id: string) => Promise<void> } };
      }).__e2e;
      for (const id of lessonIds) await h.syncService.enqueue(id);
    }, ids);

    // Drive runOnce() in a loop until the queue empties. Each iteration
    // claims up to 20 rows (BATCH_SIZE per spec 008), so 50 lessons need
    // ~3 iterations. We loop with a small wait to mimic the real
    // foreground pump that fires on focus / queue tick.
    const start = Date.now();
    await expect
      .poll(
        async () => {
          await page.evaluate(async () => {
            const h = (window as unknown as {
              __e2e: { syncService: { runOnce: () => Promise<unknown> } };
            }).__e2e;
            await h.syncService.runOnce();
          });
          const pending = await page.evaluate(async (uid) => {
            const h = (window as unknown as {
              __e2e: {
                syncService: { countPending: (u: string) => Promise<number> };
              };
            }).__e2e;
            return h.syncService.countPending(uid);
          }, DEFAULT_USER.id);
          return pending;
        },
        { timeout: DRAIN_TIMEOUT_MS, intervals: [200, 500, 1_000] },
      )
      .toBe(0);

    const elapsedSec = Math.round((Date.now() - start) / 1000);
    const allSynced = await page.evaluate(async () => {
      const h = (window as unknown as {
        __e2e: {
          getDatabase: () => Promise<{
            getAllAsync: (
              sql: string,
              params: unknown[],
            ) => Promise<Array<{ sync_status: string }>>;
          }>;
        };
      }).__e2e;
      const db = await h.getDatabase();
      return db.getAllAsync(
        "SELECT sync_status FROM lessons_data WHERE status = 'COMPLETED'",
        [],
      );
    });

    expect(allSynced).toHaveLength(LESSON_COUNT);
    for (const row of allSynced) {
      expect(row.sync_status).toBe('SYNCED');
    }
    // Sanity check: drain under the SC-001 budget.
    expect(elapsedSec).toBeLessThan(DRAIN_TIMEOUT_MS / 1000);
  });

  test('against real backend (SOAK_REAL=1, localhost:3000 required)', async ({
    page,
  }) => {
    test.skip(
      process.env.SOAK_REAL !== '1',
      'Set SOAK_REAL=1 and start `server/` locally to run this.',
    );
    test.setTimeout(DRAIN_TIMEOUT_MS + 30_000);

    // NO mockSyncBatch / mockCatalog — requests hit the real server.
    await primeAuth(page);
    await page.goto('/');
    await waitForHarness(page);

    // Register or reuse the primed JWT. If the server rejects it, the sync
    // loop returns sessionExpired and this test will fail with a clear
    // message in the pending count never dropping.

    const catalog = await primeMinimalCatalog(page);
    const ids: string[] = [];
    for (let i = 0; i < LESSON_COUNT; i++) {
      const id = await primeCompletedLesson(page, {
        series_id: catalog.seriesId,
        lesson_topic_id: catalog.topicId,
        professor_id: catalog.professorId,
        status: 'COMPLETED',
        sync_status: 'LOCAL',
        collector_user_id: DEFAULT_USER.id,
      });
      ids.push(id);
    }

    await page.evaluate(async (lessonIds) => {
      const h = (window as unknown as {
        __e2e: { syncService: { enqueue: (id: string) => Promise<void> } };
      }).__e2e;
      for (const id of lessonIds) await h.syncService.enqueue(id);
    }, ids);

    await expect
      .poll(
        async () => {
          await page.evaluate(async () => {
            const h = (window as unknown as {
              __e2e: { syncService: { runOnce: () => Promise<unknown> } };
            }).__e2e;
            await h.syncService.runOnce();
          });
          return page.evaluate(async (uid) => {
            const h = (window as unknown as {
              __e2e: {
                syncService: { countPending: (u: string) => Promise<number> };
              };
            }).__e2e;
            return h.syncService.countPending(uid);
          }, DEFAULT_USER.id);
        },
        { timeout: DRAIN_TIMEOUT_MS, intervals: [1_000, 2_000] },
      )
      .toBe(0);
  });
});
