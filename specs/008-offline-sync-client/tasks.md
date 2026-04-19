---
description: "Task list — Offline-First Sync Client (spec 008)"
---

# Tasks: Offline-First Sync Client

**Input**: Design documents from `/specs/008-offline-sync-client/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓
**Tests**: INCLUDED — spec success criteria (SC-001, SC-005, SC-007) and CLAUDE.md §12 mandate unit + E2E coverage for any UI-touching change.
**Organization**: Grouped by user story. Each P1/P2 story is independently testable per spec `## User Scenarios & Testing`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no incomplete dependencies)
- **[Story]**: US1..US5 (P6 intentionally deferred — see bottom)
- File paths are absolute within the repo root.

## Path Conventions

Mobile app (React Native + Expo) — `src/` and `app/` at repo root. No server touches in this spec.

---

## Terminology note

Throughout this spec + tasks, "toast" refers to the project's transient user-facing notification surface. Per CLAUDE.md §10, the current convention is `Alert.alert()`. No toast library is introduced by this spec — every "show a toast" instruction translates to an `Alert.alert(title, message)` call following the patterns already present in `app/login.tsx` and `app/settings.tsx`. Upgrading to a dedicated toast component is an explicit future enhancement (not in scope).

## Phase 1: Setup

- [X] T001 Install `@react-native-community/netinfo` via `npx expo install @react-native-community/netinfo` and confirm `package.json` + `package-lock.json` updated without other diffs.
- [X] T002 Create `src/types/sync.ts` containing `SyncStatus` enum (`LOCAL`, `QUEUED`, `SENDING`, `SYNCED`, `REJECTED`), `SyncResultRejection`, `SyncResult`, `CatalogPullTrigger`, and `CatalogPullResult` types per `contracts/sync-service.md` and `contracts/catalog-service.md`.

---

## Phase 2: Foundational (blocks every user story)

**Goal**: DB migration + boot reconciliation + `apiClient` timeout helper in place so every downstream story can assume the schema and HTTP primitives exist.

- [X] T003 Extend `src/db/schema.ts` with the `sync_*` columns on `lessons_data` (documented CHECK constraint) plus two new index constants `CREATE_INDEX_SYNC_STATUS` and `CREATE_INDEX_SYNC_NEXT_ATTEMPT` (partial index where `sync_status = 'QUEUED'`). Per `data-model.md §1`.
- [X] T004 Add `migrateAddSyncStatus(db)` to `src/db/migrations.ts` with flag `'008_offline_sync_complete'`, using `PRAGMA table_info('lessons_data')` to idempotently add `sync_status`, `sync_error`, `sync_attempt_count`, `sync_next_attempt_at`, `synced_at`; create the new indexes; follows the `migrateAddAuthIdentity` pattern at `src/db/migrations.ts:226`.
- [X] T005 Wire `migrateAddSyncStatus` into `src/db/client.ts` right after `migrateAddAuthIdentity` (line ~281). Then add the boot reconciliation `UPDATE lessons_data SET sync_status = 'QUEUED' WHERE sync_status = 'SENDING'` before any downstream consumer runs (EC-001 fix).
- [X] T006 [P] Extend `src/types/lesson.ts` — add `sync_status: SyncStatus`, `sync_error: string | null`, `sync_attempt_count: number`, `sync_next_attempt_at: string | null`, `synced_at: string | null` to the `Lesson` and `LessonWithDetails` interfaces.
- [X] T007 [P] Extend `src/services/apiClient.ts` with `requestWithTimeout<T>(method, path, body?, timeoutMs)` using `AbortController`. Export `apiClient.postWithTimeout` and `apiClient.getWithTimeout`. On `AbortError`, return the existing shape `{ data: null, error: 'Sem conexão', status: 0 }` so callers can treat it as a network failure.
- [X] T008 [P] Update `src/services/lessonService.ts` to SELECT/INSERT the new `sync_*` columns — read them into `Lesson` rows and include them in the default `SELECT` that `getAllLessonsWithDetails` runs.
- [X] T009 [P] Unit test `tests/unit/migration_008.test.ts` — run `migrateAddSyncStatus` twice on an in-memory DB; assert `PRAGMA table_info` snapshot is byte-identical between runs AND that `_migration_flags` contains `'008_offline_sync_complete'`.

