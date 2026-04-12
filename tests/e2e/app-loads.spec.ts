import { test, expect } from '@playwright/test';

test.describe('Test A — App loads and renders (§8 baseline)', () => {
  test('home screen renders with title and tabs', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'EB Insights' })).toBeVisible();

    await expect(page.getByRole('tab', { name: /Aulas/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Dashboard/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Séries/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Professores/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Sincronizar/ })).toBeVisible();
  });
});
