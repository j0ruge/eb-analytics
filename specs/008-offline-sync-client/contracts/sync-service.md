# Contract — `syncService` & `useSyncQueue`

**Scope**: client-side interfaces only. HTTP contract is in `specs/007-sync-backend/contracts/sync.md`; this file describes what the mobile service and React hook expose to the rest of the app.

---

## `syncService` (object literal, following the pattern in CLAUDE.md §5)

File: `src/services/syncService.ts`.

```typescript
import type { SyncStatus, SyncResult } from '../types/sync';

export const syncService = {
  /**
   * Transition a LOCAL row to QUEUED.
   * Preconditions: lesson.status = 'COMPLETED', sync_status = 'LOCAL', user is logged in.
   * Postconditions: sync_status = 'QUEUED', sync_attempt_count = 0,
   *                 sync_next_attempt_at = NULL, sync_error = NULL.
   * Throws: 'Aula não está pronta para envio' if preconditions violated.
   */
  async enqueue(lessonId: string): Promise<void>,

  /**
   * Force-advance one or more items past any backoff. Used by "Retry agora"
   * (FR-031). Resets sync_attempt_count to 0 and sync_next_attempt_at to NULL.
   * Does NOT itself send — just makes the items eligible on the next loop tick.
   */
  async retryNow(lessonIds: string[]): Promise<void>,

  /**
   * One loop iteration. Called by SyncProvider on:
   *   - AppState → 'active'
   *   - NetInfo → 'isConnected: true'
   *   - 30s foreground timer
   *   - immediately after enqueue() or retryNow()
   *
   * Steps (per FR-022):
   *   1. Acquire in-memory sending flag; no-op if already running.
   *   2. Open a transaction, SELECT up to 20 QUEUED items whose
   *      sync_next_attempt_at is NULL or <= now, UPDATE to SENDING, COMMIT.
   *   3. If the batch is empty, return immediately.
   *   4. POST /sync/batch via apiClient.postWithTimeout(…, 30_000).
   *   5. Apply the SyncResult in a second transaction:
   *        - accepted → SYNCED + synced_at = response.server_now
   *        - rejected → REJECTED (unless code ∈ {'rate_limited','unauthenticated'})
   *        - anything else → QUEUED with backoff per FR-030 / FR-024a
   *   6. Release in-memory sending flag.
   *
   * Returns the count of items processed (accepted + rejected) for telemetry.
   */
  async runOnce(): Promise<{ accepted: number; rejected: number; retried: number }>,

  /**
   * Count of rows in QUEUED|SENDING for the current user.
   * Used by SyncProvider to feed useSyncQueue.pending.
   */
  async countPending(collectorUserId: string): Promise<number>,

  /**
   * 7-day SYNCED history + current REJECTED for /sync screen (FR-016, FR-017).
   * Ordered per data-model.md §3.
   */
  async listForSyncScreen(collectorUserId: string): Promise<{
    pending: LessonWithSyncState[];       // QUEUED | SENDING | REJECTED
    history: LessonWithSyncState[];       // SYNCED, synced_at within 7 days, cap 20
  }>,
};
```

### Error classification inside `runOnce`

Happens after the HTTP call returns (`apiClient.postWithTimeout` always resolves — never rejects — per the existing `ApiResponse<T>` contract).

