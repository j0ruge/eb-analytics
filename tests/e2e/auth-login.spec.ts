import { test, expect } from '@playwright/test';

test.describe('Test G — Auth login flow (006 US3)', () => {
  test('Settings shows "Entrar" and "Criar conta" when not logged in', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Criar conta' })).toBeVisible();
  });

  test('login screen renders with email and password fields', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').waitFor();

    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Senha')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });

  test('register screen renders with name, email, and password fields', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Nome').waitFor();

    await expect(page.getByLabel('Nome')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Senha')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Registrar' })).toBeVisible();
  });
});
