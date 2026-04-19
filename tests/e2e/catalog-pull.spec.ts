import { test, expect } from '@playwright/test';
import { primeAuth } from './_support/auth';
import { mockCatalog, mockSyncBatch } from './_support/apiMock';
import { waitForHarness } from './_support/harness';

// Spec 008 T056 — catalog pull behaviors.
// RefreshControl pull-to-refresh gestures are not reliably reproducible in
// Playwright-on-Chromium web (touch synthesis is flaky). Instead, drive the
// service directly via the harness and assert the 3 flows:
//   1. Online manual pull with seeded catalog → ok:true, new rows in DB.
//   2. Offline manual pull → ok:false, offline:true, cursor unchanged.
//   3. Unauthenticated pull → ok:false, skipped:true, no HTTP.
test.describe('Spec 008 T056 — catalogSyncService flows', () => {
  test('online manual pull upserts catalog and advances cursor', async ({
    page,
  }) => {
    await primeAuth(page);
    await mockSyncBatch(page, {});
    await mockCatalog(page, {
      payload: {
        series: [
          {
            id: 'srv-series-1',
            code: 'Eb-SRV',
            title: 'Server Series',
            description: null,
            updated_at: '2026-04-18T10:00:00.000Z',
          },
        ],
        topics: [],
        professors: [],
        server_now: '2026-04-18T12:00:00.000Z',
      },
    });

    await page.goto('/');
    await waitForHarness(page);

    const result = await page.evaluate(async () => {
      const h = (window as unknown as {
        __e2e: {
          catalogSyncService: {
            pullNow: (t: string) => Promise<{ ok: boolean; server_now?: string }>;
            getLastSyncAt: () => Promise<string | null>;
          };
          getDatabase: () => Promise<unknown>;
        };
      }).__e2e;
      const r = await h.catalogSyncService.pullNow('manual');
      const cursor = await h.catalogSyncService.getLastSyncAt();
      const db = (await h.getDatabase()) as {
        getAllAsync: (sql: string, p: unknown[]) => Promise<Array<{ id: string }>>;
      };
      const rows = await db.getAllAsync(
        'SELECT id FROM lesson_series WHERE id = ?',
        ['srv-series-1'],
      );
      return { r, cursor, rowFound: rows.length === 1 };
    });

    expect(result.r.ok).toBe(true);
    expect(result.rowFound).toBe(true);
    expect(result.cursor).toBe('2026-04-18T12:00:00.000Z');
  });

  test('offline manual pull returns offline:true and does not advance cursor', async ({
    page,
  }) => {
    await primeAuth(page);
    await mockSyncBatch(page, {});
    await mockCatalog(page, { offline: true });

    await page.goto('/');
    await waitForHarness(page);

    const result = await page.evaluate(async () => {
      const h = (window as unknown as {
        __e2e: {
          catalogSyncService: {
            pullNow: (t: string) => Promise<{ ok: boolean; offline?: boolean }>;
            getLastSyncAt: () => Promise<string | null>;
          };
        };
      }).__e2e;
      const r = await h.catalogSyncService.pullNow('manual');
      const cursor = await h.catalogSyncService.getLastSyncAt();
      return { r, cursor };
    });

    expect(result.r.ok).toBe(false);
    expect(result.r.offline).toBe(true);
    expect(result.cursor).toBeNull();
  });

  test('unauthenticated pull returns skipped:true with no HTTP call', async ({
    page,
  }) => {
    let catalogHits = 0;
    await page.route('http://localhost:3000/catalog*', async (route) => {
      catalogHits++;
      await route.fulfill({ status: 200, body: '{}' });
    });
    await mockSyncBatch(page, {});

    await page.goto('/');
    await waitForHarness(page);

    const result = await page.evaluate(async () => {
      const h = (window as unknown as {
        __e2e: {
          catalogSyncService: {
            pullNow: (t: string) => Promise<{ ok: boolean; skipped?: boolean }>;
          };
        };
      }).__e2e;
      return h.catalogSyncService.pullNow('manual');
    });

    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
    expect(catalogHits).toBe(0);
  });
});