```
┌──────────────────────────────┬──────────────────────────┬──────────────────────────────────┐
│  HTTP outcome                │  Per-item outcome        │  Action                          │
├──────────────────────────────┼──────────────────────────┼──────────────────────────────────┤
│  200                         │  id ∈ accepted           │  → SYNCED, synced_at=server_now  │
│  200                         │  id ∈ rejected, code ≠   │  → REJECTED, sync_error set       │
│                              │    'rate_limited' &&     │                                  │
│                              │    'unauthenticated'     │                                  │
│  200                         │  id ∈ rejected, code =   │  → QUEUED + parseRetryAfter()    │
│                              │    'rate_limited'        │    (FR-024a, per-item)           │
│  200                         │  id NOT in either list   │  → QUEUED + FR-030 backoff       │
│                              │    (contract violation — │    (defensive)                   │
│                              │     log warning)          │                                  │
│  401                         │  (whole batch)           │  → QUEUED, clearJwt(), emit      │
│                              │                          │    toast "Sessão expirada — …"   │
│  413 batch_too_large         │  (whole batch)           │  → QUEUED; 413 is unexpected     │
│                              │                          │    given FR-021's 20-item cap.   │
│                              │                          │    Log loudly and revert. Do NOT │
│                              │                          │    auto-shrink the batch — that  │
│                              │                          │    would require an explicit FR. │
│  429 (batch-level)           │  (whole batch)           │  → QUEUED + parseRetryAfter()    │
│                              │                          │    or FR-030 fallback            │
│  other 4xx (batch-level,     │  (whole batch)           │  → REJECTED for every sent item, │
│    EXCEPT 401/413/429)       │                          │    sync_error = server message   │
│  5xx, network error, timeout │  (whole batch)           │  → QUEUED + FR-030 backoff       │
└──────────────────────────────┴──────────────────────────┴──────────────────────────────────┘
```

### `parseRetryAfter(header: string | null, now: Date): number | null`

Exported from `src/services/syncService.ts` for unit testing. Returns milliseconds or null.

- Integer ⇒ `N * 1000`.
- RFC 7231 IMF-fixdate ⇒ `Date.parse(header) - now.getTime()`.
- Unparseable or null ⇒ return `null`.
- Negative result ⇒ `0`.
- Clamp to `[0, 30 * 60 * 1000]`.

---

## `useSyncQueue` hook (FR-027)

File: `src/hooks/useSyncQueue.ts`.

```typescript
export interface SyncQueueSnapshot {
  pending: number;               // count of QUEUED | SENDING (current user)
  sending: boolean;              // true while runOnce is in flight
  lastError: string | null;      // last non-401 error message, cleared on next success
  retryNow: (ids?: string[]) => Promise<void>;   // omitting ids retries all QUEUED
}

export function useSyncQueue(): SyncQueueSnapshot;
```

- Consumes `SyncContext` provided by `src/contexts/SyncProvider.tsx`.
- Throws if used outside `<SyncProvider>` (pattern matches `useTheme` / `useAuth`).
- Re-renders only when one of the four fields changes (shallow compare by the provider).

### `SyncProvider` responsibilities

File: `src/contexts/SyncProvider.tsx`.

- On mount: register listeners for `AppState.addEventListener('change', …)` and `NetInfo.addEventListener(…)`. Start a 30 s `setInterval` while the app is foregrounded.
- On unmount: remove listeners and clear interval.
- When any trigger fires AND `isAuthenticated` AND `isConnected`: call `syncService.runOnce()`.
- Maintain `pending`, `sending`, `lastError` in React state. Refresh `pending` via `syncService.countPending` after every `runOnce`, every `enqueue`, every `retryNow`.
- Expose `retryNow(ids?)` which calls `syncService.retryNow(ids ?? await getAllPendingIds())` followed by `runOnce()`.
- Must wait for `useAuth().isLoading === false` before first run (CLAUDE.md §10 "Contexts with `isLoading`" rule — guard against FOIC).

---

## Reuse requirements

| Where | Pattern | Reuse source |
|---|---|---|
| Provider | React context + isLoading guard | `src/theme/ThemeProvider.tsx`, `src/contexts/AuthProvider.tsx` |
| Hook | Context consumer that throws outside provider | `src/hooks/useTheme.ts`, `src/hooks/useAuth.ts` |
| Service | Object literal with async methods, no class | `src/services/lessonService.ts` |
| HTTP client | `apiClient.postWithTimeout` (NEW, added to existing module) | `src/services/apiClient.ts` (extend) |

---

## Observability (minimum for MVP)

Per research §12: no audit table for MVP. Log via `console.error` on:

- Every HTTP failure that does not end in REJECTED (transient retries).
- Every time `runOnce` picks an unexpected `id` distribution (`sentIds` that appear in neither `accepted` nor `rejected`).
- Every 401 that triggers JWT clear.

Format: `[syncService] <action>: <message>`, with a short JSON context where useful. No PII — never log collection body content, only ids and counts.
