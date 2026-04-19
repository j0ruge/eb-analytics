import type { Page } from '@playwright/test';

// Matches the storage keys used by apiClient.ts + authService.ts on web.
// AsyncStorage on react-native-web writes to window.localStorage with the key as-is.
const JWT_KEY = '@eb-insights/auth-jwt';
const USER_KEY = '@eb-insights/auth-user';

export interface PrimedUser {
  id: string;
  email: string;
  display_name: string;
  role: 'COLLECTOR' | 'COORDINATOR';
  accepted: boolean;
  created_at: string;
}

export const DEFAULT_USER: PrimedUser = {
  id: 'e2e-user-1',
  email: 'e2e@test.local',
  display_name: 'E2E Tester',
  role: 'COLLECTOR',
  accepted: true,
  created_at: '2026-04-01T00:00:00.000Z',
};

/**
 * Primes localStorage with a fake JWT + user BEFORE the app's initial bundle
 * runs. Call before every `page.goto(...)` in a test that needs an
 * authenticated session.
 */
export async function primeAuth(
  page: Page,
  user: PrimedUser = DEFAULT_USER,
  jwt = 'e2e-fake-jwt-token',
): Promise<void> {
  await page.addInitScript(
    ({ jwtKey, userKey, jwt, user }) => {
      window.localStorage.setItem(jwtKey, jwt);
      window.localStorage.setItem(userKey, JSON.stringify(user));
    },
    { jwtKey: JWT_KEY, userKey: USER_KEY, jwt, user },
  );
}

/**
 * Clear any primed auth state. Useful between tests.
 */
export async function clearAuth(page: Page): Promise<void> {
  await page.addInitScript(
    ({ jwtKey, userKey }) => {
      window.localStorage.removeItem(jwtKey);
      window.localStorage.removeItem(userKey);
    },
    { jwtKey: JWT_KEY, userKey: USER_KEY },
  );
}

/**
 * Sets localStorage keys AFTER the page has loaded (vs. primeAuth which runs
 * before the first script). Call then reload() to remount the app with an
 * authenticated session. Useful to seed data first under anonymous auth so
 * SyncProvider's post-login parallel transactions don't race.
 */
export async function setAuthAfterLoad(
  page: Page,
  user: PrimedUser = DEFAULT_USER,
  jwt = 'e2e-fake-jwt-token',
): Promise<void> {
  await page.evaluate(
    ({ jwtKey, userKey, jwt, user }) => {
      window.localStorage.setItem(jwtKey, jwt);
      window.localStorage.setItem(userKey, JSON.stringify(user));
    },
    { jwtKey: JWT_KEY, userKey: USER_KEY, jwt, user },
  );
}
