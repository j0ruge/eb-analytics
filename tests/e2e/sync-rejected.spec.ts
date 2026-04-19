import { test, expect } from '@playwright/test';
import { primeAuth, DEFAULT_USER } from './_support/auth';
import { mockCatalog, mockSyncBatch } from './_support/apiMock';
import {
  waitForHarness,
  primeMinimalCatalog,
  primeCompletedLesson,
} from './_support/harness';

// Spec 008 T043 — server rejection surfaces as red banner + removed button.
test.describe('Spec 008 T043 — rejection banner on lesson detail', () => {
  test('server rejects → red banner + "Enviar pra Nuvem" button removed', async ({
    page,
  }) => {
    await primeAuth(page);
    await mockCatalog(page);
    await mockSyncBatch(page, {
      rejectAll: { code: 'invalid_payload', message: 'Professor inválido' },
    });

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

    await expect(page.getByText('Rejeitada pelo servidor')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Professor inválido')).toBeVisible();
    await expect(sendButton).toBeHidden();
  });
});
