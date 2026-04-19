import type { Page, Route } from '@playwright/test';

// apiClient resolves BASE_URL from Constants.expoConfig.extra.apiUrl, which
// app.config.js defaults to http://localhost:3000 when EXPO_PUBLIC_API_URL
// is not set. Tests should intercept requests to that origin.
const API_ORIGIN = 'http://localhost:3000';

/**
 * Intercepts POST /sync/batch (the endpoint syncService posts to).
 *
 * Response shape per contracts/sync-service.md + syncService.ts line 408:
 *   { accepted: string[], rejected: Array<{id, code, message}>, server_now: string }
 *
 * Options:
 *  - rejectAll: status and code to apply to every submitted id.
 *  - rejectIds: reject only specific ids.
 *  - status: override HTTP status (e.g. 429, 500).
 *  - retryAfter: Retry-After header (only meaningful with status=429).
 *  - offline: abort the fetch so the client sees a network failure.
 */
export async function mockSyncBatch(
  page: Page,
  options: {
    rejectAll?: { code: string; message: string };
    rejectIds?: Record<string, { code: string; message: string }>;
    status?: number;
    retryAfter?: string;
    offline?: boolean;
  } = {},
): Promise<void> {
  await page.route(`${API_ORIGIN}/sync/batch`, async (route: Route) => {
    if (options.offline) {
      await route.abort('failed');
      return;
    }

    const req = route.request();
    let body: { collections?: Array<{ id: string }> } = {};
    try {
      body = JSON.parse(req.postData() || '{}');
    } catch {
      // leave as {}
    }
    const ids = (body.collections || []).map((c) => c.id);

    const status = options.status ?? 200;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options.retryAfter) headers['Retry-After'] = options.retryAfter;

    if (status !== 200) {
      await route.fulfill({
        status,
        headers,
        body: JSON.stringify({ error: 'Erro simulado' }),
      });
      return;
    }

    const rejected: Array<{ id: string; code: string; message: string }> = [];
    const accepted: string[] = [];

    for (const id of ids) {
      if (options.rejectAll) {
        rejected.push({ id, ...options.rejectAll });
        continue;
      }
      if (options.rejectIds && options.rejectIds[id]) {
        rejected.push({ id, ...options.rejectIds[id] });
        continue;
      }
      accepted.push(id);
    }

    await route.fulfill({
      status: 200,
      headers,
      body: JSON.stringify({
        accepted,
        rejected,
        server_now: new Date().toISOString(),
      }),
    });
  });
}

/**
 * Intercepts GET /catalog and /catalog?since=... Useful to prevent real
 * network calls during sync tests that don't care about the catalog.
 */
export async function mockCatalog(
  page: Page,
  options: {
    payload?: {
      series?: unknown[];
      topics?: unknown[];
      professors?: unknown[];
      server_now?: string;
    };
    offline?: boolean;
    status?: number;
  } = {},
): Promise<void> {
  await page.route(`${API_ORIGIN}/catalog*`, async (route: Route) => {
    if (options.offline) {
      await route.abort('failed');
      return;
    }

    const status = options.status ?? 200;
    if (status !== 200) {
      await route.fulfill({
        status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Erro simulado' }),
      });
      return;
    }

    const payload = options.payload ?? {
      series: [],
      topics: [],
      professors: [],
      server_now: new Date().toISOString(),
    };
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  });
}
