# Feature Specification: User Authentication & Collector Identity

**Feature Branch**: `006-auth-identity`
**Created**: 2026-04-11
**Status**: Draft
**Input**: Roadmap item #3 — "Criar um login, pois o usuário logado será o id do coletor"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Anonymous Baseline (Priority: P1)

As a Class Secretary using the app for the first time (no account, possibly no internet at install time), I want the app to work exactly as it does today — create lessons, edit, export JSON via share sheet — without any forced login wall.

**Why this priority**: Non-negotiable baseline. Blocking the app behind a login would regress the existing offline-first UX and punish users who cannot (or choose not to) reach the backend.

**Independent Test**: Install the app on a device with airplane mode on. Open it, create a lesson, complete it, export JSON. Verify every step works without prompting for login.

**Acceptance Scenarios**:

1. **Given** a fresh install with no network, **When** I open the app, **Then** I land directly on the Home screen without any login prompt.
2. **Given** I am on the Home screen and not logged in, **When** I create and complete a lesson and export, **Then** the JSON file is generated and the share sheet opens. The file contains `"collector": null` per spec 005 FR-002.
3. **Given** I have 10 local lessons from 3 months of anonymous use, **When** I later log in for the first time, **Then** none of those lessons are deleted or migrated against my will.

---

### User Story 2 - Optional Login (Priority: P1)

As a Class Secretary who has an account, I want to log in once and have the app remember me so that I can sync my future collections to the backend.

**Why this priority**: Cloud sync (spec 008) depends entirely on the user being identifiable. Without login, no submission can be attributed to a collector on the server.

**Independent Test**: From the Settings screen, tap "Entrar", enter valid credentials, tap login. Verify the user is authenticated and the Home screen shows a "Logado: X" indicator.

**Acceptance Scenarios**:

1. **Given** I am on `/settings` and not logged in, **When** I tap "Entrar", **Then** the app navigates to `/login` with email + password fields.
2. **Given** I enter valid credentials and tap "Entrar", **When** the server responds 200 with a JWT, **Then** the JWT is saved to `expo-secure-store` and I am navigated back to Home.
3. **Given** the server returns 401 for bad credentials, **Then** the login form shows "Email ou senha inválidos" and the JWT slot remains empty.
4. **Given** I am offline and try to log in for the first time, **Then** the form shows "Sem conexão — login precisa de internet na primeira vez".
5. **Given** I am logged in and force-close the app, **When** I reopen it, **Then** I am still logged in (JWT read from secure storage on boot).

---

### User Story 3 - Logout (Priority: P1)

As a logged-in user, I want to log out so that another user can log in on the same device, without losing any local data.

**Why this priority**: Shared devices are realistic (one tablet for multiple collectors). Logout must be non-destructive.

**Independent Test**: Log in, create 2 lessons, log out. Verify the 2 lessons are still visible on the Home screen and the app is in the anonymous state.

**Acceptance Scenarios**:

1. **Given** I am logged in, **When** I tap "Sair" in `/settings`, **Then** the JWT is cleared from secure storage.
2. **Given** I log out, **Then** the Home screen still shows every lesson from my local SQLite, unchanged.
3. **Given** I log out, **When** I try to send a lesson to the cloud (spec 008), **Then** the "Enviar pra Nuvem" button is hidden or disabled.
4. **Given** I logged out without the app having synced my lessons, **Then** those lessons remain in `sync_status = LOCAL` and can still be exported via share sheet.

---

### User Story 4 - Collector Identity on New Lessons (Priority: P1)

As a logged-in Collector, I want every new lesson I create to be automatically tagged with my user ID so that the backend knows who collected it without me having to type anything.

**Why this priority**: Friction-free attribution is the whole point of login. Asking the user to pick themselves from a list every time would be absurd.

**Independent Test**: Log in as user X, create a new lesson via "Nova Aula". Query SQLite directly: `SELECT collector_user_id FROM lessons_data WHERE id = ?`. Verify it equals X.

**Acceptance Scenarios**:

1. **Given** I am logged in as user `U1`, **When** I tap "Nova Aula", **Then** the new row in `lessons_data` has `collector_user_id = U1`.
2. **Given** I am not logged in, **When** I tap "Nova Aula", **Then** the new row has `collector_user_id = NULL`.
3. **Given** I created a lesson anonymously and then logged in, **Then** the existing row is NOT retroactively tagged. It stays `collector_user_id = NULL` forever (or until manual fix — out of scope for MVP).

---

### User Story 5 - Filtered Lesson List for Logged-In Users (Priority: P2)

As a logged-in Collector, I want the Home screen to show my own lessons plus any legacy anonymous lessons from this device, so that I see a clean list without other users' data polluting mine.

