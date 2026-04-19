import { test, expect } from '@playwright/test';
import { primeAuth, DEFAULT_USER } from './_support/auth';
import { mockCatalog, mockSyncBatch } from './_support/apiMock';
import {
  waitForHarness,
  primeMinimalCatalog,
  primeCompletedLesson,
} from './_support/harness';

// Spec 008 T061 + T062 — /sync screen composite states.
test.describe('Spec 008 T061/T062 — /sync screen states', () => {
  test('T061: 3 queued → sync all → "Tudo em dia" + 3 history rows', async ({
    page,
  }) => {
    await primeAuth(page);
    await mockCatalog(page);
    await mockSyncBatch(page, {});

    await page.goto('/');
    await waitForHarness(page);
    const catalog = await primeMinimalCatalog(page);

    for (let i = 0; i < 3; i++) {
      await primeCompletedLesson(page, {
        series_id: catalog.seriesId,
        lesson_topic_id: catalog.topicId,
        professor_id: catalog.professorId,
        status: 'COMPLETED',
        sync_status: 'QUEUED',
        collector_user_id: DEFAULT_USER.id,
      });
    }

    // Drain the queue via the harness.
    await page.evaluate(() => {
      const h = (window as unknown as {
        __e2e: { syncService: { __resetSendingFlagForTest: () => void } };
      }).__e2e;
      h.syncService.__resetSendingFlagForTest();
    });
    await page.evaluate(async () => {
      const h = (window as unknown as {
        __e2e: { syncService: { runOnce: () => Promise<unknown> } };
      }).__e2e;
      await h.syncService.runOnce();
    });

    await page.goto('/sync');
    await waitForHarness(page);

    await expect(page.getByText('Tudo em dia')).toBeVisible({ timeout: 10_000 });
    // 3 history rows — each renders "Enviado" label.
    await expect(page.getByText('Enviado')).toHaveCount(3);
  });

  test('T062: REJECTED row stays in pending region even with 0 QUEUED', async ({
    page,
  }) => {
    await primeAuth(page);
    await mockCatalog(page);
    await mockSyncBatch(page, {
      rejectAll: { code: 'invalid_payload', message: 'Payload inválido' },
    });

    await page.goto('/');
    await waitForHarness(page);
    const catalog = await primeMinimalCatalog(page);

    await primeCompletedLesson(page, {
      series_id: catalog.seriesId,
      lesson_topic_id: catalog.topicId,
      professor_id: catalog.professorId,
      status: 'COMPLETED',
      sync_status: 'QUEUED',
      collector_user_id: DEFAULT_USER.id,
    });

    await page.evaluate(() => {
      const h = (window as unknown as {
        __e2e: { syncService: { __resetSendingFlagForTest: () => void } };
      }).__e2e;
      h.syncService.__resetSendingFlagForTest();
    });
    await page.evaluate(async () => {
      const h = (window as unknown as {
        __e2e: { syncService: { runOnce: () => Promise<unknown> } };
      }).__e2e;
      await h.syncService.runOnce();
    });

    // Confirm: countPending is 0 (no QUEUED|SENDING); but one REJECTED row still in DB.
    const state = await page.evaluate(async () => {
      const h = (window as unknown as {
        __e2e: {
          syncService: { countPending: (u: string) => Promise<number> };
          getDatabase: () => Promise<unknown>;
        };
      }).__e2e;
      const pending = await h.syncService.countPending('e2e-user-1');
      const db = (await h.getDatabase()) as {
        getAllAsync: (sql: string, params: unknown[]) => Promise<Array<{ sync_status: string }>>;
      };
      const rows = await db.getAllAsync(
        'SELECT sync_status FROM lessons_data',
        [],
      );
      return { pending, rows };
    });
    expect(state.pending).toBe(0);
    expect(state.rows.some((r) => r.sync_status === 'REJECTED')).toBe(true);

    await page.goto('/sync');
    await waitForHarness(page);

    // REJECTED surfaces on /sync as a PendingSubmissionRow with red indicator.
    // Text signal: the submission row renders the sync_error message.
    await expect(page.getByText('Payload inválido')).toBeVisible({
      timeout: 10_000,
    });
    // "Tudo em dia" banner should NOT show (pending list is not empty).
    await expect(page.getByText('Tudo em dia')).toBeHidden();
  });
});