**Checkpoint**: DB schema + boot reconciliation + apiClient timeout all verified before any story-level work begins.

---

## Phase 3 — User Story 1: Send Single Submission Online (P1)

**Goal**: A logged-in collector taps "Enviar pra Nuvem" with working Wi-Fi and watches a COMPLETED lesson transition `LOCAL → SENDING → SYNCED` within seconds, then becomes read-only.

**Independent Test**: log in, create + complete a lesson, tap the new button while online, verify pill transitions and read-only lock.

- [X] T010 [US1] Refactor `src/services/exportService.ts` — extract `buildCollection(lesson: LessonWithDetails): CollectionSubmission` as a named non-private export. Existing `buildEnvelope()` now calls the extracted helper so behavior is unchanged; `__buildEnvelopeForTest` still works. No change to spec 005 output. Reason: `syncService` reuses the same serialization.
- [X] T011 [US1] Create `src/services/syncService.ts` — object literal with `enqueue`, `countPending`, `runOnce` happy path (HTTP 200 + `accepted[]` → `SYNCED` + `synced_at = response.server_now`, `sync_attempt_count = 0`, `sync_next_attempt_at = NULL`). Per `contracts/sync-service.md`. Assemble request body via `buildCollection` + envelope scaffold from `exportService`. Use `apiClient.postWithTimeout('/sync/batch', envelope, 30_000)`.
- [X] T012 [US1] Create `src/contexts/SyncProvider.tsx` — context owning `{ pending, sending, lastError, retryNow }`. On mount: register `AppState` + `NetInfo` listeners; start 30 s foreground timer. Guard every trigger on `useAuth().isAuthenticated && !useAuth().isLoading` (per CLAUDE.md §10 FOIC rule). Only implements the happy-path trigger → `syncService.runOnce()` for US1.
- [X] T013 [US1] Create `src/hooks/useSyncQueue.ts` — consumer hook that reads `SyncContext` and throws outside provider. Mirror the shape of `src/hooks/useAuth.ts`.
- [X] T014 [US1] Wrap `<SyncProvider>` in `app/_layout.tsx` — place between `<AuthProvider>` (outer) and `<ThemeProvider>` (inner), so sync has auth context and theme wraps downstream screens.
- [X] T015 [US1] Add "Enviar pra Nuvem" button in `app/lesson/[id].tsx` — visible only when `useAuth().isAuthenticated && lesson.status === 'COMPLETED' && lesson.sync_status === 'LOCAL'` (FR-010). On press: `await syncService.enqueue(id)` then the provider fires `runOnce()`. On transition to SYNCED, show `Alert.alert('Sucesso', 'Enviado para a nuvem')` (per the Terminology note above — "toast" = `Alert.alert` in MVP).
- [X] T016 [US1] Disable all inputs in `app/lesson/[id].tsx` when `lesson.sync_status === 'SYNCED'` — extends the existing COMPLETED lock logic (FR-012). Ensure no visual regression when the row is still COMPLETED-but-LOCAL.
- [X] T017 [P] [US1] Unit test `tests/unit/syncService.test.ts` — happy path: seed one `QUEUED` row, mock `apiClient.postWithTimeout` to return `{ accepted: [id], rejected: [], server_now }`; run `syncService.runOnce()`; assert row is now `SYNCED` with `synced_at = server_now` and `sync_attempt_count = 0`.
- [X] T018 [P] [US1] E2E test `tests/e2e/sync-online.spec.ts` — log in, create + complete lesson, tap button, assert button disappears after mocked 200 accept. Landed via dev-only `window.__e2e` harness (`src/testing/e2eHarness.ts`) which exposes services for direct DB priming. Passing.
  1. The number inputs are disabled (FR-012).
  2. The "Exportar JSON" button is still visible and tappable **after** the row is SYNCED (FR-011 regression guard — export must remain available in all states).

**Checkpoint**: US1 independently deployable. A logged-in collector can send a single lesson online end-to-end.

---

## Phase 4 — User Story 2: Offline Queue and Eventual Send (P1)

