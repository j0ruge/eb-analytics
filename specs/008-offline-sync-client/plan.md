# Implementation Plan: Offline-First Sync Client

**Branch**: `008-offline-sync-client` | **Date**: 2026-04-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification at `specs/008-offline-sync-client/spec.md`

## Summary

Wire the mobile app into the spec 007 backend while preserving offline-first operation. Add a four-state `sync_status` machine (`LOCAL → QUEUED → SENDING → SYNCED | REJECTED`) to `lessons_data`, a foreground-only `syncService` that batches up to 20 queued submissions into `POST /sync/batch` with per-item backoff (30s → 30min ceiling, `Retry-After`-aware for 429s, 30s HTTP timeout via `AbortController`), and a `catalogSyncService` that pulls `/catalog?since=<last>` on login, foreground-after-1h, and manual pull-to-refresh. Both services reuse the existing `apiClient` (spec 006) — which needs a new `requestWithTimeout` helper — and follow the `AuthProvider`/`useAuth` context pattern for the React hook surface (`useSyncQueue`). New screen `app/sync/index.tsx` with `/sync` route renders pending items plus a 7-day `SYNCED` history, tied to a Home-header badge. All state is driven directly by SQLite — `SyncQueue` is a query, not a table — so the existing auto-save/crash-recovery guarantees (constitution §III) extend unchanged to sync. No background task / native scheduler (explicit Out of Scope).

## Technical Context

**Language/Version**: TypeScript 5.9 strict on React Native 0.81 / Expo SDK 54.
**Primary Dependencies**: Existing — `expo-sqlite` 16, `expo-router` 6, `@react-native-async-storage/async-storage`, `expo-secure-store` (via `apiClient`), `react-native-reanimated`. **New** — `@react-native-community/netinfo` for connectivity detection (FR-020 foreground + AppState is already available via React Native core; NetInfo fills the "wait for network" signal used by the retry loop).
**Storage**: SQLite (`lessons_data` extended with 5 new columns per FR-001..FR-004a). `AsyncStorage` holds `last_catalog_sync` (FR-041). `expo-secure-store` holds the JWT (unchanged from spec 006).
**Testing**: Jest + jest-expo for unit (services, hooks, migration). Playwright (web build) for E2E covering badge count, `/sync` screen empty/history states, and the "offline toast only on manual refresh" UX. Network-timeout path mocked at the `fetch` boundary in unit tests (no real server calls).
**Target Platform**: iOS, Android, Web (Expo). Sync paths must behave identically on web — web uses `AsyncStorage` instead of `expo-secure-store` (already handled in `apiClient`).
**Project Type**: Mobile app only. No server code in this spec (spec 007 ships the backend).
**Performance Goals**: SC-002 — 30 s recovery after network returns. SC-004 — <1 %/h battery with empty queue. SC-007 — badge count lag <1 s.
**Constraints**: Foreground-only (FR-020 + constitution §I — app works fully offline); 30 s HTTP timeout (FR-024b); batch size cap 20 (FR-021); 6-step backoff capped at 30 min (FR-030).
**Scale/Scope**: Realistic queue depth <50 items per device (documented assumption post-clarify); five new services / hooks / screens, one DB migration, seven new FRs added via `/speckit-clarify` (FR-004a, FR-016, FR-017, FR-024a, FR-024b, FR-045; FR-025 amended).

## Constitution Check

*GATE: pass before Phase 0, re-check after Phase 1.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Local-First Architecture | **PASS** | SQLite remains the source of truth. `SyncQueue` is a query against `lessons_data`. Every screen continues to work with zero network. The sync loop is additive — a pure read/write of status columns. Offline is a normal state, not an error (FR-045). |
| II. Zero-Friction UX | **PASS** | Tap "Enviar pra Nuvem" is the only new affordance. No new text input, no picker, no modal. "Retry agora" and pull-to-refresh reuse existing gestures. |
| III. Auto-Save & Fail-Safe | **PASS** | Transitions are single-column UPDATEs — no debounce coupling, no partial write exposure. EC-001 (force-close during `SENDING`) is handled by a boot-time `SENDING → QUEUED` reconciliation so crashes never wedge the queue. Idempotent re-sends are guaranteed by `collections[].id` UUIDs (already generated at lesson creation). |
| IV. Backward Compatibility | **PASS** | Migration adds 4 nullable columns + 1 NOT NULL DEFAULT `'LOCAL'` via `ALTER TABLE ADD COLUMN` guarded by `PRAGMA table_info` (FR-006, pattern established in spec 003). All existing rows default to `sync_status = 'LOCAL'`, preserving current behavior for anonymous/pre-login users. No data migration required. |
| V. Separation of Concerns | **PASS** | `syncService` / `catalogSyncService` hold all business logic; screens consume them only through `useSyncQueue` / `useCatalogSync` hooks. `apiClient` stays the HTTP boundary — services never call `fetch` directly. `/sync` screen is a pure consumer of the hook's pending+history projection. |

No gate violations. No Complexity Tracking entry needed.

## Project Structure

### Documentation (this feature)

