# Research — Offline-First Sync Client (008)

**Phase**: 0 — Outline & Research
**Date**: 2026-04-18

Phase 0 resolves every implementation unknown surfaced by `spec.md` + `plan.md` so Phase 1 (data-model, contracts, quickstart) can be written without open decisions. All five `/speckit-clarify` questions are already answered inside `spec.md § Clarifications`; this file captures the remaining technical choices.

---

## 1. Connectivity detection — `@react-native-community/netinfo` vs poll-on-failure

**Decision**: Add `@react-native-community/netinfo`.

**Rationale**:
- The loop needs two signals: (a) "app is foregrounded" — provided by React Native core `AppState` (already used elsewhere), and (b) "network is reachable" — **not** provided by core. Without NetInfo, the loop can only learn about reconnect via a failed `fetch` + retry timer, which burns battery (SC-004 cap is <1 %/h idle) and pushes first-send after reconnect well beyond the 30 s recovery target (SC-002).
- NetInfo's `addEventListener` fires on reachability change within ~1 s on real devices. Hooking it lets us kick the loop immediately when signal returns, satisfying SC-002 cheaply.
- Expo SDK 54 ships a compatible pre-built version; no custom dev client needed.

**Alternatives considered**:
- **Poll-on-timer only**. Rejected: violates SC-002 worst-case (30 s poll interval + 30 s HTTP timeout = ~60 s to discover reconnect), and wakes the radio every 30 s forever when idle → violates SC-004.
- **`expo-network`**. Considered but less complete than NetInfo (no "reachable" distinction, only "connected type"). NetInfo is what the React Native community standardizes on.

---

## 2. HTTP timeout mechanism — `AbortController` via a new `apiClient.requestWithTimeout`

**Decision**: Extend `src/services/apiClient.ts` with an internal `requestWithTimeout<T>(method, path, body?, timeoutMs = 30_000)` helper that wraps the existing `request()` logic with an `AbortController` + `setTimeout(() => controller.abort(), timeoutMs)`. Public surface adds `apiClient.postWithTimeout` and `apiClient.getWithTimeout`. Existing `apiClient.get/post/patch` remain untouched for non-sync callers.

**Rationale**:
- FR-024b mandates a 30 s cap and a clean abort of the underlying fetch. `AbortController` is the only cross-platform (iOS / Android / Web) way to cancel a `fetch` on React Native + Expo SDK 54. Both `expo-modules` native fetch and the web `fetch` polyfill honor it.
- Keeping the helper inside `apiClient.ts` preserves the architectural boundary (services never call `fetch` directly — constitution §V). `syncService` and `catalogSyncService` consume it; other callers (auth) are unaffected.
- On abort, the fetch promise rejects with a `DOMException` of name `AbortError`. The helper maps that to the existing `{ data: null, error: 'Sem conexão', status: 0 }` contract, so downstream `syncService` code treats it identically to a network drop (FR-024 classify-as-transient path).

**Alternatives considered**:
- **`Promise.race` with a timeout promise**. Rejected — does not actually cancel the request; the socket keeps the radio on until the server responds or the OS drops it. Defeats the battery goal.
- **Adding `signal` to the public interface** and letting every caller create its own `AbortController`. Rejected — complicates the two single-call-site callers for negligible flexibility.

---

## 3. `Retry-After` parsing — delta-seconds + HTTP-date, clamped to FR-030 ceiling

