import { test, expect } from '@playwright/test';

test.describe('Test H — Auth logout flow (006 US4)', () => {
  test('when not logged in, Settings shows login/register buttons (no logout)', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForTimeout(500);

    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Criar conta' })).toBeVisible();

    // "Sair" button should NOT be visible for anonymous users
    await expect(page.getByRole('button', { name: 'Sair' })).not.toBeVisible();
  });
});
