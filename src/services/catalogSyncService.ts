// catalogSyncService — pulls series/topics/professors from the server and
// upserts into local SQLite. See specs/008-offline-sync-client/contracts/catalog-service.md.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from '../db/client';
import { withDbMutex } from '../db/mutex';
import { apiClient } from './apiClient';
import { authService } from './authService';
import type { CatalogPullResult, CatalogPullTrigger } from '../types/sync';

const CURSOR_KEY = '@eb-insights/last-catalog-sync';
const HTTP_TIMEOUT_MS = 30_000;

interface CatalogSeriesDto {
  id: string;
  code: string;
  title: string;
  description: string | null;
  is_pending?: boolean;
  updated_at: string;
}

interface CatalogTopicDto {
  id: string;
  series_id: string;
  title: string;
  sequence_order: number;
  suggested_date: string | null;
  is_pending?: boolean;
  updated_at: string;
}

interface CatalogProfessorDto {
  id: string;
  doc_id: string | null;
  name: string;
  email: string | null;
  is_pending?: boolean;
  updated_at: string;
}

interface CatalogResponse {
  series: CatalogSeriesDto[];
  topics: CatalogTopicDto[];
  professors: CatalogProfessorDto[];
  server_now: string;
}

// Server returns `suggested_date` as full ISO ("2026-04-18T00:00:00.000Z").
// Topics created locally store just `YYYY-MM-DD`. Truncate so both paths
// produce the same shape — the read-side just prints the raw column.
function normalizeDateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const tIdx = iso.indexOf('T');
  return tIdx === 10 ? iso.slice(0, 10) : iso;
}

async function upsertCatalog(resp: CatalogResponse): Promise<void> {
  const db = await getDatabase();
  // Serialize with syncService through the shared DB mutex — expo-sqlite web
  // cannot handle concurrent withTransactionAsync calls.
  await withDbMutex(() => db.withTransactionAsync(async () => {
    for (const s of resp.series) {
      await db.runAsync(
        `INSERT INTO lesson_series (id, code, title, description, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           code = excluded.code,
           title = excluded.title,
           description = excluded.description,
           updated_at = excluded.updated_at`,
        [s.id, s.code, s.title, s.description ?? null, s.updated_at],
      );
    }
    for (const t of resp.topics) {
      await db.runAsync(
        `INSERT INTO lesson_topics (id, series_id, title, sequence_order, suggested_date, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           series_id = excluded.series_id,
           title = excluded.title,
           sequence_order = excluded.sequence_order,
           suggested_date = excluded.suggested_date,
           updated_at = excluded.updated_at`,
        [t.id, t.series_id, t.title, t.sequence_order, normalizeDateOnly(t.suggested_date), t.updated_at],
      );
    }
    for (const p of resp.professors) {
      // doc_id (CPF) round-trips with the server. Sync preserves the local
      // value when the server side is null — this stops a pull from blowing
      // away a CPF the mobile created before the row reached the backend.
      await db.runAsync(
        `INSERT INTO professors (id, doc_id, name, email, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           doc_id = COALESCE(excluded.doc_id, professors.doc_id),
           name = excluded.name,
           email = excluded.email,
           updated_at = excluded.updated_at`,
        [p.id, p.doc_id ?? null, p.name, p.email ?? null, p.updated_at],
      );
    }
  }));
}

async function buildQueryString(): Promise<string> {
  const since = await AsyncStorage.getItem(CURSOR_KEY);
  if (!since) return '';
  return `?since=${encodeURIComponent(since)}`;
}

export const catalogSyncService = {
  async getLastSyncAt(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(CURSOR_KEY);
    } catch (err) {
      console.error('[catalogSyncService] getLastSyncAt failed:', err);
      return null;
    }
  },

  async resetCursor(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CURSOR_KEY);
    } catch (err) {
      console.error('[catalogSyncService] resetCursor failed:', err);
    }
  },

  async pullNow(_trigger: CatalogPullTrigger): Promise<CatalogPullResult> {
    // Auth gate: FR-044.
    const session = await authService.getSession();
    if (!session) {
      return { ok: false, offline: false, skipped: true };
    }

    const qs = await buildQueryString();
    const response = await apiClient.getWithTimeout<CatalogResponse>(
      `/catalog${qs}`,
      HTTP_TIMEOUT_MS,
    );

    if (response.status === 0) {
      return { ok: false, offline: true };
    }

    if (response.status >= 200 && response.status < 300 && response.data) {
      // Runtime guard — the generic cast does not enforce DTO shape, and a
      // missing or non-string `server_now` would poison the cursor (next
      // pull would skip the since-filter or set a literal "undefined").
      if (typeof response.data.server_now !== 'string') {
        console.error('[catalogSyncService] server_now missing or not a string');
        return { ok: false, offline: false, error: 'Resposta inválida do servidor' };
      }
      try {
        await upsertCatalog(response.data);
        await AsyncStorage.setItem(CURSOR_KEY, response.data.server_now);
        return {
          ok: true,
          offline: false,
          counts: {
            series: response.data.series.length,
            topics: response.data.topics.length,
            professors: response.data.professors.length,
          },
          server_now: response.data.server_now,
        };
      } catch (err) {
        console.error('[catalogSyncService] upsert transaction failed:', err);
        return { ok: false, offline: false, error: 'Erro ao salvar catálogo local' };
      }
    }

    return { ok: false, offline: false, error: response.error ?? 'Erro no catálogo' };
  },
};
