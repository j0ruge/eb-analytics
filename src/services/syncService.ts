// syncService — offline-first sync client core.
// See specs/008-offline-sync-client/contracts/sync-service.md.
//
// Pure data-layer + HTTP orchestration. UI consumption goes through
// SyncProvider + useSyncQueue; never import syncService from a screen.

import Constants from 'expo-constants';
import { getDatabase } from '../db/client';
import { withDbMutex } from '../db/mutex';
import { apiClient, clearJwt } from './apiClient';
import type { ApiResponseWithHeaders } from './apiClient';
import { lessonService } from './lessonService';
import { authService } from './authService';
import { getDeviceId } from './deviceIdService';
import { buildCollection } from './exportService';
import type { ExportEnvelopeV2 } from './exportService';
import type { Lesson, LessonWithDetails } from '../types/lesson';
import { SyncStatus, type SyncResult } from '../types/sync';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BATCH_SIZE = 20; // FR-021
export const HTTP_TIMEOUT_MS = 30_000; // FR-024b
export const BACKOFF_CEILING_MS = 30 * 60 * 1000; // FR-030 ceiling

// FR-030 schedule: attempt N → delay. attempt=1 means "first retry".
// 1→30s, 2→1min, 3→2min, 4→5min, 5→15min, 6+→30min (capped).
const BACKOFF_SCHEDULE_MS = [
  30 * 1000,
  60 * 1000,
  2 * 60 * 1000,
  5 * 60 * 1000,
  15 * 60 * 1000,
  30 * 60 * 1000,
];

// Per-item rejection codes that do NOT mean REJECTED (they are transient or
// cross-batch). See contracts/sync-service.md classification table.
const TRANSIENT_REJECTION_CODES = new Set(['rate_limited', 'unauthenticated']);

// ---------------------------------------------------------------------------
// Helpers (exported for unit tests)
// ---------------------------------------------------------------------------

export function computeBackoffMs(attemptCount: number): number {
  if (attemptCount <= 0) return 0;
  const idx = Math.min(attemptCount - 1, BACKOFF_SCHEDULE_MS.length - 1);
  return BACKOFF_SCHEDULE_MS[idx];
}

// Parses `Retry-After` header per RFC 7231. Returns milliseconds clamped to
// [0, BACKOFF_CEILING_MS]. Null/unparseable → null (caller falls back to
// FR-030 schedule). Matches research.md §3.
export function parseRetryAfter(header: string | null, now: Date): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed) return null;

  // delta-seconds (integer)
  if (/^\d+$/.test(trimmed)) {
    const secs = parseInt(trimmed, 10);
    const ms = secs * 1000;
    if (!Number.isFinite(ms)) return null;
    return Math.max(0, Math.min(ms, BACKOFF_CEILING_MS));
  }

  // HTTP-date
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  const delta = parsed - now.getTime();
  return Math.max(0, Math.min(delta, BACKOFF_CEILING_MS));
}

// Assembles the v2 export envelope body for POST /sync/batch from a batch of
// Lesson rows. Mirrors exportService.buildEnvelope but scoped to the given rows.
async function buildSyncEnvelope(lessons: LessonWithDetails[]): Promise<ExportEnvelopeV2> {
  const session = await authService.getSession();
  const collector = session
    ? { user_id: session.user.id, display_name: session.user.display_name }
    : null;

  return {
    schema_version: '2.0',
    client: {
      app_version: Constants.expoConfig?.version ?? 'unknown',
      device_id: await getDeviceId(),
    },
    collector,
    exported_at: new Date().toISOString(),
    collections: lessons.map(buildCollection),
  };
}

// In-memory re-entry guard — prevents two concurrent runOnce invocations from
// claiming overlapping batches. The SQLite transaction in claimBatch is the
// authoritative guard; this flag is a cheap first-line defense.
let isSendingInFlight = false;