**Decision**: Implement `parseRetryAfter(header: string, now: Date): number | null` that returns the delay in **milliseconds**, supporting both integer-seconds and RFC 7231 IMF-fixdate forms. Clamp to `[0, 30 * 60 * 1000]` (30-min ceiling, matching FR-030's attempt-6+ cap). Return `null` when the header is absent or unparseable; caller falls back to the standard FR-030 schedule.

**Rationale**:
- RFC 6585 §4 allows both forms for 429. Servers behind CloudFront / nginx commonly return the date form; `@fastify/rate-limit` (what spec 007 uses) returns the integer form. Supporting both avoids a class of future incompatibilities.
- Clamping to 30 min is the spec 008 clarification session answer: a misconfigured server returning `Retry-After: 86400` should not stall the queue for a day.
- Negative or zero values collapse to "retry immediately on next loop tick" (30 s default check interval) — well-defined, no special case.

**Alternatives considered**:
- **Honor `Retry-After` uncapped**. Rejected as explicit clarification decision.
- **Delta-seconds only**. Simpler but fragile against unknown future server stacks.

---

## 4. Boot-time reconciliation of `SENDING → QUEUED` (EC-001)

**Decision**: In `src/db/client.ts`, immediately after migrations complete, run:

```sql
UPDATE lessons_data
SET sync_status = 'QUEUED'
WHERE sync_status = 'SENDING';
```

**Rationale**:
- `SENDING` is a strictly in-flight state. It can only legitimately exist while a `POST /sync/batch` promise is pending. If the app is force-killed mid-send, the row is stuck in `SENDING` and the next boot's loop would skip it (the loop only pulls `QUEUED`).
- Server idempotency (via `collections[].id`, contract `specs/007-sync-backend/contracts/sync.md`) guarantees a re-send is safe: the server recognizes the same id, no duplicate row is created. So the cost of "might re-send an item that actually committed" is a single wasted request, not data corruption.
- Placing the reconciliation in `client.ts` (rather than `syncService`) ensures it runs exactly once per boot, regardless of when the sync loop mounts or whether the app ever has network.

**Alternatives considered**:
- **Persist a nanosecond-resolution "sending started at" timestamp and classify a row as stuck only after N minutes**. Rejected — complicates the state machine for no benefit; the idempotency key already neutralizes the "re-send a committed row" risk.

---

## 5. Batch ordering — FIFO by `sync_next_attempt_at` with NULLs first

**Decision**:

```sql
SELECT * FROM lessons_data
WHERE sync_status = 'QUEUED' AND collector_user_id = ?
ORDER BY sync_next_attempt_at ASC NULLS FIRST, client_created_at ASC
LIMIT 20;
```

**Rationale**:
- `NULL` in `sync_next_attempt_at` means "ready now" (no backoff scheduled). Ordering nulls first ensures fresh items and items just advanced out of backoff enter the batch before any deferred item.
- Secondary sort by `client_created_at` preserves collector intuition ("I submitted this earlier, send it first"). Stable.
- Filtering by `collector_user_id` makes multi-account devices (EC-002) safe: one user's queue never leaks into another's batch.

**Alternatives considered**:
- **Random sample of 20**. Rejected — no predictability; also bad for the user's mental model when watching the `/sync` list drain.
- **Strict `client_created_at` ordering ignoring `sync_next_attempt_at`**. Rejected — means a single perpetually-retrying item at the head blocks newer items from ever sending. The NULLS-FIRST rule solves that.

---

## 6. Double-send prevention — transition `QUEUED → SENDING` inside a single SQLite transaction per batch (FR-022)

**Decision**: Each sync loop iteration opens a transaction, SELECTs the batch, UPDATEs those rows to `SENDING`, commits, then fires the HTTP request. On completion (success or failure) opens a second transaction to apply the result. Guarded by an in-memory `isSending: boolean` flag inside `SyncProvider` to prevent re-entry.

**Rationale**:
- expo-sqlite 16 runs serially; no MVCC, no row-level locks to worry about. A single transaction wrapping SELECT-then-UPDATE is enough to atomically claim a batch even if NetInfo or AppState fire an additional "start loop" event while one is running.
- The `isSending` flag is a cheap first-line defense so we don't even start a second transaction when one is already mid-claim. If it were somehow bypassed (e.g., a bug), the transaction would still prevent double-sending because the second claim would find the rows already in `SENDING`.
- Separating "claim" from "apply result" (two transactions) limits each transaction's duration to a few ms, keeping the DB responsive to user reads (lesson list, `/sync` screen).

**Alternatives considered**:
- **One transaction spanning the HTTP request**. Rejected — SQLite held open for seconds blocks all reads. Terrible UX impact during flaky networks.

---

## 7. Catalog upsert — INSERT OR REPLACE vs ON CONFLICT ... DO UPDATE

**Decision**: Use `INSERT ... ON CONFLICT(id) DO UPDATE SET ...` for each of series / topics / professors. Upsert key is `id`. `updated_at` is always written from the server's value.

**Rationale**:
- `INSERT OR REPLACE` would delete-and-reinsert the row, which breaks any dependent rows that reference it via foreign key, and also loses local-only columns if there ever are any (future-proofing).
- `ON CONFLICT ... DO UPDATE` preserves the row identity and only touches changed fields.
- FR-042 explicitly says "upsert; no delete handling in MVP". Delete detection is deferred; stale rows remain visible until a future spec adds tombstones.

**Alternatives considered**:
- **INSERT OR IGNORE** (upsert-as-insert only). Rejected — fails the core requirement to sync server-side edits to existing items.

---

## 8. `last_catalog_sync` cursor — AsyncStorage vs SQLite table vs expo-secure-store

**Decision**: AsyncStorage, key `@eb-insights/last-catalog-sync`, value is an ISO-8601 string.

**Rationale**:
- The cursor is non-sensitive plain-text metadata. `expo-secure-store` is overkill and adds a native round-trip on web.
- Putting it in a dedicated SQLite table forces a migration for a single row — excessive.
- AsyncStorage is already used for the theme preference and the seed-complete flag, matching the project's established pattern for "one-row-of-app-state".

**Alternatives considered**:
- **Reuse `_migration_flags`**. Rejected — it's semantically for "which migrations ran", not "when we last pulled catalog". Mixing concerns would bite later.

---

## 9. `useSyncQueue` re-render strategy — polling SQLite vs event emitter vs tanstack-query-free subscribe

**Decision**: `SyncProvider` owns the authoritative state (`pending: number`, `sending: boolean`, `lastError: string | null`). It recomputes `pending` by running `SELECT count(*) FROM lessons_data WHERE sync_status IN ('QUEUED','SENDING') AND collector_user_id = ?` after every state-transition write it performs, and exposes the state via React context. `useSyncQueue` consumes the context.

**Rationale**:
- No third-party state library (constitution §9 — no Redux/MobX/Zustand). Keeps the stack unchanged.
- Because `SyncProvider` is the only writer of `sync_status`, it always knows when to recompute. No polling needed, no event bus.
- The `/sync` screen and the home-header badge both read from the same context, so SC-007 (<1 s lag) is trivially satisfied — no async gap.

**Alternatives considered**:
- **Poll every 1 s from each consumer**. Rejected — wasteful, and fails SC-004 battery goal over long idle.
- **SQLite change notifications / `ON CHANGE` triggers + bridge**. Rejected — expo-sqlite 16 doesn't expose them on all platforms; adds native complexity for no real benefit when we already own the write path.

---

## 10. Manual-vs-auto pull-to-refresh feedback — single service call with a `trigger` argument

**Decision**: `catalogSyncService.pullNow(trigger: 'auto' | 'manual'): Promise<CatalogPullResult>`. Result shape: `{ ok: boolean; offline: boolean; error?: string; counts?: { series: number; topics: number; professors: number } }`. Screens that wire pull-to-refresh pass `'manual'` and convert a non-`ok` result to a toast; the `SyncProvider`'s periodic / post-login calls pass `'auto'` and ignore the result beyond logging.

**Rationale**:
- FR-045 gates the feedback on the trigger, not on the failure type. Putting the gate inside the service would force the service to know about the UI toast surface — violates layering.
- Exposing a single trigger parameter keeps the service signature honest: the caller tells the service what the caller needs to do on failure.

**Alternatives considered**:
- **Two services (`pullAuto` / `pullManual`)**. Rejected — identical body for 95 % of the code; `trigger` flag is strictly clearer.
- **Events + subscribers**. Rejected — over-engineering; we have two callers.

---

## 11. Test strategy

| Scenario | Level | Tool | Notes |
|----------|-------|------|-------|
| Backoff schedule (30s → 30min) | unit | Jest, fake timers | Covers FR-030; no real delays. |
| 429 + `Retry-After` delta-seconds | unit | Jest, fake timers | Parsed delay applied to `sync_next_attempt_at`. |
| 429 + `Retry-After` HTTP-date | unit | Jest | RFC 7231 IMF-fixdate parser correctness. |
| 4xx other than 401/429 → REJECTED | unit | Jest | Verifies FR-025 amended behavior. |
| 401 → JWT cleared, items stay QUEUED | unit | Jest + spy on `clearJwt` | FR-026. |
| Timeout abort after 30 s | unit | Jest + mocked fetch that never resolves | Asserts `AbortController` path returns `'Sem conexão'`. |
| SC-001 zero-loss property test | unit | Jest + fast-check (if available; otherwise hand-rolled) | 4-hour drip: 30 % fail rate → 0 duplicates, 0 losses. |
| Badge count equals pending count, <1 s | E2E | Playwright (web build) | Queue 3 items offline, then go online, watch badge tick down. |
| `/sync` empty state (zero pending, zero history) | E2E | Playwright | Fresh install + log in + no submissions. |
| `/sync` history state | E2E | Playwright | After a successful sync, history row appears with green banner. |
| Pull-to-refresh toast when offline | E2E | Playwright (with mock network offline) | Manual trigger shows toast; auto trigger does not. |
| Migration idempotency | unit | Jest | Run `migrateAddSyncStatus` twice; assert schema unchanged and flag set. |

**What is explicitly NOT tested end-to-end on web**: `expo-secure-store` (JWT persistence — crashes on web, already mocked in `apiClient` via Platform check), and the native `share sheet` path (irrelevant here). Per CLAUDE.md §12.

---

## 12. Open questions for planning (none blocking Phase 1)

- **Observability (deferred from clarify)**: Whether to persist a `sync_attempts` audit table to debug stuck items in the wild. Punted to a post-MVP spec; for MVP, the single `sync_error` + `sync_attempt_count` columns suffice.
- **Protocol versioning**: Spec 007 pins `schema_version = "2.0"`. If the server ever moves to 2.1, the client must send 2.0 until the client is updated. Tracked as a future feature — not in scope.

No NEEDS CLARIFICATION markers remain.
