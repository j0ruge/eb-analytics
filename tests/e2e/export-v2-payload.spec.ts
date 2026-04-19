import { test, expect } from '@playwright/test';
import { primeAuth, DEFAULT_USER } from './_support/auth';
import {
  waitForHarness,
  primeMinimalCatalog,
  primeCompletedLesson,
} from './_support/harness';

// Spec 005 T023/T064 — full v2 envelope quickstart, automated.
// Seeds a completed lesson, calls `exportService.__buildEnvelopeForTest`
// directly through the harness (bypassing the OS share sheet), and asserts
// every v2 contract field is present and shaped correctly.
test.describe('Spec 005 — export envelope v2 payload', () => {
  test('envelope has schema_version, client, collector, and collection XOR fields', async ({ page }) => {
    await primeAuth(page);
    await page.goto('/');
    await waitForHarness(page);

    const catalog = await primeMinimalCatalog(page);
    await primeCompletedLesson(page, {
      series_id: catalog.seriesId,
      lesson_topic_id: catalog.topicId,
      professor_id: catalog.professorId,
      status: 'COMPLETED',
      sync_status: 'LOCAL',
      collector_user_id: DEFAULT_USER.id,
    });

    const envelope = await page.evaluate(async () => {
      const h = (window as unknown as {
        __e2e: {
          exportService: { __buildEnvelopeForTest: () => Promise<unknown> };
        };
      }).__e2e;
      return h.exportService.__buildEnvelopeForTest();
    });

    expect(envelope).toMatchObject({
      schema_version: '2.0',
      collector: {
        user_id: DEFAULT_USER.id,
        display_name: DEFAULT_USER.display_name,
      },
    });

    const env = envelope as {
      client: { app_version: string; device_id: string };
      exported_at: string;
      collections: Array<{
        id: string;
        client_created_at: string;
        client_updated_at: string;
        status: string;
        lesson_instance: {
          series_id: string | null;
          series_code_fallback: string | null;
          topic_id: string | null;
          topic_title_fallback: string | null;
          professor_id: string | null;
          professor_name_fallback: string | null;
        };
        attendance: { includes_professor: boolean };
        weather: string | null;
        notes: string | null;
      }>;
    };

    expect(typeof env.client.app_version).toBe('string');
    expect(env.client.device_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(env.exported_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(env.collections).toHaveLength(1);
    const c = env.collections[0];

    expect(c.status).toBe('COMPLETED');
    expect(c.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(typeof c.client_created_at).toBe('string');
    expect(typeof c.client_updated_at).toBe('string');

    // XOR contract: when a catalog id exists, the fallback must be null.
    const li = c.lesson_instance;
    expect(li.series_id).toBe(catalog.seriesId);
    expect(li.series_code_fallback).toBeNull();
    expect(li.topic_id).toBe(catalog.topicId);
    expect(li.topic_title_fallback).toBeNull();
    expect(li.professor_id).toBe(catalog.professorId);
    expect(li.professor_name_fallback).toBeNull();

    // includes_professor must be a boolean, not 0/1.
    expect(typeof c.attendance.includes_professor).toBe('boolean');
  });

  test('unauthenticated export produces collector: null', async ({ page }) => {
    // No primeAuth — anonymous session.
    await page.goto('/');
    await waitForHarness(page);

    const catalog = await primeMinimalCatalog(page);
    await primeCompletedLesson(page, {
      series_id: catalog.seriesId,
      lesson_topic_id: catalog.topicId,
      professor_id: catalog.professorId,
      status: 'COMPLETED',
      sync_status: 'LOCAL',
      collector_user_id: null,
    });

    const envelope = await page.evaluate(async () => {
      const h = (window as unknown as {
        __e2e: {
          exportService: { __buildEnvelopeForTest: () => Promise<unknown> };
        };
      }).__e2e;
      return h.exportService.__buildEnvelopeForTest();
    });

    expect(envelope).toMatchObject({
      schema_version: '2.0',
      collector: null,
    });
  });

  test('empty export throws the Portuguese guard message', async ({ page }) => {
    await primeAuth(page);
    await page.goto('/');
    await waitForHarness(page);

    const result = await page.evaluate(async () => {
      const h = (window as unknown as {
        __e2e: {
          exportService: { __buildEnvelopeForTest: () => Promise<unknown> };
        };
      }).__e2e;
      try {
        await h.exportService.__buildEnvelopeForTest();
        return { ok: true, message: null };
      } catch (err) {
        return { ok: false, message: (err as Error).message };
      }
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('Não há aulas finalizadas');
  });
});
