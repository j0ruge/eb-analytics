import { test, expect } from '@playwright/test';

test.describe('Test C — Seed data and lesson detail UI (§1 partial)', () => {
  test('settings shows Padrões section, seed populates lessons, detail has new fields', async ({ page }) => {
    // Auto-dismiss any alert dialogs (seed success, etc.)
    page.on('dialog', (d) => d.accept());

    // Step 1: verify Settings screen has the Padrões section
    await page.goto('/settings');
    await expect(page.getByText('Padrões')).toBeVisible();
    await expect(page.getByText('Incluir professor nas contagens por padrão')).toBeVisible();

    // Step 2: load seed data
    await page.getByRole('button', { name: 'Carregar dados de exemplo' }).click();
    await expect(page.getByText('Aulas')).toBeVisible({ timeout: 5000 });

    // Step 3: navigate to home and filter for completed lessons
    await page.goto('/');
    await page.getByText('Completa').click();
    await expect(page.getByText(/Eb\d{3}/)).toBeVisible({ timeout: 3000 });

    // Step 4: open the first lesson
    await page.getByText(/Eb\d{3}/).first().click();
    await expect(page.getByText('Contei o professor nestas contagens')).toBeVisible({ timeout: 3000 });

    // Step 5: verify new UI fields exist in lesson detail
    await expect(page.getByText('Contei o professor nestas contagens')).toBeVisible();
    await expect(page.getByText('Observações')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Clima' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Observações' })).toBeVisible();
  });
});
