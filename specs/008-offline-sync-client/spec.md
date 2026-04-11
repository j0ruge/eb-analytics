# Feature Specification: Offline-First Sync Client

**Feature Branch**: `008-offline-sync-client`
**Created**: 2026-04-11
**Status**: Draft
**Input**: Roadmap item #4 — "Sincronizar o SQLite da aplicação com a API do backend, o SQLite precisa de cache offline, a igreja tem internet muito instável"

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
3. **Given** the user pulls down on a series/topic/professor list, **Then** the catalog sync runs manually, regardless of the last-sync timestamp.
4. **Given** I am offline, **Then** catalog sync silently fails and the dropdowns use whatever is cached locally. No error toast — offline is a normal state.

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
- **FR-005**: `sync_status` is distinct from `LessonStatus` (UX-facing: IN_PROGRESS, COMPLETED, EXPORTED, SYNCED). The two live side by side; the existing `status` column is NOT replaced.
- **FR-006**: A migration runs at startup, applied idempotently via `PRAGMA table_info` check (following the pattern established in spec 003).

#### UI / UX

- **FR-010**: The lesson detail screen (`app/lesson/[id].tsx`) MUST show a new button "Enviar pra Nuvem" when: (a) user is logged in, (b) lesson status is `COMPLETED`, (c) `sync_status` is `LOCAL`.
- **FR-011**: The existing "Exportar JSON" button MUST remain available in ALL cases (logged or not, any status) — it always works via share sheet per spec 005.
- **FR-012**: When `sync_status = SYNCED`, the detail screen MUST disable ALL inputs (extends the lock-after-COMPLETED logic from spec 001 FR-008 to also cover SYNCED).
- **FR-013**: When `sync_status = REJECTED`, the detail screen MUST show a red banner with the error from `sync_error` and the "Enviar pra Nuvem" button is replaced with a read-only indicator (no re-send — rejection is final for MVP).
- **FR-014**: The Home header MUST show a discrete upload icon + badge with the count of submissions in `QUEUED | SENDING`. Tapping it navigates to `/sync`.
- **FR-015**: A new screen `app/sync/index.tsx` (or upgrade of existing if present) lists all pending submissions with status, error messages, and a "Retry agora" action.

#### Sync Service

- **FR-020**: A new service `src/services/syncService.ts` implements the send loop. It is NOT a background task (no platform-level scheduling). It runs:
  - On app foreground (`AppState.active`).
  - Immediately when a new submission enters `QUEUED`.
  - On a timer while the app is open (every 30 seconds, checking for items whose `sync_next_attempt_at` has passed).
- **FR-021**: The loop groups up to 20 `QUEUED` submissions into a single `POST /sync/batch` call. The batch size is configurable via constant.
- **FR-022**: Before sending, the loop transitions items from `QUEUED → SENDING` in a transaction to prevent double-sending from concurrent invocations.
- **FR-023**: On success, items transition to `SYNCED` and `sync_attempt_count` resets to 0.
- **FR-024**: On failure (network or 5xx), items revert to `QUEUED`, `sync_attempt_count` increments, and `sync_next_attempt_at` is scheduled using the backoff schedule in FR-030.
- **FR-025**: On a 4xx error from a specific item in the rejected list, that item moves to `REJECTED` and the server's error message is stored in `sync_error`.
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
  - On pull-to-refresh gesture in series/topic/professor list screens.
- **FR-041**: The pull calls `GET /catalog?since=<last_catalog_sync>` (or no `since` on first run). `last_catalog_sync` is stored in AsyncStorage.
- **FR-042**: Upsert logic: for each returned item, insert if missing (by id), update if `updatedAt` is newer. Deletion is NOT handled in MVP — deletions on the server are left as stale local rows, visible to the user until the next full sync.
- **FR-043**: Items with `isPending: true` are filtered OUT of the default `/catalog` response by the server (spec 007 FR-030); collectors never see pending items in their dropdowns.
- **FR-044**: If the user is NOT logged in, catalog pull is silently skipped. The local catalog (already synced before logout, or manually entered via the existing CRUD screens in specs 002 and 003) is used as-is.

### Key Entities *(include if feature involves data)*

- **SyncQueue**: Not a separate table — it is a query: `SELECT * FROM lessons_data WHERE sync_status IN ('QUEUED', 'SENDING') ORDER BY sync_next_attempt_at ASC NULLS FIRST`.
- **SyncResult**: `{ accepted: string[], rejected: Array<{ id: string, reason: string }> }` — shape returned by the server, mirrored in the client.
- **SyncState**: In-memory state held by `syncService` — current loop timer, whether a send is in-flight, last error.
- **CatalogSyncState**: `{ last_catalog_sync: string | null }` in AsyncStorage.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **Zero Data Loss Under Flaky Network**: A 4-hour test with simulated 30% packet loss results in 0 lost submissions and 0 duplicates on the server.
- **SC-002**: **Recovery Time**: After a network outage ends, pending submissions are sent within 30 seconds (next scheduled retry or next app foreground).
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
