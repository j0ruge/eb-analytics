# Feature Specification: Offline-First Sync Client

**Feature Branch**: `008-offline-sync-client`
**Created**: 2026-04-11
**Status**: Draft
**Input**: Roadmap item #4 — "Sincronizar o SQLite da aplicação com a API do backend, o SQLite precisa de cache offline, a igreja tem internet muito instável"

## Clarifications

### Session 2026-04-18

- Q: How should the client handle HTTP 429 (Too Many Requests) from `POST /sync/batch`? → A: Treat as transient (revert to `QUEUED` + backoff). Honor `Retry-After` header (seconds or HTTP-date) as the next-attempt delay when present; fall back to the FR-030 schedule otherwise. Clamp to 30 min.
- Q: What HTTP request timeout should the client use for `POST /sync/batch` and `GET /catalog`? → A: 30 seconds for both endpoints. A timeout is treated as a network failure (FR-024 revert-and-backoff).
- Q: Should the client enforce a maximum pending-queue depth? → A: No cap for MVP. Realistic usage is <50 pending items (collectors produce ~4–8 lessons/week). Documented in Assumptions; revisit if telemetry shows runaway growth.
- Q: When catalog sync fails, should the app show feedback to the user? → A: Silent for automatic syncs (login, foreground, 1-hour timer). On manual pull-to-refresh, show a toast: "Sem conexão — usando dados locais" when offline, or the server's error message on other failures.
- Q: What does `/sync` show when there are 0 pending submissions? → A: Recent `SYNCED` items (last 20 within the past 7 days) with a green "Tudo em dia" banner at the top. When history is also empty (no `SYNCED` in 7 days and no pending), show the pure empty state with illustration + "Nenhuma submissão pendente."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Send Single Submission Online (Priority: P1)

As a logged-in Collector with working Wi-Fi at the end of a class, I want to tap "Enviar pra Nuvem" and have my completed lesson reach the server immediately so that I can walk out of church knowing my data is safe.

**Why this priority**: Happy-path sync is the reason this spec exists. Everything else is error handling around it.

**Independent Test**: Log in, complete a lesson, tap "Enviar pra Nuvem" while online. Verify the row transitions `LOCAL → SENDING → SYNCED` within a few seconds and becomes read-only.

**Acceptance Scenarios**:

1. **Given** I am logged in, on a completed lesson, with a working connection, **When** I tap "Enviar pra Nuvem", **Then** the lesson's `sync_status` goes `LOCAL → SENDING → SYNCED`, all inputs on the detail screen become disabled, and a success toast appears.
2. **Given** the request succeeds, **Then** the entire record is read-only from that point forward. No edits possible, even if the app restarts.
3. **Given** I am NOT logged in, **When** I view the same completed lesson, **Then** the "Enviar pra Nuvem" button is hidden. Only "Exportar JSON" (share sheet) is shown.

---

### User Story 2 - Offline Queue and Eventual Send (Priority: P1)

As a Collector in the church basement with no signal, I want to tap "Enviar pra Nuvem" and have the app queue my submission, then send it automatically when signal returns.

**Why this priority**: Church internet is unreliable. This is the single most important resilience feature.

**Independent Test**: Enable airplane mode. Tap "Enviar pra Nuvem". Verify status becomes `QUEUED`. Disable airplane mode. Verify status becomes `SYNCED` within 30 seconds without any user action.

**Acceptance Scenarios**:

1. **Given** no network and 1 queued submission, **When** the network returns and the app is foregrounded, **Then** the sync service sends the submission and status becomes `SYNCED`.
2. **Given** 5 submissions are queued offline, **When** the network returns, **Then** all 5 are sent in a single `POST /sync/batch` call (batched).
3. **Given** the network fails mid-batch (5xx or connection drop), **Then** the submissions revert to `QUEUED` and retry after backoff.

---

### User Story 3 - Retry with Exponential Backoff (Priority: P1)

As the sync service, I want to retry failed sends with increasing delays so that a flaky network does not burn battery or hammer the server.

**Why this priority**: A naive "retry every 5 seconds" loop destroys the user's battery. Backoff is mandatory.

**Independent Test**: Simulate a server returning 503 for the first 3 attempts, then 200. Verify the retries happen at 30s, 1min, 2min intervals, and the 4th attempt succeeds.

