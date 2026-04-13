import { test, expect } from '@playwright/test';

test.describe('Test F — Anonymous baseline (006 US1)', () => {
  test('app opens directly to Home with no login prompt', async ({ page }) => {
    await page.goto('/');

    // Home screen renders immediately — no login wall
    await expect(page.getByRole('heading', { name: 'EB Insights' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Aulas/ })).toBeVisible();
  });

  test('can create a lesson without being logged in', async ({ page }) => {
    page.on('dialog', (d) => d.accept());

    await page.goto('/');
    await page.getByText('Nova Aula').click();

    // Wait for navigation to lesson detail deterministically
    await expect(page).toHaveURL(/\/lesson\//, { timeout: 5000 });
  });
});