export interface RunOnceResult {
  accepted: number;
  rejected: number;
  retried: number;
  // When true, the caller (SyncProvider) should emit the session-expired toast
  // and stop triggering runOnce until the user logs back in (FR-026).
  sessionExpired: boolean;
  // Last visible error, or null when the run was a no-op or succeeded fully.
  lastError: string | null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

async function currentUserId(): Promise<string | null> {
  const session = await authService.getSession();
  return session?.user.id ?? null;
}

async function claimBatch(userId: string, now: Date): Promise<string[]> {
  const db = await getDatabase();
  const nowIso = now.toISOString();

  // Single transaction: SELECT + UPDATE so a concurrent invocation cannot
  // claim the same rows (FR-022). SQLite expo-sqlite is serial per connection
  // but still guarded via BEGIN to stay explicit.
  const claimed: string[] = [];
  await db.withTransactionAsync(async () => {
    const rows = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM lessons_data
        WHERE sync_status = 'QUEUED'
          AND collector_user_id = ?
          AND (sync_next_attempt_at IS NULL OR sync_next_attempt_at <= ?)
        ORDER BY sync_next_attempt_at ASC NULLS FIRST, created_at ASC
        LIMIT ?`,
      [userId, nowIso, BATCH_SIZE],
    );
    for (const r of rows) {
      await db.runAsync(
        "UPDATE lessons_data SET sync_status = 'SENDING' WHERE id = ? AND sync_status = 'QUEUED'",
        [r.id],
      );
      claimed.push(r.id);
    }
  });
  return claimed;
}

async function loadLessonsByIds(ids: string[]): Promise<LessonWithDetails[]> {
  if (ids.length === 0) return [];
  const out: LessonWithDetails[] = [];
  for (const id of ids) {
    const lesson = await lessonService.getByIdWithDetails(id);
    if (lesson) out.push(lesson);
  }
  return out;
}

// Revert a set of ids from SENDING back to QUEUED, scheduling backoff.
// `-Inner` variant runs WITHOUT starting a transaction — callers must provide
// one. See `revertToQueuedWithBackoff` for the standalone, tx-wrapped variant.
async function revertToQueuedWithBackoffInner(
  db: Awaited<ReturnType<typeof getDatabase>>,
  ids: string[],
  delayMsOverride: number | null,
  now: Date,
): Promise<void> {
  if (ids.length === 0) return;
  for (const id of ids) {
    const row = await db.getFirstAsync<{ sync_attempt_count: number }>(
      'SELECT sync_attempt_count FROM lessons_data WHERE id = ?',
      [id],
    );
    const nextAttempt = (row?.sync_attempt_count ?? 0) + 1;
    const delay = delayMsOverride ?? computeBackoffMs(nextAttempt);
    const nextAt = new Date(now.getTime() + delay).toISOString();
    await db.runAsync(
      `UPDATE lessons_data
          SET sync_status = 'QUEUED',
              sync_attempt_count = ?,
              sync_next_attempt_at = ?
        WHERE id = ?`,
      [nextAttempt, nextAt, id],
    );
  }
}

async function revertToQueuedWithBackoff(
  ids: string[],
  delayMsOverride: number | null,
  now: Date,
): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await revertToQueuedWithBackoffInner(db, ids, delayMsOverride, now);
  });
}

async function markSyncedInner(
  db: Awaited<ReturnType<typeof getDatabase>>,
  ids: string[],
  serverNow: string,
): Promise<void> {
  for (const id of ids) {
    await db.runAsync(
      `UPDATE lessons_data
          SET sync_status = 'SYNCED',
              sync_error = NULL,
              sync_attempt_count = 0,
              sync_next_attempt_at = NULL,
              synced_at = ?
        WHERE id = ? AND synced_at IS NULL`,
      [serverNow, id],
    );
  }
}

async function markRejectedInner(
  db: Awaited<ReturnType<typeof getDatabase>>,
  rejections: { id: string; code: string; message: string }[],
): Promise<void> {
  for (const r of rejections) {
    const syncError = `${r.code}: ${r.message}`;
    await db.runAsync(
      `UPDATE lessons_data
          SET sync_status = 'REJECTED',
              sync_error = ?
        WHERE id = ?`,
      [syncError, r.id],
    );
  }
}

async function markRejected(
  rejections: { id: string; code: string; message: string }[],
): Promise<void> {
  if (rejections.length === 0) return;
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await markRejectedInner(db, rejections);
  });
}

export const syncService = {
  /**
   * Transition a LOCAL row to QUEUED. Enforces FR-010 preconditions.
   */
  async enqueue(lessonId: string): Promise<void> {
    const lesson = await lessonService.getById(lessonId);
    if (!lesson) {
      throw new Error('Aula não encontrada');
    }
    if (lesson.status !== 'COMPLETED') {
      throw new Error('Aula precisa estar finalizada para enviar');
    }
    if (lesson.sync_status !== SyncStatus.LOCAL) {
      throw new Error('Aula já foi enviada ou está na fila');
    }

    const db = await getDatabase();
    const result = await db.runAsync(
      `UPDATE lessons_data
          SET sync_status = 'QUEUED',
              sync_attempt_count = 0,
              sync_next_attempt_at = NULL,
              sync_error = NULL
        WHERE id = ? AND sync_status = 'LOCAL'`,
      [lessonId],
    );
    // Guard: the SQL predicate prevents double-enqueue. If 0 rows changed,
    // another flow (claimBatch) already advanced the row concurrently.
    if (result.changes === 0) {
      throw new Error('Aula já foi enviada ou está na fila');
    }
  },

  /**
   * Force-advance items past any backoff (FR-031). Does not send by itself.
   */
  async retryNow(lessonIds?: string[]): Promise<void> {
    const db = await getDatabase();
    const userId = await currentUserId();
    if (!userId) return;

    if (lessonIds && lessonIds.length > 0) {
      await db.withTransactionAsync(async () => {
        for (const id of lessonIds) {
          await db.runAsync(
            `UPDATE lessons_data
                SET sync_attempt_count = 0,
                    sync_next_attempt_at = NULL,
                    sync_error = NULL
              WHERE id = ? AND sync_status = 'QUEUED' AND collector_user_id = ?`,
            [id, userId],
          );
        }
      });
    } else {
      await db.runAsync(
        `UPDATE lessons_data
            SET sync_attempt_count = 0,
                sync_next_attempt_at = NULL,
                sync_error = NULL
          WHERE sync_status = 'QUEUED' AND collector_user_id = ?`,
        [userId],
      );
    }
  },

  async countPending(collectorUserId: string): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ n: number }>(
      `SELECT count(*) AS n FROM lessons_data
        WHERE sync_status IN ('QUEUED','SENDING')
          AND collector_user_id = ?`,
      [collectorUserId],
    );
    return row?.n ?? 0;
  },

  async listForSyncScreen(
    collectorUserId: string,
  ): Promise<{ pending: LessonWithDetails[]; history: LessonWithDetails[] }> {
    const db = await getDatabase();

    const pending = await db.getAllAsync<LessonWithDetails>(
      `SELECT ld.*,
              lt.title AS topic_title,
              lt.series_id AS resolved_series_id,
              ls.code AS series_code,
              ls.title AS series_title,
              p.name AS professor_name_resolved
         FROM lessons_data ld
         LEFT JOIN lesson_topics lt ON ld.lesson_topic_id = lt.id
         LEFT JOIN lesson_series ls ON lt.series_id = ls.id
         LEFT JOIN professors p ON ld.professor_id = p.id
        WHERE ld.sync_status IN ('QUEUED','SENDING','REJECTED')
          AND ld.collector_user_id = ?
        ORDER BY
          CASE ld.sync_status
            WHEN 'SENDING' THEN 0
            WHEN 'QUEUED' THEN 1
            WHEN 'REJECTED' THEN 2
          END,
          ld.created_at DESC`,
      [collectorUserId],
    );

    const history = await db.getAllAsync<LessonWithDetails>(
      `SELECT ld.*,
              lt.title AS topic_title,
              lt.series_id AS resolved_series_id,
              ls.code AS series_code,
              ls.title AS series_title,
              p.name AS professor_name_resolved
         FROM lessons_data ld
         LEFT JOIN lesson_topics lt ON ld.lesson_topic_id = lt.id
         LEFT JOIN lesson_series ls ON lt.series_id = ls.id
         LEFT JOIN professors p ON ld.professor_id = p.id
        WHERE ld.sync_status = 'SYNCED'
          AND ld.collector_user_id = ?
          AND ld.synced_at IS NOT NULL
          AND ld.synced_at >= datetime('now','-7 days')
        ORDER BY ld.synced_at DESC
        LIMIT 20`,
      [collectorUserId],
    );

    return { pending, history };
  },

  /**
   * Run a single sync-loop iteration. Idempotent (the in-memory flag plus
   * the SENDING transition prevent double-sends). Never throws — errors are
   * classified and surfaced via RunOnceResult.
   */
  async runOnce(): Promise<RunOnceResult> {
    if (isSendingInFlight) {
      return { accepted: 0, rejected: 0, retried: 0, sessionExpired: false, lastError: null };
    }
    isSendingInFlight = true;

    // Outer try/finally guarantees the flag is cleared even if withDbMutex
    // itself rejects (e.g., a waiter-queue failure). Without this guard,
    // a mutex-level failure would leave isSendingInFlight permanently true
    // and silently disable all future syncs until app restart.
    try {
      // Serialize all DB work through the global mutex so concurrent
      // catalog pulls / sync loops on expo-sqlite web don't race inside
      // withTransactionAsync.
      return await withDbMutex(async () => {
      const userId = await currentUserId();
      if (!userId) {
        return { accepted: 0, rejected: 0, retried: 0, sessionExpired: false, lastError: null };
      }

      const now = new Date();
      const claimed = await claimBatch(userId, now);
      if (claimed.length === 0) {
        return { accepted: 0, rejected: 0, retried: 0, sessionExpired: false, lastError: null };
      }

      const lessons = await loadLessonsByIds(claimed);
      if (lessons.length === 0) {
        // Shouldn't happen — claimed ids must exist. Defensive revert.
        await revertToQueuedWithBackoff(claimed, null, now);
        return {
          accepted: 0,
          rejected: 0,
          retried: claimed.length,
          sessionExpired: false,
          lastError: 'Dados locais inconsistentes',
        };
      }

      const envelope = await buildSyncEnvelope(lessons);

      let response: ApiResponseWithHeaders<SyncResult>;
      try {
        response = await apiClient.postWithTimeout<SyncResult>(
          '/sync/batch',
          envelope,
          HTTP_TIMEOUT_MS,
        );
      } catch (err) {
        console.error('[syncService] postWithTimeout threw unexpectedly:', err);
        await revertToQueuedWithBackoff(claimed, null, now);
        return {
          accepted: 0,
          rejected: 0,
          retried: claimed.length,
          sessionExpired: false,
          lastError: 'Erro inesperado ao enviar',
        };
      }

      // ----- 200 OK -----
      if (response.status >= 200 && response.status < 300 && response.data) {
        const { accepted, rejected, server_now } = response.data;
        const acceptedSet = new Set(accepted);
        const rejectedIds = new Set(rejected.map((r) => r.id));

        // Split rejections: transient codes go back to QUEUED, others REJECTED.
        const permanentRejections = rejected.filter(
          (r) => !TRANSIENT_REJECTION_CODES.has(r.code),
        );
        const transientRejections = rejected.filter((r) =>
          TRANSIENT_REJECTION_CODES.has(r.code),
        );

        // Defensive requeue: ids not in accepted or rejected — use standard
        // backoff schedule, NOT the server's Retry-After.
        const defensiveRequeue: string[] = [];
        for (const id of claimed) {
          if (!acceptedSet.has(id) && !rejectedIds.has(id)) {
            console.warn(
              `[syncService] id ${id} not in accepted or rejected — defensive requeue`,
            );
            defensiveRequeue.push(id);
          }
        }
        const transientIds = transientRejections.map((r) => r.id);
        const retryAfter =
          transientIds.length > 0
            ? parseRetryAfter(response.headers['retry-after'] ?? null, now)
            : null;

        // Atomic outcome: all four mutations (synced / rejected / defensive-requeue
        // / transient-requeue) happen in one transaction. Process kill mid-way
        // used to strand some SENDING rows; now either all outcomes persist or
        // none do, and the next runOnce reclaims the batch safely.
        const db = await getDatabase();
        await db.withTransactionAsync(async () => {
          await markSyncedInner(db, accepted, server_now);
          await markRejectedInner(db, permanentRejections);
          await revertToQueuedWithBackoffInner(db, defensiveRequeue, null, now);
          await revertToQueuedWithBackoffInner(db, transientIds, retryAfter, now);
        });

        return {
          accepted: accepted.length,
          rejected: permanentRejections.length,
          retried: defensiveRequeue.length + transientIds.length,
          sessionExpired: false,
          lastError: null,
        };
      }

      // ----- 401 — session expired -----
      if (response.status === 401) {
        await clearJwt();
        await revertToQueuedWithBackoff(claimed, null, now);
        return {
          accepted: 0,
          rejected: 0,
          retried: claimed.length,
          sessionExpired: true,
          lastError: 'Sessão expirada — entre novamente para sincronizar',
        };
      }

      // ----- 429 — rate limited -----
      if (response.status === 429) {
        const retryAfter = parseRetryAfter(response.headers['retry-after'] ?? null, now);
        await revertToQueuedWithBackoff(claimed, retryAfter, now);
        return {
          accepted: 0,
          rejected: 0,
          retried: claimed.length,
          sessionExpired: false,
          lastError: response.error ?? 'Muitas requisições, tente novamente',
        };
      }

      // ----- 413 — batch too large (unexpected given BATCH_SIZE = 20) -----
      if (response.status === 413) {
        console.error(
          '[syncService] 413 batch_too_large — unexpected; FR-021 cap is 20 items. Reverting.',
        );
        await revertToQueuedWithBackoff(claimed, null, now);
        return {
          accepted: 0,
          rejected: 0,
          retried: claimed.length,
          sessionExpired: false,
          lastError: response.error ?? 'Lote muito grande',
        };
      }

      // ----- 4xx other than 401/413/429 — batch-level reject -----
      if (response.status >= 400 && response.status < 500) {
        const rejections = claimed.map((id) => ({
          id,
          code: `http_${response.status}`,
          message: response.error ?? `HTTP ${response.status}`,
        }));
        await markRejected(rejections);
        return {
          accepted: 0,
          rejected: rejections.length,
          retried: 0,
          sessionExpired: false,
          lastError: response.error ?? `Erro HTTP ${response.status}`,
        };
      }

      // ----- 5xx, network error, timeout — revert and backoff -----
      await revertToQueuedWithBackoff(claimed, null, now);
      return {
        accepted: 0,
        rejected: 0,
        retried: claimed.length,
        sessionExpired: false,
        lastError: response.error ?? 'Sem conexão',
      };
      }); // withDbMutex
    } finally {
      isSendingInFlight = false;
    }
  },

  // Exposed for tests — DO NOT use in production code.
  __resetSendingFlagForTest(): void {
    isSendingInFlight = false;
  },
};

// Re-export for tests that import through syncService.
export type { Lesson };
