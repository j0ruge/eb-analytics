import { test, expect } from '@playwright/test';
import { waitForHarness } from './_support/harness';

// Spec 004 T087 — theme preference persists across reload.
// The Settings screen writes the choice to AsyncStorage key
// `@eb-insights/theme-preference`, which on web → localStorage.
const STORAGE_KEY = '@eb-insights/theme-preference';

test.describe('Spec 004 — theme preference persistence', () => {
  test('selecting "Escuro" survives a full page reload', async ({ page }) => {
    await page.goto('/settings');
    await waitForHarness(page);

    const darkButton = page.getByRole('button', { name: 'Tema Escuro' });
    await darkButton.waitFor({ state: 'visible' });
    await darkButton.click();

    // Wait for the setter to flush to AsyncStorage (web localStorage).
    await expect
      .poll(
        async () =>
          page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY),
        { timeout: 5_000 },
      )
      .toBe('dark');

    await page.reload();
    await waitForHarness(page);

    const stored = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      STORAGE_KEY,
    );
    expect(stored).toBe('dark');
  });

  test('the three options (Claro / Escuro / Sistema) are all selectable', async ({ page }) => {
    await page.goto('/settings');
    await waitForHarness(page);

    for (const label of ['Claro', 'Escuro', 'Sistema'] as const) {
      const button = page.getByRole('button', { name: `Tema ${label}` });
      await expect(button).toBeVisible();
    }
  });
});
