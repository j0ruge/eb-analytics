/**
 * Dev-only E2E harness.
 *
 * Exposes the service object-literals on `window.__e2e` so Playwright tests
 * can prime database state without driving the whole UI. Gated on:
 *   - Platform.OS === 'web'   (harness is pointless on native)
 *   - __DEV__ === true        (never ship in production bundles)
 *
 * Tests use it like:
 *   await page.evaluate(async () => {
 *     const { lessonService } = (window as any).__e2e;
 *     await lessonService.createLesson({...});
 *   });
 */

import { Platform } from 'react-native';
import { lessonService } from '../services/lessonService';
import { syncService } from '../services/syncService';
import { catalogSyncService } from '../services/catalogSyncService';
import { seedService } from '../services/seedService';
import { authService } from '../services/authService';
import { exportService } from '../services/exportService';
import { dashboardService } from '../services/dashboardService';
import { getDatabase } from '../db/client';

export function registerE2EHarness(): void {
  if (Platform.OS !== 'web') return;
  if (typeof __DEV__ !== 'undefined' && !__DEV__) return;
  if (typeof window === 'undefined') return;

  (window as unknown as { __e2e?: unknown }).__e2e = {
    lessonService,
    syncService,
    catalogSyncService,
    seedService,
    authService,
    exportService,
    dashboardService,
    getDatabase,
  };
}