```text
specs/008-offline-sync-client/
├── spec.md                            # WHAT / WHY (authored as PRD, clarified 2026-04-18)
├── plan.md                            # This file
├── research.md                        # Phase 0 — resolved decisions (timeout impl, NetInfo choice, etc.)
├── data-model.md                      # Phase 1 — migration diff, SyncQueue query shape, transitions
├── quickstart.md                      # Phase 1 — 5-min manual verification of US1–US5
├── contracts/                         # Phase 1 — client-side interfaces (not HTTP)
│   ├── sync-service.md                # syncService object-literal contract + useSyncQueue hook shape
│   ├── catalog-service.md             # catalogSyncService contract + useCatalogSync hook shape
│   └── server-endpoints.md            # pointer + delta to spec 007 contracts (what THIS client consumes)
└── checklists/
    └── requirements.md                # Quality checklist (all green post-clarify)
```

### Source Code (files to create / modify)

Mobile-only changes under the repository's root `app/` and `src/`. No touch to `server/`.

```text
# NEW FILES
src/services/syncService.ts                  # Send-loop: batch QUEUED → POST /sync/batch → apply SyncResult
src/services/catalogSyncService.ts           # Pull: GET /catalog?since=... → upsert series/topics/professors
src/contexts/SyncProvider.tsx                # Context: loop lifecycle, in-memory sending flag, timer, last error
src/hooks/useSyncQueue.ts                    # { pending, sending, lastError, retryNow } (FR-027)
src/hooks/useCatalogSync.ts                  # { lastSyncAt, isPulling, pullNow } for pull-to-refresh screens
src/types/sync.ts                            # SyncStatus enum, SyncResult, SendBatchPayload, CatalogDelta types
app/sync/index.tsx                           # /sync screen — pending list + 7-day SYNCED history (FR-016/017)
src/components/SyncBadge.tsx                 # Home-header badge (FR-014): count of QUEUED|SENDING with icon
src/components/PendingSubmissionRow.tsx      # List row for /sync: status chip, error banner, "Retry agora"
tests/unit/syncService.test.ts               # SC-001 zero-loss, backoff schedule, 429+Retry-After, 4xx REJECTED
tests/unit/catalogSyncService.test.ts        # Upsert ordering, since-cursor advance, manual-vs-auto feedback
tests/unit/migration_008.test.ts             # Idempotency: running twice leaves schema identical
tests/e2e/sync-badge.spec.ts                 # Badge count == pending count, <1s lag (SC-007)
tests/e2e/sync-screen.spec.ts                # Empty, history, REJECTED-visible, retry, navigate-back flows

# MODIFIED FILES
src/db/schema.ts                             # ALTER references — NOT the migration itself (see migrations.ts)
src/db/migrations.ts                         # Add migrateAddSyncStatus(db) — flag '008_offline_sync_complete'
src/db/client.ts                             # Invoke migrateAddSyncStatus + reconcile SENDING → QUEUED on boot
src/types/lesson.ts                          # Extend Lesson / LessonWithDetails with sync columns
src/services/apiClient.ts                    # Add requestWithTimeout (AbortController, 30s default) — FR-024b
src/services/lessonService.ts                # Extend SELECT/INSERT to read/write new sync_* fields
app/_layout.tsx                              # Wrap <SyncProvider> inside <AuthProvider>, outside <ThemeProvider>
app/lesson/[id].tsx                          # "Enviar pra Nuvem" button (FR-010); disable inputs on SYNCED (FR-012); REJECTED banner (FR-013)
app/(tabs)/index.tsx                         # Mount <SyncBadge /> in the header
app/series/index.tsx                         # Wire pull-to-refresh to useCatalogSync.pullNow (FR-040c, FR-045)
app/topics/index.tsx                         # Same
app/professors/index.tsx                     # Same
CLAUDE.md                                    # Update <!-- SPECKIT --> pointer to this plan
```

**Structure Decision**: Mobile-only delta. Follows the exact service → hook → context → screen layering already in place for auth (spec 006). `SyncProvider` mirrors `AuthProvider` so the sync loop has a single, well-defined mount point tied to the app lifecycle. No new directories; all files land in existing `src/{services,contexts,hooks,types,components}/` and `app/` trees.

## Constitution Re-check (post-design)

| Principle | Status | Post-design note |
|-----------|--------|------------------|
| I. Local-First | **PASS** | Design confirms: every new read/write path first consults SQLite; the network is never on the critical path of any user action. |
| II. Zero-Friction UX | **PASS** | Single new button + existing pull-to-refresh gestures. No new keyboard surfaces. |
| III. Auto-Save & Fail-Safe | **PASS** | Boot-time reconciliation (SENDING → QUEUED) added to `applyMigrations` flow closes EC-001 crash window. |
| IV. Backward Compatibility | **PASS** | Migration is additive and idempotent. Pre-login anonymous users stay on `sync_status = 'LOCAL'` and never see the "Enviar pra Nuvem" button (FR-010 clause (a)). |
| V. Separation of Concerns | **PASS** | No screen imports from `db/client.ts`; all go through services. `syncService` owns the sync state machine; UI is purely reactive. |

No violations surfaced by Phase 1 design. No amendment or justification needed.

## Complexity Tracking

> No gate violations — no entries required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
