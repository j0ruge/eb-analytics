import { test, expect } from '@playwright/test';

test.describe('Test D — Settings default toggle (§7)', () => {
  test('toggling default ON makes new lesson start with includes_professor checked', async ({ page }) => {
    page.on('dialog', (d) => d.accept());

    // Step 1: enable the default in Settings
    await page.goto('/settings');
    const toggle = page.getByLabel('Incluir professor nas contagens por padrão');
    await toggle.click();
    await page.waitForTimeout(500);

    // Verify it persisted to localStorage
    const stored = await page.evaluate(() =>
      localStorage.getItem('@eb-insights/include-professor-default'),
    );
    expect(stored).toBe('true');

    // Step 2: create a new lesson
    await page.goto('/');
    await page.getByText('Nova Aula').click();
    await page.waitForTimeout(1000);

    // Step 3: verify the includes_professor checkbox is checked on the new lesson
    // react-native-web renders the Switch as a div + a hidden input. The
    // input is the one `toBeChecked` understands.
    const lessonSwitch = page.getByLabel('Contei o professor nestas contagens');
    await expect(lessonSwitch).toBeChecked();
  });
});