**Why this priority**: Shared devices with multiple collectors logging in/out need visual separation.

**Independent Test**: On one device, log in as A and create 2 lessons, log out and create 1 anonymous lesson, log in as B and verify B sees only the 1 anonymous lesson (not A's 2).

**Acceptance Scenarios**:

1. **Given** I am logged in as `U1` and the device has lessons from `U1`, `U2`, and anonymous (`null`), **When** I view Home, **Then** I see `U1`'s lessons + anonymous ones, NOT `U2`'s.
2. **Given** I am not logged in, **When** I view Home, **Then** I see ALL lessons on the device (no filter) — matches current baseline behavior.
3. **Given** the filter hides `U2`'s lessons from `U1`, **Then** the SQLite data is unchanged — the filter is query-level, not destructive.

---

### User Story 6 - Coordinator Moderation UI (Priority: P3)

As a Coordinator, I want a screen where I can see all collectors and toggle each one as "aceito" or "rejeitado" to control whether their submissions count in the aggregated numbers.

**Why this priority**: Required for the moderation model from the roadmap. P3 because it can ship after the baseline collector experience is stable and the first real multi-collector data is flowing.

**Independent Test**: Log in as a coordinator. Navigate to `/settings/users`. See a list of users with a toggle per row. Flip a toggle and verify the PATCH request succeeds.

**Acceptance Scenarios**:

1. **Given** I am logged in as a coordinator, **When** I open `/settings`, **Then** I see a menu item "Moderar coletores" that is hidden for non-coordinators.
2. **Given** I open `/settings/users`, **When** the list loads, **Then** I see all registered users with their name, email, and an "Aceito" switch.
3. **Given** I flip a switch from ON to OFF, **When** the PATCH `/users/:id/accepted` returns 200, **Then** the switch stays OFF and the server has recomputed all affected aggregates.
4. **Given** I am logged in as a plain collector, **When** I try to access `/settings/users` directly, **Then** I am redirected back to `/settings` with a "Acesso restrito" toast.

---

### Edge Cases

- **EC-001 (JWT Expired Mid-Session)**: JWT tokens expire after 7 days (server policy). If a request returns 401, the client clears the JWT silently, reverts to the anonymous state, and shows a non-blocking toast "Sessão expirada — entre novamente para sincronizar". The user keeps using the app offline.
- **EC-002 (First Login Offline)**: If the user taps "Entrar" while offline and there is no cached JWT, show "Sem conexão — login precisa de internet na primeira vez". Do NOT queue the login attempt.
- **EC-003 (Rejected Collector)**: A user whose `accepted` flag is false on the server can still log in, create lessons, and sync them. The server accepts the submissions but excludes them from aggregation. The client does NOT receive a special error — rejection is invisible to the collector (avoids demotivation).
- **EC-004 (Secure Storage Wiped)**: If `expo-secure-store` is wiped (rare, e.g., user clears app data), the app reverts to anonymous. Local lessons remain. No data loss.
- **EC-005 (Legacy `coordinator_name`)**: Existing lessons from before this spec have `coordinator_name` as a free-text string. This column stays in the schema and is read-only from now on. New lessons use `collector_user_id` and leave `coordinator_name` empty.
- **EC-006 (Username Display)**: The Home header shows the logged-in user's `display_name`. If the display name is missing (edge case from malformed server response), fallback to email.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A new screen `app/login.tsx` MUST exist with fields: email (text), password (secure text), and a button "Entrar". It MUST be reachable from `app/settings.tsx` and optionally from a secondary entry point on the Home header.
- **FR-002**: The login screen MUST NOT be shown at app launch. Opening the app MUST navigate directly to Home, preserving the anonymous baseline.
- **FR-003**: A successful login MUST save the JWT to `expo-secure-store` under the key `eb:auth:jwt` and a decoded `{ user_id, display_name, role }` to AsyncStorage under `eb:auth:user` for quick read access.
- **FR-004**: A new local SQLite table `users` MUST be created with fields: `id TEXT PK`, `email TEXT`, `display_name TEXT`, `role TEXT CHECK IN ('COLLECTOR','COORDINATOR')`, `accepted INTEGER`, `created_at TEXT`. This table caches user metadata for offline reads — it is a local mirror, not authoritative.
- **FR-005**: A migration MUST add `collector_user_id TEXT NULL` to `lessons_data`. It MUST NOT drop or modify `coordinator_name`, which stays for backwards compatibility.
- **FR-006**: `lessonService.createLesson()` MUST populate `collector_user_id` from the currently-logged-in user if one exists, otherwise leave it `NULL`.
- **FR-007**: When logged in, the Home list MUST filter lessons by `collector_user_id = currentUser.id OR collector_user_id IS NULL`. When not logged in, no filter is applied (all lessons visible — matches current behavior).
- **FR-008**: Export via share sheet (spec 005) MUST always work, regardless of login state. When logged in, the exported JSON includes `collector: { user_id, display_name }`; when not logged in, `collector: null`.
- **FR-009**: HTTP POST to `/sync/batch` (spec 008) MUST require a valid JWT. If the user is not logged in, the client MUST NOT attempt the request — the "Enviar pra Nuvem" button is hidden.
- **FR-010**: The Home header MUST show a discrete indicator of the auth state: no badge (anonymous), "X" (logged in as X), "X ⭐" (logged in as X with coordinator role).
- **FR-011**: The backend (spec 007) MUST expose auth endpoints per the contract below. This spec documents the CLIENT contract expectations; spec 007 documents the implementation.

#### Auth Endpoint Contract (for spec 007 to implement)

- `POST /auth/register`
  - Request: `{ email: string, password: string, display_name: string }`
  - Response 201: `{ jwt: string, user: { id, email, display_name, role, accepted } }`
  - Response 409: email already registered
  - Note: the FIRST user to register in an empty database MUST be assigned `role: COORDINATOR` automatically. Subsequent users are `COLLECTOR`.

- `POST /auth/login`
  - Request: `{ email: string, password: string }`
  - Response 200: `{ jwt: string, user: { id, email, display_name, role, accepted } }`
  - Response 401: bad credentials

- `GET /users/me`
  - Request: Bearer JWT
  - Response 200: `{ id, email, display_name, role, accepted }`
  - Response 401: missing/expired JWT

- `GET /users` (coordinator only)
  - Request: Bearer JWT with role=COORDINATOR
  - Response 200: `[{ id, email, display_name, role, accepted, created_at }]`
  - Response 403: role is not COORDINATOR

- `PATCH /users/:id/accepted` (coordinator only)
  - Request: Bearer JWT with role=COORDINATOR, body `{ accepted: boolean }`
  - Response 200: `{ id, accepted }`, server recomputes aggregates for any affected `LessonInstance` in the background
  - Response 403: role is not COORDINATOR

### Key Entities *(include if feature involves data)*

- **User**: Represents a person who can log in. Fields: `id` (UUID), `email`, `password_hash` (server only), `display_name`, `role` (`COLLECTOR` or `COORDINATOR`), `accepted` (boolean, default true), `created_at`.
- **AuthSession**: The client-side representation of an active login. Fields: `jwt` (string, secure storage), `user` (cached copy from `GET /users/me`).
- **AnonymousState**: Pseudo-entity representing the default "no login" state. Fields: none — simply the absence of an `AuthSession`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **Zero Regression for Anonymous Users**: 100% of the flows available in the current (pre-006) app continue to work without login after 006 ships. Verified by running the spec 001 acceptance tests with no login.
- **SC-002**: **Login Round-Trip Time**: End-to-end login (tap → JWT saved → Home reloaded) completes in < 3 seconds on 4G.
- **SC-003**: **JWT Persistence**: JWT survives 100 consecutive force-closes of the app. Verified by automated test.
- **SC-004**: **Logout Safety**: After logout, 100% of locally-created lessons remain in SQLite and are still exportable via share sheet. Zero data loss.
- **SC-005**: **Filter Correctness**: On a device with a mix of A's lessons, B's lessons, and anonymous lessons, logging in as A shows exactly `A's lessons + anonymous`, logging in as B shows exactly `B's + anonymous`, and logging out shows all of them.
- **SC-006**: **Migration Safety**: After running the 006 migration on a database populated by spec 001/002/003/004, zero rows are lost and zero `coordinator_name` values are overwritten.

## Assumptions

- The backend from spec 007 is reachable over HTTPS at a configurable URL (stored in an env file or a settings screen).
- `expo-secure-store` is available on target platforms (it is — already supported in the current Expo SDK 54 setup).
- JWTs are short-ish lived (7 days is the planned default). Refresh tokens are explicitly out of scope for the MVP — the user can re-login manually.
- Password reset is out of scope for this spec. If a user forgets their password, a coordinator resets it via a future admin tool.
- A single user CAN NOT have two active sessions on different devices with different JWTs — the server issues a new JWT per login and the old one remains valid until expiration (simpler than revocation lists).

## Related Specs

- **005-export-contract-v2** — this spec defines how `collector.user_id` is produced.
- **007-sync-backend** — implements the auth endpoints documented in FR-011.
- **008-offline-sync-client** — gates cloud sync on the presence of a valid JWT from this spec.
