import { test, expect } from '@playwright/test';
import { primeAuth, DEFAULT_USER } from './_support/auth';
import { mockCatalog, mockSyncBatch } from './_support/apiMock';
import { waitForHarness, primeMinimalCatalog, primeCompletedLesson } from './_support/harness';

// Spec 008 T031 — SyncBadge lifecycle (US2 FR-014).
// Three QUEUED rows → badge shows 3; after sync with mocked 200 all_accepted,
// the pending count reaches 0 and the badge hides.
test.describe('Spec 008 T031 — SyncBadge lifecycle', () => {
  test('3 queued items → badge "3" → sync drain → badge hidden', async ({
    page,
  }) => {
    await primeAuth(page);
    await mockCatalog(page);
    // Start offline to allow the badge to show before the sync loop drains.
    await mockSyncBatch(page, { offline: true });

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

    // Nudge the SyncProvider to recount.
    await page.evaluate(async (uid) => {
      const h = (window as unknown as { __e2e: { syncService: { countPending: (u: string) => Promise<number> } } }).__e2e;
      await h.syncService.countPending(uid);
    }, DEFAULT_USER.id);
    await page.reload();
    await waitForHarness(page);

    // Badge renders a label "3 submissões pendentes".
    await expect(
      page.getByLabel(/3 submissões pendentes/),
    ).toBeVisible({ timeout: 10_000 });

    // Flip the mock to accept everything, then trigger a drain.
    await page.unroute('http://localhost:3000/sync/batch');
    await mockSyncBatch(page, {});

    // Reset the in-memory re-entry guard — SyncProvider's post-mount runOnce
    // might still hold it when we call runOnce directly from the harness.
    await page.evaluate(() => {
      const h = (window as unknown as { __e2e: { syncService: { __resetSendingFlagForTest: () => void } } }).__e2e;
      h.syncService.__resetSendingFlagForTest();
    });
    await page.evaluate(async () => {
      const h = (window as unknown as { __e2e: { syncService: { runOnce: () => Promise<unknown> } } }).__e2e;
      await h.syncService.runOnce();
    });

    // Reload so SyncProvider recounts from the drained DB.
    await page.reload();
    await waitForHarness(page);

    // After the drain, the badge is hidden (pending === 0).
    await expect(
      page.getByLabel(/submissões pendentes/),
    ).toBeHidden({ timeout: 10_000 });
  });
});
