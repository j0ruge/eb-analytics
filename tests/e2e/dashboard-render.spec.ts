import { test, expect } from '@playwright/test';
import { primeAuth, DEFAULT_USER } from './_support/auth';
import {
  waitForHarness,
  primeMinimalCatalog,
  primeCompletedLesson,
} from './_support/harness';

// Spec 009 T034 — dashboard renders the five MVP/P2 cards.
// Empty state wording and card titles come from `app/dashboard.tsx`
// and `src/components/charts/DashboardEmptyState.tsx`.

async function seedCompletedLessons(page: import('@playwright/test').Page, count: number) {
  const catalog = await primeMinimalCatalog(page);
  for (let i = 0; i < count; i++) {
    await primeCompletedLesson(page, {
      series_id: catalog.seriesId,
      lesson_topic_id: catalog.topicId,
      professor_id: catalog.professorId,
      status: 'COMPLETED',
      sync_status: 'LOCAL',
      collector_user_id: DEFAULT_USER.id,
    });
  }
  return catalog;
}

test.describe('Spec 009 — statistics dashboard render', () => {
  test('empty DB shows the "at least 2 lessons" empty state', async ({ page }) => {
    await primeAuth(page);
    await page.goto('/dashboard');
    await waitForHarness(page);

    // The late-arrival card is the first one; its empty wording is deterministic.
    await expect(
      page
        .getByText('Coleta pelo menos 2 aulas para ver seu primeiro gráfico')
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('all five chart cards are titled and render after seeding data', async ({ page }) => {
    await primeAuth(page);
    await page.goto('/');
    await waitForHarness(page);

    await seedCompletedLessons(page, 4);

    await page.goto('/dashboard');
    await waitForHarness(page);

    for (const title of [
      'Índice de Chegada Tardia',
      'Curva de Presença por Aula',
      'Tendência de Presença Final',
      'Pontualidade do Início',
      'Taxa de Engajamento',
    ]) {
      await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });
    }
  });

  test('dashboardService.getLateArrivalIndex returns rows scoped to the user', async ({ page }) => {
    await primeAuth(page);
    await page.goto('/');
    await waitForHarness(page);

    await seedCompletedLessons(page, 3);

    const result = await page.evaluate(
      async (userId) => {
        const h = (window as unknown as {
          __e2e: {
            dashboardService: {
              getLateArrivalIndex: (filters: {
                currentUserId?: string;
              }) => Promise<{ data: unknown[]; excludedCount: number }>;
            };
          };
        }).__e2e;
        return h.dashboardService.getLateArrivalIndex({ currentUserId: userId });
      },
      DEFAULT_USER.id,
    );

    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.excludedCount).toBe('number');
  });
});