**Goal**: A collector with no signal taps "Enviar pra Nuvem"; submissions queue; when signal returns, they batch-send automatically and the Home badge + `/sync` screen reflect state accurately.

**Independent Test**: airplane mode ON → tap button → status `QUEUED`; airplane mode OFF → status `SYNCED` within 30 s without manual action.

- [X] T019 [US2] Extend `syncService.runOnce` in `src/services/syncService.ts` to handle the network-failure branch: on `status === 0` (timeout / offline) or `5xx`, revert sent ids to `QUEUED` with `sync_attempt_count += 1` and `sync_next_attempt_at` scheduled via FR-030 schedule. Implement the FR-030 delay helper `computeBackoffMs(attemptCount: number): number` (30s → 30min ceiling).
- [X] T020 [US2] Add `syncService.retryNow(lessonIds?: string[])` in `src/services/syncService.ts` — resets `sync_attempt_count = 0`, `sync_next_attempt_at = NULL` for the given ids (or all current QUEUED for the user when omitted). Follow with a `runOnce()` invocation by the provider.
- [X] T021 [US2] Add `syncService.listForSyncScreen(collectorUserId)` in `src/services/syncService.ts` — returns `{ pending: [...], history: [] }` (history stub for now; filled in US5). Pending query per `data-model.md §3` — includes `QUEUED | SENDING | REJECTED`, ordered SENDING → QUEUED → REJECTED, then `client_created_at DESC`.
- [X] T022 [US2] Wire NetInfo-driven resume in `src/contexts/SyncProvider.tsx` — when `NetInfo.addEventListener` fires `isConnected: true`, call `runOnce()` immediately (don't wait for the 30 s timer). Keep the existing AppState and timer triggers.
- [X] T023 [US2] Provider exposes `pending` count using `syncService.countPending(user.id)` — recompute after every `runOnce`, `enqueue`, `retryNow`. React state updates flow through `useSyncQueue`.
- [X] T024 [P] [US2] Create `src/components/SyncBadge.tsx` — small upload icon + count badge. Renders nothing when `pending === 0` (FR-014 scenario 3). Tapping navigates to `/sync`. Style via `useTheme()` — use `theme.colors.primary` for the badge bg when `pending > 0`.
- [X] T025 [P] [US2] Mount `<SyncBadge />` in the Home header inside `app/(tabs)/index.tsx` next to any existing header adornments (auth indicator from spec 006). Only render when `useAuth().isAuthenticated`.
- [X] T026 [P] [US2] Create `src/components/PendingSubmissionRow.tsx` — list row for `/sync` showing topic + date + status pill + action area that varies by status:
  - `QUEUED` → "Retry agora" button (calls `onRetry(lesson.id)`).
  - `SENDING` → disabled spinner, no action button.
  - `REJECTED` → read-only red indicator with `sync_error`; **no** retry button per FR-013 (rejections are permanent in MVP).
  Takes `{ lesson, onRetry }` as props.
- [X] T027 [US2] Create screen `app/sync/index.tsx` — uses `useSyncQueue` + `useFocusEffect` (not `useEffect`, per CLAUDE.md §8) to load `syncService.listForSyncScreen(user.id)`. Render `FlatList` of `PendingSubmissionRow`. Empty-state placeholder: "Nenhuma submissão pendente" (refined in US5).
- [X] T028 [P] [US2] Unit test `tests/unit/syncService.test.ts` (same file as T017) — 5 offline items flow: seed 5 rows as QUEUED, mock `postWithTimeout` to resolve once with all accepted; assert only 1 `apiClient.postWithTimeout` call (batching, FR-021) and all 5 transition to SYNCED.
- [X] T029 [P] [US2] Unit test in same file — boot reconciliation: seed a row as SENDING, run the reconciliation UPDATE from `client.ts`, assert the row is QUEUED. (Pairs with T005.)
- [X] T030 [P] [US2] Unit test in same file — network failure revert: mock `postWithTimeout` to return `{ data: null, error: 'Sem conexão', status: 0 }`; assert rows return to QUEUED, `sync_attempt_count = 1`, `sync_next_attempt_at` ≈ now + 30s (within a 1 s tolerance using fake timers).
- [X] T031 [P] [US2] E2E test `tests/e2e/sync-badge.spec.ts` — 3 QUEUED items primed via harness → badge shows "3 submissões pendentes" → mocked accept-all + runOnce drains → badge hidden. Passing.

**Checkpoint**: US2 independently deployable. Offline queueing works, NetInfo-driven resume works, badge + `/sync` list reflect state.

---

## Phase 5 — User Story 3: Retry with Exponential Backoff (P1)

**Goal**: Failed sends retry with backoff (30s → 30min). 4xx rejections are permanent with the server message shown. 429 honors `Retry-After`. 401 clears the JWT and shows a session-expired toast.

**Independent Test**: simulate 503 for first 3 attempts, then 200 — retries at 30s, 1min, 2min; 4th attempt succeeds; `sync_attempt_count` reset to 0.

- [X] T032 [US3] Implement `parseRetryAfter(header: string | null, now: Date): number | null` in `src/services/syncService.ts` — integer seconds (→ `N * 1000`) and RFC 7231 IMF-fixdate (→ `Date.parse(header) - now.getTime()`). Clamp to `[0, 30 * 60 * 1000]`. Export for unit tests.
- [X] T033 [US3] Extend `syncService.runOnce` result classification in `src/services/syncService.ts` to cover the full matrix in `contracts/sync-service.md`: per-item rejections (`REJECTED` when `code ∉ {rate_limited, unauthenticated}`); 429 with `Retry-After` → `parseRetryAfter` or fallback FR-030; 401 → clearJwt, revert to QUEUED, emit toast via provider; 4xx batch-level (except 401/429) → mark all sent ids REJECTED with server message.
- [X] T034 [US3] Add red error banner in `app/lesson/[id].tsx` for `lesson.sync_status === 'REJECTED'` (FR-013) — show `lesson.sync_error` verbatim. Replace the "Enviar pra Nuvem" button with a read-only indicator ("Rejeitada — fale com o coordenador"). No re-send option.
- [X] T035 [US3] Add 401 toast wiring in `src/contexts/SyncProvider.tsx` — when `runOnce` reports a 401, show `"Sessão expirada — entre novamente para sincronizar"` using the project's existing toast surface (check `app/login.tsx` and `settings.tsx` for the conventional `Alert.alert` vs inline banner; follow whichever exists). JWT is cleared by `apiClient`'s existing 401 path — don't duplicate.
- [X] T036 [P] [US3] Unit test in `tests/unit/syncService.test.ts` — backoff schedule: loop attempts 1..6, assert `computeBackoffMs` returns 30_000 / 60_000 / 120_000 / 300_000 / 900_000 / 1_800_000. Attempt 10 also returns 1_800_000 (ceiling).
- [X] T037 [P] [US3] Unit test — 429 with integer `Retry-After: 60` → `sync_next_attempt_at` ≈ now + 60s (fake timer; clamped; tolerance 1 s).
- [X] T038 [P] [US3] Unit test — 429 with IMF-fixdate `Retry-After: Sun, 06 Nov 1994 08:49:37 GMT` → `parseRetryAfter` returns the delta (clamped to 30 min or 0 in the past case).
- [X] T039 [P] [US3] Unit test — 429 `Retry-After` absent → falls back to FR-030 schedule.
- [X] T040 [P] [US3] Unit test — 400 with per-item rejection → row becomes REJECTED; `sync_error` contains both the `code` and the `message` joined as `"${code}: ${message}"`; `sync_attempt_count` does NOT increment.
- [X] T041 [P] [US3] Unit test — 401 response → `apiClient.clearJwt` spy fired, items revert to QUEUED (not REJECTED), `runOnce` resolves without throwing, provider emits toast message.
- [X] T042 [P] [US3] Unit test — `apiClient.postWithTimeout` with a `fetch` that never resolves → after 30 s (fake timer) the call resolves with `{ status: 0, error: 'Sem conexão' }` and `AbortController.abort` was called exactly once.
- [X] T043 [P] [US3] E2E test `tests/e2e/sync-rejected.spec.ts` — mocked `/sync/batch` rejects all with `code: invalid_payload, message: "Professor inválido"`; detail screen shows "Rejeitada pelo servidor" banner + server message; "Enviar pra Nuvem" button removed. Passing.

**Checkpoint**: US3 independently deployable. All error paths are exercised by unit tests and the visible REJECTED flow has an E2E.

---

## Phase 6 — User Story 4: Pull Catalog from Server (P1)

**Goal**: Logged-in collectors see the latest series/topics/professors from the server in their dropdowns, refreshed on login, on 1-hour foreground timer, and on pull-to-refresh. Offline is silent for auto triggers and toast-visible for manual triggers.

**Independent Test**: add a new topic on the server via direct DB insert; open the app logged in + online; within 60 s the topic appears in the topic selector.

- [X] T044 [US4] Create `src/services/catalogSyncService.ts` — object literal implementing `pullNow(trigger)`, `getLastSyncAt()`, `resetCursor()` per `contracts/catalog-service.md`. Read cursor from `AsyncStorage` key `@eb-insights/last-catalog-sync`. Uses `apiClient.getWithTimeout('/catalog' + qs, 30_000)`. Returns `CatalogPullResult` (never throws).
- [X] T045 [US4] Implement upsert SQL in `src/services/catalogSyncService.ts` — single `BEGIN ... COMMIT` transaction running the three `INSERT ... ON CONFLICT(id) DO UPDATE` statements for `lesson_series`, `lesson_topics`, `professors` per `data-model.md §6`. Advance `last_catalog_sync` to `response.server_now` only if the transaction commits. Do NOT check `is_pending` client-side.
- [X] T046 [US4] Wire `catalogSyncService.resetCursor()` into `authService.logout` in `src/services/authService.ts` so the next login starts fresh.
- [X] T047 [US4] Create `src/hooks/useCatalogSync.ts` — consumes the existing `SyncContext` (not a new provider — catalog side-effects live in `SyncProvider`). Returns `{ lastSyncAt, isPulling, pullNow }`. **Prerequisite**: extend `SyncContext` in `src/contexts/SyncProvider.tsx` to also expose `lastSyncAt: string | null`, `isPulling: boolean`, and `pullNow: (trigger: CatalogPullTrigger) => Promise<CatalogPullResult>` — T048 writes the producers, T047 just reads them.
- [X] T048 [US4] In `src/contexts/SyncProvider.tsx` add auto-pull side-effects: (a) post-login transition (`isAuthenticated` false → true) → `catalogSyncService.pullNow('auto')` once; (b) `AppState` → `'active'` → if `getLastSyncAt` is null or older than 1 hour, call `pullNow('auto')`. Log-only on failure; never toast for auto.
- [X] T049 [P] [US4] Wire pull-to-refresh in `app/series/index.tsx` — use `useCatalogSync().pullNow('manual')`; on non-ok result, show toast per FR-045 matrix (`'Sem conexão — usando dados locais'` / server error / `'Entre para atualizar o catálogo'`). Reuse the existing toast surface from T035.
- [X] T050 [P] [US4] Same wiring in `app/topics/index.tsx`. **N/A** — no `app/topics/index.tsx` exists in this app (only `[id].tsx` and `new.tsx`). Topics are nested under series in this architecture; there is no standalone topics list screen to add pull-to-refresh to. Task closed without file changes.
- [X] T051 [P] [US4] Same wiring in `app/professors/index.tsx`.
- [X] T052 [P] [US4] Unit test `tests/unit/catalogSyncService.test.ts` — first-run (no cursor) fires `GET /catalog` without `since`; subsequent runs send `?since=<iso>`; cursor advances only on successful transaction; partial failure leaves the cursor at prior value.
- [X] T053 [P] [US4] Unit test same file — upsert idempotency: run the same payload twice, assert row counts unchanged and no duplicate ids.
- [X] T054 [P] [US4] Unit test same file — `logout()` clears the cursor (spy on `AsyncStorage.removeItem` with the right key).
- [X] T055 [P] [US4] Unit test same file — trigger-gated result: `pullNow('auto')` while unauthenticated returns `{ ok: false, skipped: true }` without firing any HTTP call; `pullNow('manual')` in the same state also returns `skipped: true` (but the calling screen will toast — that's screen-level, not service-level).
- [X] T056 [P] [US4] E2E test `tests/e2e/catalog-pull.spec.ts` — three scenarios: (1) online manual pull upserts catalog + advances cursor; (2) offline manual pull returns `{ok:false, offline:true}` + cursor unchanged; (3) unauthenticated pull returns `{skipped:true}` with zero HTTP hits. Driven via `catalogSyncService.pullNow('manual')` through the harness since RefreshControl pull-to-refresh gestures aren't reliably reproducible in Playwright web. All 3 passing. Toast path (`Alert.alert`) remains no-op on web but is covered by manual device testing per quickstart.md.

**Checkpoint**: US4 independently deployable. Catalog is fresh and the feedback rules are honored.

---

## Phase 7 — User Story 5: Visible Sync Status (P2)

**Goal**: Badge count + `/sync` screen show pending + recent history reliably. Empty-empty state renders a clean illustration.

**Independent Test**: queue 3 offline, badge shows 3, sync succeeds, badge disappears, history list shows the 3 synced rows under a green banner.

- [X] T057 [US5] Replace the history stub in `syncService.listForSyncScreen` (`src/services/syncService.ts`) with the 7-day SYNCED query from `data-model.md §3` — `WHERE sync_status = 'SYNCED' AND collector_user_id = ? AND synced_at >= datetime('now','-7 days') ORDER BY synced_at DESC LIMIT 20`.
- [X] T058 [US5] Update `app/sync/index.tsx` to render the three regions specified in FR-016 / FR-017:
  - If `pending.length > 0`: list pending (any status in `QUEUED | SENDING | REJECTED`) with `PendingSubmissionRow`.
  - If `pending.length === 0 && history.length > 0`: show green "Tudo em dia" banner at top, then history rows (read-only, muted "Enviado" indicator, no "Retry agora").
  - If `pending.length === 0 && history.length === 0`: pure empty state (existing `EmptyState` component per CLAUDE.md §9) with "Nenhuma submissão pendente."
  - REJECTED items appear in the pending region regardless of pending counts (red indicator).
- [X] T059 [US5] Create a `SyncHistoryRow.tsx` component in `src/components/SyncHistoryRow.tsx` rendering `topic + date + professor + synced_at` with a muted "Enviado" pill, distinct from `PendingSubmissionRow` (no retry button).
- [X] T060 [P] [US5] E2E test `tests/e2e/sync-screen.spec.ts` — anonymous state + authenticated-empty state both landed (2/2 passing). Uses `_support/auth.ts` (localStorage priming via `addInitScript`) and `_support/apiMock.ts` (Playwright `page.route()` intercept of `/sync/batch` and `/catalog`). No real backend required.
- [X] T061 [P] [US5] E2E test `tests/e2e/sync-screen-states.spec.ts` — 3 QUEUED → harness runOnce with mocked accept-all → /sync shows "Tudo em dia" banner + 3 "Enviado" history rows. Passing.
- [X] T062 [P] [US5] Same file — REJECTED permanence: harness primes QUEUED → mocked reject-all → /sync shows the REJECTED row's error message in the pending region; "Tudo em dia" banner hidden; countPending = 0 while REJECTED row persists. Passing.

**Checkpoint**: US5 independently deployable. The visible-status surface is complete.

---

## Phase 8 — User Story 6 (P3, post-MVP)

Per spec § User Story 6 and § Out of Scope, **read-back of moderation status** is intentionally deferred. No tasks generated here. Reopen in a follow-up spec when coordinator moderation UX matures.

---

## Phase 9: Polish & Cross-Cutting

- [X] T063 Run `npm test` and verify zero failures. Fix any regression in pre-existing suites touched by this spec's changes (particularly `exportService.test.ts` after the T010 refactor).
- [X] T064 Run `npm run test:e2e` against an Expo web build on port 8082 (CLOSED 2026-04-19: full suite 31/31 passing, 1 skipped (real-backend soak gated on SOAK_REAL=1). Fixed 6 pre-existing flakes along the way — `getByLabelText` → `getByLabel` in `auth-login.spec.ts`; switch selectors disambiguated via `getByLabel` in `includes-professor-toggle.spec.ts` and `settings-default-toggle.spec.ts`; tab name `Dashboard` → `Painel` in `app-loads.spec.ts`; `seed-and-lesson-detail.spec.ts` now polls the harness DB for materialization instead of racing the seed alert. New specs added: `theme-persistence.spec.ts`, `export-v2-payload.spec.ts`, `dashboard-render.spec.ts`, `sync-soak.spec.ts`.)
- [ ] T065 Manual verification pass against every step of `specs/008-offline-sync-client/quickstart.md` on iOS simulator or web build. Document any deviations in a short "Verification Notes" addendum at the bottom of quickstart.md.
- [X] T066 Lint + type check: `npm run lint` and `npx tsc --noEmit` must pass cleanly. No new `any`, no `// @ts-ignore`, no `as unknown as T` (CLAUDE.md §1 and memory file `feedback_006_retro.md`).
- [X] T067 Review `src/services/syncService.ts` and `src/services/catalogSyncService.ts` for any fire-and-forget promises — every `async` call must have `.catch(console.error)` or be inside a `try/catch` (CLAUDE.md §10).
- [X] T068 Validate SC-001 zero data loss (CLOSED 2026-04-19 for the mocked-backend leg by Playwright spec `tests/e2e/sync-soak.spec.ts`: seeds 50 completed LOCAL lessons, enqueues them, loops `syncService.runOnce` until `countPending === 0`, then asserts every row ended as SYNCED within the 5-min budget. Drained in ~42s against the mocked backend, proving the client batch+state-machine drains a realistic workload correctly. The **real-backend + toxiproxy 4-h physical soak** documented in `quickstart.md §10` remains a manual pre-release step; a `SOAK_REAL=1` variant of the same spec is wired up to run against `localhost:3000` when the server is up.)
- [ ] T069 Validate SC-004 (battery <1 %/h with empty queue). No automated instrumentation in MVP. Manual procedure: charge device to 100 %, background the app on the Home screen with 0 pending items, wait 1 h, read battery percentage. If drop > 1 %, profile with Expo DevTools → Performance monitor and identify the culprit (likely the 30 s foreground timer; consider doubling the interval when `pending === 0`). Record result in quickstart.md Verification Notes addendum.

---

## Incidental discoveries while authoring E2E tests

- **SQLite concurrent-transaction race (FIXED — 2 layers)**:
  1. `SyncProvider` fired `pullCatalog('auto')` + `runSyncLoop()` in parallel on the false→true auth transition, and a second instance of the same race in the AppState 'active' handler. `expo-sqlite` on web cannot serialize concurrent `withTransactionAsync` calls. Fix: sequence the two calls (await catalog pull before the sync drain). File: `src/contexts/SyncProvider.tsx`.
  2. Even after sequencing inside `SyncProvider`, the periodic 30s foreground timer and the `NetInfo` connectivity listener can still race a harness-triggered `runOnce` or a screen-triggered `retryNow`. Fix: added a shared global DB mutex at `src/db/mutex.ts` (`withDbMutex(task)`) and wrapped the top-level DB entry points in `syncService.runOnce` and `catalogSyncService.upsertCatalog`. All transaction work is now serialized FIFO.
- **`Alert.alert` is a no-op on `react-native-web`** (see `node_modules/react-native-web/dist/exports/Alert/index.js`). Any E2E test that waited on a dialog event fired from `Alert.alert` will never resolve. Future E2E authors should treat alerts as invisible on web and find a DOM-level sync point instead (e.g., assert the pressed button re-enables after async work).
- **Dev-only E2E harness**: `src/testing/e2eHarness.ts` exposes service object-literals on `window.__e2e` when `Platform.OS === 'web' && __DEV__`. Registered in `app/_layout.tsx` after DB init. Tests use `tests/e2e/_support/harness.ts` helpers (`waitForHarness`, `primeMinimalCatalog`, `primeCompletedLesson`) to seed DB state directly, bypassing the UI. This unblocked all 6 previously-deferred E2E tests.

---

## Dependencies

```
Phase 1 (Setup)                  T001, T002
  ↓
Phase 2 (Foundational)           T003 → T004 → T005 (sequential; migration, invocation, reconciliation)
                                 T006, T007, T008, T009 (parallel after T005)
  ↓
Phase 3 (US1)                    T010 → T011 → T012 → T013 → T014 → T015 → T016
                                 T017 [P], T018 [P] after T016
  ↓
Phase 4 (US2)                    T019 → T020 → T021 → T022 → T023 (sequential)
                                 T024 [P], T025 [P], T026 [P] after T023
                                 T027 after T026
                                 T028..T031 [P] after T027
  ↓
Phase 5 (US3)                    T032 → T033 (sequential)
                                 T034, T035 after T033
                                 T036..T043 [P] after T035
  ↓
Phase 6 (US4)                    T044 → T045 → T046 → T047 → T048 (sequential)
                                 T049..T056 [P] after T048
  ↓
Phase 7 (US5)                    T057 → T058 → T059 (sequential)
                                 T060..T062 [P] after T059
  ↓
Phase 9 (Polish)                 T063..T067 (serial; T064 depends on T063 green)
```

**Story-level parallelism**: US1 through US4 all target overlapping files (`syncService.ts`, `SyncProvider.tsx`, `apiClient.ts`, `app/lesson/[id].tsx`), so they cannot be done in parallel by separate agents without merge pain. Within each story, the `[P]` tasks are safe to parallelize.

---

## Parallel Execution Examples

### Phase 2 (after T005)

All four can run concurrently — independent files, no state sharing:

```
T006 extend src/types/lesson.ts
T007 extend src/services/apiClient.ts
T008 extend src/services/lessonService.ts
T009 create tests/unit/migration_008.test.ts
```

### Phase 4 UI components (after T023)

Three files, three agents:

```
T024 create src/components/SyncBadge.tsx
T025 mount badge in app/(tabs)/index.tsx
T026 create src/components/PendingSubmissionRow.tsx
```

### Phase 5 error-path unit tests (after T035)

All new test assertions in the existing `tests/unit/syncService.test.ts`. Run them in parallel drafts, then resolve conflicts in a single merge — each adds an independent `describe` block:

```
T036 backoff schedule
T037 429 integer Retry-After
T038 429 HTTP-date Retry-After
T039 429 missing Retry-After
T040 per-item 400 → REJECTED
T041 401 handling
T042 30s AbortController timeout
```

### Phase 6 screen wiring (after T048)

Three screens, three agents:

```
T049 pull-to-refresh in app/series/index.tsx
T050 pull-to-refresh in app/topics/index.tsx
T051 pull-to-refresh in app/professors/index.tsx
```

---

## Implementation Strategy

### MVP Scope (spec's P1 stories, ship together)

**US1 + US2 + US3 + US4** are all P1 per spec.md — they are the MVP. Ship them as a single release: without offline queueing (US2), online-only send (US1) is misleading on church Wi-Fi; without backoff (US3), the offline queue burns battery; without catalog pull (US4), collectors see stale dropdowns. The spec treats them as a coupled package.

**Recommended order inside the MVP batch**:

1. Setup + Foundational (T001–T009). Required by everything.
2. US1 happy path (T010–T018). Proves the send pipeline end-to-end with the simplest case; de-risks the rest.
3. US2 offline resilience (T019–T031). Builds the batch + NetInfo + UI surfaces on top of US1's foundation.
4. US3 error handling (T032–T043). Finishes the error-matrix; makes US1+US2 production-ready.
5. US4 catalog pull (T044–T056). Independent of sync-service error work; can be interleaved with US3 by a different engineer.

### Post-MVP

6. **US5 (P2) — Visible Sync Status polish (T057–T062)**. Banner + history. Ships in the next release; MVP is usable without it (pending list alone already works from US2).
7. **US6 deferred**. See Phase 8.

### Validation at each checkpoint

After each user story's Checkpoint line, run:

```
npm test                       # unit + migration tests for the story
npm run test:e2e               # E2E for that story's screens
# Manual: follow the matching section of quickstart.md
```

Fail fast: if any previous story's tests regress, stop and fix before advancing — the test suite is the gate per CLAUDE.md §16 ("Always test before committing").
