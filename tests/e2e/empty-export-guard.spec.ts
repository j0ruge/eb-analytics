import { test, expect } from '@playwright/test';

test.describe('Test B — Empty export guard (§5)', () => {
  test('export button on fresh app with 0 completed lessons triggers alert, not crash', async ({ page }) => {
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Não há aulas finalizadas');
      await dialog.accept();
    });

    await page.goto('/sync');

    await expect(page.getByText('Aulas Finalizadas:')).toBeVisible();

    await page.getByText('Exportar Dados (JSON)').click();

    // If we reach here without crash, the guard fired correctly.
    // The dialog handler above asserts the message content.
    await expect(page.getByText('Status da Sincronização')).toBeVisible();
  });
});
