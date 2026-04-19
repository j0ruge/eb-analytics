import { test, expect } from '@playwright/test';

test.describe('Test F — Includes professor toggle on Lesson Detail (FR-019)', () => {
  test('toggling includes_professor OFF persists after navigation round-trip', async ({ page }) => {
    page.on('dialog', (d) => d.accept());

    // Step 1: ensure Settings default is ON so new lessons start with it checked
    await page.goto('/settings');
    const defaultToggle = page.getByLabel('Incluir professor nas contagens por padrão');
    // If not already on, toggle it on
    const isChecked = await defaultToggle.isChecked();
    if (!isChecked) {
      await defaultToggle.click();
      await page.waitForTimeout(500);
    }

    // Step 2: create a new lesson (should inherit the default ON)
    await page.goto('/');
    await page.getByText('Nova Aula').click();
    await expect(page.getByText('Contei o professor nestas contagens')).toBeVisible({ timeout: 3000 });

    const lessonUrl = page.url();
    expect(lessonUrl).toContain('/lesson/');

    // Step 3: verify the toggle starts as checked (inherited from default)
    const professorToggle = page.getByLabel('Contei o professor nestas contagens');
    await expect(professorToggle).toBeChecked();

    // Step 4: toggle it OFF
    await professorToggle.click();
    await expect(professorToggle).not.toBeChecked();

    // Step 5: wait for debounce (500ms) + margin
    await page.waitForTimeout(1500);

    // Step 6: navigate away and come back
    await page.goto('/');
    await page.waitForTimeout(500);
    await page.goto(lessonUrl);
    await expect(page.getByText('Contei o professor nestas contagens')).toBeVisible({ timeout: 3000 });

    // Step 7: verify the toggle persisted as OFF
    await expect(
      page.getByLabel('Contei o professor nestas contagens'),
    ).not.toBeChecked();
  });
});
