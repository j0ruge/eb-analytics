import { test, expect } from '@playwright/test';
import { primeAuth, DEFAULT_USER } from './_support/auth';
import { mockCatalog, mockSyncBatch } from './_support/apiMock';
import {
  waitForHarness,
  primeMinimalCatalog,
  primeCompletedLesson,
} from './_support/harness';

// Spec 008 T018 — online sync happy path.
// Uses the dev-only `window.__e2e` harness (registered in app/_layout.tsx)
// to insert a COMPLETED + LOCAL lesson directly, then drives the UI through
// the "Enviar pra Nuvem" button and asserts the button disappears once the
// mocked /sync/batch accepts the lesson.
test.describe('Spec 008 T018 — online sync happy path', () => {
  test('"Enviar pra Nuvem" → mocked accept → button gone', async ({ page }) => {
    await primeAuth(page);
    await mockCatalog(page);
    await mockSyncBatch(page, {});

    await page.goto('/');
    await waitForHarness(page);
    const catalog = await primeMinimalCatalog(page);
    const lessonId = await primeCompletedLesson(page, {
      series_id: catalog.seriesId,
      lesson_topic_id: catalog.topicId,
      professor_id: catalog.professorId,
      status: 'COMPLETED',
      sync_status: 'LOCAL',
      collector_user_id: DEFAULT_USER.id,
    });

    await page.goto(`/lesson/${lessonId}`);
    await waitForHarness(page);

    const sendButton = page.getByText('Enviar pra Nuvem');
    await expect(sendButton).toBeVisible({ timeout: 10_000 });

    await sendButton.click();
    // After the mocked 200 accepts the lesson, sync_status transitions to
    // SYNCED; the button is gated on sync_status === LOCAL so it disappears.
    await expect(sendButton).toBeHidden({ timeout: 15_000 });
  });
});
