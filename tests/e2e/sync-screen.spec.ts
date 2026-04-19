import { test, expect } from '@playwright/test';
import { primeAuth } from './_support/auth';
import { mockCatalog, mockSyncBatch } from './_support/apiMock';

test.describe('Spec 008 — /sync tab states (T060)', () => {
  test('anonymous: renders export UI and "Faça login" notice', async ({ page }) => {
    await page.goto('/sync');

    await expect(page.getByText('Status da Sincronização')).toBeVisible();
    await expect(page.getByText('Exportar Dados (JSON)')).toBeVisible();
    await expect(
      page.getByText('Faça login para sincronizar com a nuvem'),
    ).toBeVisible();
  });

  test('authenticated + empty DB: shows "Nenhuma submissão pendente."', async ({
    page,
  }) => {
    await primeAuth(page);
    // Silence any network triggered by SyncProvider on mount.
    await mockCatalog(page, {
      payload: { series: [], topics: [], professors: [], server_now: new Date().toISOString() },
    });
    await mockSyncBatch(page, {});

    await page.goto('/sync');

    await expect(page.getByText('Nenhuma submissão pendente.')).toBeVisible({
      timeout: 10_000,
    });
    // The unauth notice must NOT appear when authenticated.
    await expect(
      page.getByText('Faça login para sincronizar com a nuvem'),
    ).toBeHidden();
  });
});