**Acceptance Scenarios**:

1. **Given** a transient 5xx or network error, **Then** the submission stays in `QUEUED` and the next retry happens after 30s, then 1min, 2min, 5min, 15min, 30min (capped). Reset to 30s on success.
2. **Given** a 4xx error (except 401) from the server, **Then** the submission moves to `REJECTED` with the server's error message stored in `sync_error`. No further retry.
3. **Given** a 401 error, **Then** the submission stays `QUEUED`, the JWT is cleared, and the user sees a toast "Sessão expirada — entre novamente para sincronizar".

---

### User Story 4 - Pull Catalog from Server (Priority: P1)

As a logged-in Collector, I want my app to automatically download the latest series, topics, and professors from the server so that my dropdowns are always up to date.

**Why this priority**: Without fresh catalog, collectors can't select the correct topic for the week. Must ship alongside send sync.

**Independent Test**: Add a new topic via direct DB insert on the server. Open the app (logged in, online). Verify the new topic appears in the topic selector within 30 seconds.

**Acceptance Scenarios**:

1. **Given** I log in successfully for the first time, **Then** the app immediately calls `GET /catalog` (no `since`) and upserts all returned items into local `lesson_series`, `lesson_topics`, `professors` tables.
2. **Given** subsequent app opens, **Then** the app calls `GET /catalog?since=<last_sync>` and upserts only modified items.
3. **Given** the user pulls down on a series/topic/professor list, **Then** the catalog sync runs manually, bypassing the 1-hour throttle used by automatic triggers. The `?since=<last_catalog_sync>` cursor is still sent so the response remains a delta (efficiency). If the user wants a full refresh, log out and log in again (which clears the cursor per FR-044).
4. **Given** an automatic catalog sync (post-login, foreground timer) runs while I am offline, **Then** it silently fails and the dropdowns use whatever is cached locally. No error toast — offline is a normal state for automatic paths.
5. **Given** I pull to refresh a series/topic/professor list while offline, **Then** the app shows a toast `"Sem conexão — usando dados locais"` and the existing cached dropdown entries remain usable. On a non-offline server failure (4xx/5xx), the toast shows the server's error message instead.

---

### User Story 5 - Visible Sync Status (Priority: P2)

As a Collector, I want to see at a glance how many submissions are pending so that I don't worry whether my data has been sent.

**Why this priority**: Mental comfort and trust in the system. Ships after the core sync works.

**Independent Test**: Queue 3 submissions offline. Verify the Home header shows a badge "3". Sync succeeds. Verify the badge disappears.

**Acceptance Scenarios**:

1. **Given** N submissions in `QUEUED` or `SENDING`, **Then** the Home header shows a badge with N and an upload icon.
2. **Given** I tap the badge, **Then** I navigate to `/sync` where each pending submission is listed with its status, error (if any), and a "Retry agora" button.
3. **Given** the badge counter is 0, **Then** the icon is hidden or shown in a neutral color.
4. **Given** a submission is `REJECTED`, **Then** it appears in `/sync` with a red indicator and the full error message from the server.

---

### User Story 6 - Read-Back Moderation Status (Priority: P3, post-MVP)

As a logged-in Collector, I want the app to periodically check whether any of my past submissions were rejected by a coordinator so that I know to revisit or discuss them.

**Why this priority**: Nice to have. Ships after everything else is stable. Can be skipped in MVP without blocking anything.

**Acceptance Scenarios**:

