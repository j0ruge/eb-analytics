import { test, expect } from '@playwright/test';
import { waitForHarness } from './_support/harness';

test.describe('Test C — Seed data and lesson detail UI (§1 partial)', () => {
  test('settings shows Padrões section, seed populates lessons, detail has new fields', async ({ page }) => {
    // Auto-dismiss any alert dialogs (seed success, etc.)
    page.on('dialog', (d) => d.accept());

    // Step 1: verify Settings screen has the Padrões section
    await page.goto('/settings');
    await waitForHarness(page);
    await expect(page.getByText('Padrões')).toBeVisible();
    await expect(page.getByText('Incluir professor nas contagens por padrão')).toBeVisible();

    // Step 2: load seed data. The button fires `seedService.seed()` then an
    // alert. Poll the DB via the harness until the seed actually materialized
    // — avoids racing the alert handler against async inserts.
    await page.getByRole('button', { name: 'Carregar dados de exemplo' }).click();

    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            const h = (window as unknown as {
              __e2e: {
                getDatabase: () => Promise<{
                  getFirstAsync: (sql: string, params: unknown[]) => Promise<{ c: number } | null>;
                }>;
              };
            }).__e2e;
            const db = await h.getDatabase();
            const row = await db.getFirstAsync(
              "SELECT COUNT(*) AS c FROM lessons_data WHERE status = 'COMPLETED'",
              [],
            );
            return row?.c ?? 0;
          }),
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    // Step 3: navigate to home and filter for completed lessons
    await page.goto('/');
    await expect(page.getByRole('tab', { name: /Aulas/ })).toBeVisible({ timeout: 10_000 });
    await page.getByText('Completa').click();
    await expect(page.getByText(/Eb\d{3}/).first()).toBeVisible({ timeout: 3000 });

    // Step 4: open the first lesson
    await page.getByText(/Eb\d{3}/).first().click();
    await expect(page.getByText('Contei o professor nestas contagens')).toBeVisible({ timeout: 3000 });

    // Step 5: verify new UI fields exist in lesson detail. The label
    // "Observações" appears twice (section heading + textbox label), so
    // prefer the textbox/switch locators which are unambiguous.
    await expect(page.getByText('Contei o professor nestas contagens')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Clima' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Observações' })).toBeVisible();
  });
});
