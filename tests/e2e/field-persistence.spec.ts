import { test, expect } from '@playwright/test';

test.describe('Test E — Field persistence (§4 partial)', () => {
  test('weather and notes survive navigation round-trip', async ({ page }) => {
    page.on('dialog', (d) => d.accept());

    // Step 1: create a new lesson
    await page.goto('/');
    await page.getByText('Nova Aula').click();
    await page.waitForTimeout(1000);

    // Capture the lesson URL so we can re-navigate
    const lessonUrl = page.url();
    expect(lessonUrl).toContain('/lesson/');

    // Step 2: fill weather and notes
    const clima = page.getByRole('textbox', { name: 'Clima' });
    const notas = page.getByRole('textbox', { name: 'Observações' });

    await clima.fill('Ensolarado 28°C');
    await notas.fill('Teste Playwright E2E');

    // Step 3: wait for debounce (500ms) + margin
    await page.waitForTimeout(1500);

    // Step 4: navigate away
    await page.goto('/');
    await page.waitForTimeout(500);

    // Step 5: re-open the same lesson by URL
    await page.goto(lessonUrl);
    await page.waitForTimeout(1000);

    // Step 6: assert values persisted
    await expect(page.getByRole('textbox', { name: 'Clima' })).toHaveValue('Ensolarado 28°C');
    await expect(page.getByRole('textbox', { name: 'Observações' })).toHaveValue(
      'Teste Playwright E2E',
    );
  });
});