1. **Given** I am logged in and online, **Then** the app periodically calls `GET /collections?mine=true&since=<last>` and updates local `sync_error` or flags for any server-side rejections.
2. **Given** a rejection is detected, **Then** the submission list shows a visual indicator but the data remains locked (the user can't edit the synced copy).

---

### Edge Cases

- **EC-001 (Force-Close During SENDING)**: If the app is killed while a submission is in `SENDING`, on next open the service reverts `SENDING → QUEUED` and retries. Server idempotency (via `collections[].id`) ensures no duplicates.
- **EC-002 (Two Devices Same User)**: If the same user logs in on both a phone and a tablet and creates lessons on both, each collection has its own UUID. They become two separate server rows. Acceptable — the user knows to pick a primary device.
- **EC-003 (Login Expired Mid-Queue)**: JWT expires with 30 items pending. Service attempts first item, gets 401, clears JWT, shows toast. Queue stays intact. User logs in again and queue resumes.
- **EC-004 (Rejected Submission Still Locked)**: A submission that the server rejects (e.g., validation error) is `REJECTED` locally and still read-only. User cannot edit it to fix — must discuss with coordinator. This is intentional: editing a sent-but-rejected record would require un-locking and complex state, not worth the complexity for MVP.
- **EC-005 (User Uninstalls App with Pending Queue)**: Uninstalling wipes the device SQLite. Pending submissions are lost. This is the user's responsibility — document clearly that uninstall before sending loses data.
- **EC-006 (Catalog Conflict)**: Local catalog has a topic `X` that has been deleted or modified on the server. Pull sync overwrites the local row. No merge logic — server wins.
- **EC-007 (Server Reachable but Clock Skew)**: Client and server clocks differ by hours. `client_created_at` and `client_updated_at` may look wrong to the server, but ordering logic still works because we never compare client time to server time — only client time to client time.

## Requirements *(mandatory)*

### Functional Requirements

#### Schema & State

- **FR-001**: A new column MUST be added to `lessons_data`: `sync_status TEXT NOT NULL DEFAULT 'LOCAL'` with a CHECK constraint on `LOCAL | QUEUED | SENDING | SYNCED | REJECTED`.
- **FR-002**: A new column `sync_error TEXT NULL` stores the last error message from the server when `sync_status = REJECTED`.
- **FR-003**: A new column `sync_attempt_count INTEGER DEFAULT 0` tracks retry attempts for backoff scheduling.
- **FR-004**: A new column `sync_next_attempt_at TEXT NULL` stores the next scheduled retry time (ISO 8601).
- **FR-004a**: A new column `synced_at TEXT NULL` stores the ISO 8601 timestamp when the row transitioned into `SYNCED`. Written once at the `SENDING → SYNCED` transition; never modified thereafter. Used by FR-016 to filter the recent-history window on `/sync`.
- **FR-005**: `sync_status` is distinct from `LessonStatus` (UX-facing: IN_PROGRESS, COMPLETED, EXPORTED, SYNCED). The two live side by side; the existing `status` column is NOT replaced.
- **FR-006**: A migration runs at startup, applied idempotently via `PRAGMA table_info` check (following the pattern established in spec 003).

#### UI / UX

- **FR-010**: The lesson detail screen (`app/lesson/[id].tsx`) MUST show a new button "Enviar pra Nuvem" when: (a) user is logged in, (b) lesson status is `COMPLETED`, (c) `sync_status` is `LOCAL`.
- **FR-011**: The existing "Exportar JSON" button MUST remain available in ALL cases (logged or not, any status) — it always works via share sheet per spec 005.
- **FR-012**: When `sync_status = SYNCED`, the detail screen MUST disable ALL inputs (extends the lock-after-COMPLETED logic from spec 001 FR-008 to also cover SYNCED).
- **FR-013**: When `sync_status = REJECTED`, the detail screen MUST show a red banner with the error from `sync_error` and the "Enviar pra Nuvem" button is replaced with a read-only indicator (no re-send — rejection is final for MVP).
- **FR-014**: The Home header MUST show a discrete upload icon + badge with the count of submissions in `QUEUED | SENDING`. Tapping it navigates to `/sync`.
- **FR-015**: A new screen `app/sync/index.tsx` (or upgrade of existing if present) lists all pending submissions with status, error messages, and a "Retry agora" action.
- **FR-016**: When there are 0 pending submissions (`QUEUED | SENDING`), `/sync` MUST render:
  - A green "Tudo em dia" banner at the top, AND
  - A read-only history list of the most recent `SYNCED` items — capped at 20 rows, filtered to `synced_at >= now - 7 days` (the `synced_at` column defined in FR-004a). Each row shows topic, professor, date, and a muted "Enviado" indicator. No "Retry agora" button on these rows.
- **FR-017**: When both the pending list (`QUEUED | SENDING`) AND the 7-day `SYNCED` history are empty, `/sync` renders the pure empty state: an illustration + "Nenhuma submissão pendente." No banner. `REJECTED` items, if any, always remain listed on `/sync` regardless of the pending count (carrying their red indicator per FR-013 and User Story 5 acceptance scenario 4).

#### Sync Service

- **FR-020**: A new service `src/services/syncService.ts` implements the send loop. It is NOT a background task (no platform-level scheduling). It runs:
  - On app foreground (`AppState.active`).
  - Immediately when a new submission enters `QUEUED`.
  - On a timer while the app is open (every 30 seconds, checking for items whose `sync_next_attempt_at` has passed).
- **FR-021**: The loop groups up to 20 `QUEUED` submissions into a single `POST /sync/batch` call. The batch size is configurable via constant.
- **FR-022**: Before sending, the loop transitions items from `QUEUED → SENDING` in a transaction to prevent double-sending from concurrent invocations.
- **FR-023**: On success, items transition to `SYNCED`, `sync_attempt_count` resets to 0, `sync_next_attempt_at` is cleared to NULL, and `synced_at` is set to the current ISO 8601 timestamp (per FR-004a).
- **FR-024**: On failure (network error, 5xx, or 429), items revert to `QUEUED`, `sync_attempt_count` increments, and `sync_next_attempt_at` is scheduled using the backoff schedule in FR-030.
- **FR-024b**: Every HTTP request to `POST /sync/batch` and `GET /catalog` MUST apply a 30-second timeout. A timed-out request is classified as a network failure and follows FR-024 (revert items to `QUEUED`, increment `sync_attempt_count`, schedule next attempt per FR-030). The underlying fetch request MUST be aborted (via `AbortController` or equivalent) so the loop does not leak pending promises.
- **FR-024a**: On HTTP 429, if the response carries a `Retry-After` header (either delta-seconds or an HTTP-date), the client MUST use that value as `sync_next_attempt_at`, clamped to the FR-030 ceiling of 30 minutes. Without a `Retry-After` header, 429 falls back to the standard FR-030 schedule. `sync_attempt_count` still increments so repeated throttling eventually hits the 30-min ceiling.
- **FR-025**: On a 4xx error other than 401 or 429 from a specific item in the rejected list, that item moves to `REJECTED` and the server's error message is stored in `sync_error`.
- **FR-026**: On 401 from the batch endpoint, the JWT is cleared (via the auth service from spec 006), items revert to `QUEUED`, and the user sees a toast. No retry until re-login.
- **FR-027**: A React hook `useSyncQueue()` exposes `{ pending: number, sending: boolean, lastError: string | null, retryNow: () => Promise<void> }` for UI consumption.

#### Backoff Policy

- **FR-030**: Retry delays (attempt number → delay): 1 → 30s, 2 → 1min, 3 → 2min, 4 → 5min, 5 → 15min, 6+ → 30min (capped).
- **FR-031**: `sync_attempt_count` resets to 0 on successful send, and on manual "Retry agora".
- **FR-032**: Backoff is per-item, not global. Item A can be in backoff while item B retries immediately after entering the queue.

#### Catalog Pull

- **FR-040**: A new service `src/services/catalogSyncService.ts` implements catalog pull. It runs:
  - Immediately after successful login.
  - On app foreground if logged in and `last_catalog_sync` is older than 1 hour.
  - On pull-to-refresh gesture in series/topic/professor list screens. Manual triggers bypass the 1-hour throttle that gates the foreground-timer trigger, but still send the `?since=<last_catalog_sync>` cursor per FR-041 (delta pull, not full re-download).
- **FR-041**: The pull calls `GET /catalog?since=<last_catalog_sync>` (or no `since` on first run). `last_catalog_sync` is stored in AsyncStorage.
- **FR-042**: Upsert logic: for each returned item, insert if missing (by id), update if `updatedAt` is newer. Deletion is NOT handled in MVP — deletions on the server are left as stale local rows, visible to the user until the next full sync.
- **FR-043**: Items with `isPending: true` are filtered OUT of the default `/catalog` response by the server (spec 007 FR-030); collectors never see pending items in their dropdowns.
- **FR-044**: If the user is NOT logged in, catalog pull is silently skipped. The local catalog (already synced before logout, or manually entered via the existing CRUD screens in specs 002 and 003) is used as-is. Logout additionally clears `last_catalog_sync` so the next login performs a full first-run pull — this is the sanctioned way to force a full refresh.
- **FR-045**: Feedback on catalog sync failure is gated by the trigger:
  - **Automatic triggers** (post-login, foreground 1-hour timer) — fail silently. No toast, no banner. Dropdowns fall back to whatever is cached locally. Offline is a normal state for these paths.
  - **Manual trigger** (pull-to-refresh on a series/topic/professor list) — show a toast: `"Sem conexão — usando dados locais"` when the failure is network/offline, or the server's error message verbatim for any other failure (4xx/5xx). The pull-to-refresh indicator still dismisses normally; the toast is the only surface-level feedback.

### Key Entities *(include if feature involves data)*

- **SyncQueue**: Not a separate table — it is a query: `SELECT * FROM lessons_data WHERE sync_status IN ('QUEUED', 'SENDING') ORDER BY sync_next_attempt_at ASC NULLS FIRST`.
- **SyncResult**: `{ accepted: string[], rejected: Array<{ id: string, reason: string }> }` — shape returned by the server, mirrored in the client.
- **SyncState**: In-memory state held by `syncService` — current loop timer, whether a send is in-flight, last error.
- **CatalogSyncState**: `{ last_catalog_sync: string | null }` in AsyncStorage.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **Zero Data Loss Under Flaky Network**: A 4-hour test with simulated 30% packet loss results in 0 lost submissions and 0 duplicates on the server.
- **SC-002**: **Recovery Time**: After a network outage ends, the first batch of pending submissions is dispatched within 30 seconds (next scheduled retry or next app foreground). Total drain time scales with queue size at the FR-021 batch cap — e.g., 100 queued items drain over ~5 ticks of the 30 s loop.
- **SC-003**: **Offline Collection**: A collector can create 4 lessons offline, complete them, queue for send, travel home, and have all 4 sync successfully on the first retry after reconnecting.
- **SC-004**: **Battery Impact**: With 0 pending submissions, the sync loop consumes < 1% battery per hour (measured by Expo's app performance tools).
- **SC-005**: **Lock Correctness**: Once a submission is `SYNCED`, 100 force-closes of the app never unlock it.
- **SC-006**: **Catalog Freshness**: A new topic added to the server is visible in the app's topic picker within 60 seconds on the next app foreground (logged in, online).
- **SC-007**: **UI Feedback Correctness**: The badge count in the Home header matches `SELECT count(*) FROM lessons_data WHERE sync_status IN ('QUEUED','SENDING')` at all times, with < 1 second lag.

## Assumptions

- The backend from spec 007 is reachable over HTTPS at a URL stored in an env config or settings screen.
- `AppState` and `NetInfo` (Expo modules) are available for foreground/connectivity detection.
- `AsyncStorage` is available for non-sensitive persistence (`last_catalog_sync`).
- The current app's service pattern (object literal with async methods, spec 001 section 5 of CLAUDE.md) is followed by `syncService` and `catalogSyncService`.
- React hooks pattern (useSyncQueue) follows the existing hook conventions from `src/hooks/`.
- There is NO background task / native scheduling — sync runs only while the app is in foreground. A collector who closes the app won't sync until reopening. This is acceptable for the use case.
- **Queue depth**: Realistic pending-queue depth is under 50 items per device (collectors produce ~4–8 lessons per week; even a full month offline yields ~30 items). No hard cap is enforced on `QUEUED | SENDING` for MVP. Revisit if telemetry shows runaway growth.

## Out of Scope for MVP

- Background sync via native OS schedulers (iOS BGTaskScheduler, Android WorkManager). Future enhancement.
- Delta delete on catalog pull (deleted items on server staying cached locally). Future enhancement.
- Re-sending a rejected submission after edits (would require unlocking the record, complex state). Must-discuss feature.
- Multi-device conflict resolution for the same user (two devices create "the same" lesson). Accept duplicate rows — the coordinator can merge manually.
- Push notifications for moderation rejections. Future enhancement.

## Related Specs

- **005-export-contract-v2** — defines the payload this service sends.
- **006-auth-identity** — provides the JWT and gates "Enviar pra Nuvem" on login state.
- **007-sync-backend** — the server this client talks to.
