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

### User Story 2 - Self-Registration (Priority: P1)

As a new collector who wants to use cloud sync, I want to create an account directly in the app using my email, a password, and my display name, so that I can start attributing my collections.

**Why this priority**: Without registration, no user can ever log in. This is a prerequisite for all authenticated features. The very first person to register in a fresh system automatically becomes the Coordinator — this bootstraps the moderation hierarchy without manual intervention.

**Independent Test**: Open the app on a device with internet. Navigate to Settings → "Criar conta". Fill in email, password, and display name. Tap "Registrar". Verify the account is created and the user is immediately logged in.

**Acceptance Scenarios**:

1. **Given** I am on Settings and not logged in, **When** I tap "Criar conta", **Then** the app navigates to a registration screen with fields: email, password, display name, and a "Registrar" button.
2. **Given** I fill in valid data and tap "Registrar", **When** the server responds with success, **Then** I am immediately logged in and navigated back to Home with a confirmation toast "Conta criada com sucesso".
3. **Given** the system has no registered users, **When** I am the first person to register, **Then** I am automatically assigned the Coordinator role and see a toast explaining "Você é o coordenador deste grupo".
4. **Given** there are already registered users, **When** I register, **Then** I am assigned the Collector role by default.
5. **Given** I try to register with an email that already exists, **Then** the form shows "Este email já está cadastrado".
6. **Given** I am offline and try to register, **Then** the form shows "Sem conexão — registro precisa de internet".

---

### User Story 3 - Optional Login (Priority: P1)

As a Class Secretary who has an account, I want to log in once and have the app remember me so that I can sync my future collections to the backend.

**Why this priority**: Cloud sync (spec 008) depends entirely on the user being identifiable. Without login, no submission can be attributed to a collector on the server.

**Independent Test**: From the Settings screen, tap "Entrar", enter valid credentials, tap login. Verify the user is authenticated and the Home screen shows a "Logado: X" indicator.

**Acceptance Scenarios**:

1. **Given** I am on Settings and not logged in, **When** I tap "Entrar", **Then** the app navigates to a login screen with email + password fields.
2. **Given** I enter valid credentials and tap "Entrar", **When** the server responds with success, **Then** my credentials are saved securely and I am navigated back to Home.
3. **Given** the server rejects my credentials, **Then** the login form shows "Email ou senha inválidos" and no credentials are saved.
4. **Given** I am offline and try to log in for the first time, **Then** the form shows "Sem conexão — login precisa de internet na primeira vez".
5. **Given** I am logged in and force-close the app, **When** I reopen it, **Then** I am still logged in (credentials read from secure storage on boot).

---

### User Story 4 - Logout (Priority: P1)

As a logged-in user, I want to log out so that another user can log in on the same device, without losing any local data.

**Why this priority**: Shared devices are realistic (one tablet for multiple collectors). Logout must be non-destructive.

**Independent Test**: Log in, create 2 lessons, log out. Verify the 2 lessons are still visible on the Home screen and the app is in the anonymous state.

**Acceptance Scenarios**:

1. **Given** I am logged in, **When** I tap "Sair" in Settings, **Then** my credentials are cleared from secure storage.
2. **Given** I log out, **Then** the Home screen still shows every lesson on the device, unchanged.
3. **Given** I log out, **When** I try to send a lesson to the cloud (spec 008), **Then** the "Enviar pra Nuvem" button is hidden or disabled.
4. **Given** I logged out without the app having synced my lessons, **Then** those lessons remain local-only and can still be exported via share sheet.

---

### User Story 5 - Collector Identity on New Lessons (Priority: P1)

As a logged-in Collector, I want every new lesson I create to be automatically tagged with my user ID so that the backend knows who collected it without me having to type anything.

**Why this priority**: Friction-free attribution is the whole point of login. Asking the user to pick themselves from a list every time would be absurd.

**Independent Test**: Log in as user X, create a new lesson via "Nova Aula". Verify the lesson is attributed to user X. Log out, create another lesson — verify it has no attribution.

**Acceptance Scenarios**:

1. **Given** I am logged in as user U1, **When** I tap "Nova Aula", **Then** the new lesson is attributed to U1.
2. **Given** I am not logged in, **When** I tap "Nova Aula", **Then** the new lesson has no collector attribution.
3. **Given** I created a lesson anonymously and then logged in, **Then** the existing lesson is NOT retroactively tagged. It stays unattributed forever (or until manual fix — out of scope for MVP).

---

### User Story 6 - Filtered Lesson List for Logged-In Users (Priority: P2)

As a logged-in Collector, I want the Home screen to show my own lessons plus any legacy anonymous lessons from this device, so that I see a clean list without other users' data polluting mine.

**Why this priority**: Shared devices with multiple collectors logging in/out need visual separation.

**Independent Test**: On one device, log in as A and create 2 lessons, log out and create 1 anonymous lesson, log in as B and verify B sees only the 1 anonymous lesson (not A's 2).

**Acceptance Scenarios**:

1. **Given** I am logged in as U1 and the device has lessons from U1, U2, and anonymous, **When** I view Home, **Then** I see U1's lessons + anonymous ones, NOT U2's.
2. **Given** I am not logged in, **When** I view Home, **Then** I see ALL lessons on the device (no filter) — matches current baseline behavior.
3. **Given** the filter hides U2's lessons from U1, **Then** the underlying data is unchanged — the filter is at the query level, not destructive.

---

### User Story 7 - Coordinator Moderation UI (Priority: P3)

As a Coordinator, I want a screen where I can see all collectors and toggle each one as "aceito" or "rejeitado" to control whether their submissions count in the aggregated numbers.

**Why this priority**: Required for the moderation model from the roadmap. P3 because it can ship after the baseline collector experience is stable and the first real multi-collector data is flowing.

**Independent Test**: Log in as a coordinator. Navigate to Settings → "Moderar coletores". See a list of users with a toggle per row. Flip a toggle and verify the change is persisted on the server.

**Acceptance Scenarios**:

1. **Given** I am logged in as a coordinator, **When** I open Settings, **Then** I see a menu item "Moderar coletores" that is hidden for non-coordinators.
2. **Given** I open the moderation screen, **When** the list loads, **Then** I see all registered users with their name, email, and an "Aceito" switch.
3. **Given** I flip a switch from ON to OFF, **When** the server confirms the change, **Then** the switch stays OFF and the server recomputes all affected aggregates in the background.
4. **Given** I am logged in as a plain collector, **When** I try to access the moderation screen directly, **Then** I am redirected back to Settings with a "Acesso restrito" toast.

---

### Edge Cases

- **EC-001 (Session Expired Mid-Use)**: Authentication tokens expire after a server-configured period (default: 7 days). If a request fails due to an expired session, the client clears the session silently, reverts to the anonymous state, and shows a non-blocking toast "Sessão expirada — entre novamente para sincronizar". The user keeps using the app offline.
- **EC-002 (First Login Offline)**: If the user taps "Entrar" while offline and there is no cached session, show "Sem conexão — login precisa de internet na primeira vez". Do NOT queue the login attempt.
- **EC-003 (Rejected Collector)**: A user whose `accepted` flag is false on the server can still log in, create lessons, and sync them. The server accepts the submissions but excludes them from aggregation. The client does NOT receive a special error — rejection is invisible to the collector (avoids demotivation).
- **EC-004 (Secure Storage Wiped)**: If the device's secure storage is wiped (rare, e.g., user clears app data), the app reverts to anonymous. Local lessons remain. No data loss.
- **EC-005 (Legacy `coordinator_name` field)**: Existing lessons from before this spec have a free-text `coordinator_name` field. **Note**: despite the name, this field historically referred to "the person who collected the data", NOT the COORDINATOR role introduced in this spec. This legacy column stays in the schema and is read-only from now on. New lessons use the authenticated collector identity and leave the legacy field empty.
- **EC-006 (Username Display)**: The Home header shows the logged-in user's display name. If the display name is missing (edge case from malformed server response), fallback to email.
- **EC-007 (Registration with Weak Password)**: If the user provides a password that doesn't meet minimum requirements (server-enforced), the registration form shows the server's error message. Minimum requirements are defined server-side (spec 007) and not enforced client-side beyond basic non-empty validation.
- **EC-008 (Generic Server Error)**: If the server returns an unexpected error (500, timeout, connection refused) during login or registration, the app shows a non-blocking toast "Erro no servidor, tente novamente". No technical details are exposed to the user. The error is logged to `console.error` for debugging.

### Write-Path Impact Checklist

This feature adds a collector identity field to lessons.

1. **Smart-defaults exception?** — YES. The collector identity MUST NOT be inherited from the previous lesson via smart-defaults. Unlike professor, series, or times (which carry forward from the last record), the collector identity comes from the current authentication state, not from lesson data. The spec explicitly requires: logged in → set from current user; not logged in → leave empty. If the implementer extends the existing carry-forward pattern by inertia, a lesson created by User A could be attributed to User B if B creates a lesson right after A on the same device.

2. **All write-paths covered?** — Write-paths that must handle the collector identity:
   - `createLesson`: Set from current authenticated user (or empty if anonymous)
   - `updateLesson`: **Immutable after creation** — the collector identity MUST NOT be changeable via update. This is not a user-editable field.
   - `seedService` (if applicable): Set to empty (seed data has no authenticated context)
   - Migration backfill: Existing lessons get empty collector identity (no retroactive attribution per User Story 5 acceptance scenario 3)

3. **Write-path efficiency?** — Minimal impact. A single new field that is set once at creation and never updated. Auto-save (debounced writes) does not need to include this field since it is immutable after INSERT. No additional database load.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST provide a registration screen reachable from Settings, with fields for email, password, and display name. Registration MUST require an active internet connection.
- **FR-002**: The first user to register in a fresh system MUST be automatically promoted to the Coordinator role. All subsequent registrations default to the Collector role.
- **FR-003**: The app MUST provide a login screen reachable from Settings, with email and password fields. Login MUST NOT be shown at app launch. Opening the app MUST navigate directly to Home, preserving the anonymous baseline.
- **FR-004**: A successful login or registration MUST persist the authentication credentials securely on the device and cache the user's profile (id, display name, role) locally for offline access.
- **FR-005**: Logout MUST clear all authentication credentials from the device without deleting or modifying any lesson data.
- **FR-006**: Each lesson MUST be linked to the authenticated user who created it. If no user is logged in at creation time, the lesson remains unattributed. The legacy `coordinator_name` field MUST be preserved in the schema for backward compatibility but MUST NOT be written to by new lessons.
- **FR-007**: The collector identity on a lesson MUST be immutable after creation — it cannot be changed via update.
- **FR-008**: When a user is logged in, the Home lesson list MUST show only that user's lessons plus any unattributed (anonymous) lessons. When no user is logged in, all lessons on the device MUST be visible (matching current behavior).
- **FR-009**: Export via share sheet (spec 005) MUST always work, regardless of login state. When logged in, the exported payload includes the collector's identity; when not logged in, the collector field is empty (per spec 005 FR-002).
- **FR-010**: Cloud sync requests (spec 008) MUST require active authentication. If the user is not logged in, the sync UI element MUST be hidden or disabled.
- **FR-011**: The Home header MUST show a discrete indicator of the auth state: no badge (anonymous), display name (logged in as collector), display name with a visual distinction (logged in as coordinator).
- **FR-012**: The app MUST cache user metadata locally so that profile information (display name, role) is available for offline reads without requiring a server round-trip.
- **FR-013**: The backend (spec 007) MUST expose authentication and user management endpoints per the contract in `contracts/auth-api.md`. This spec documents the CLIENT expectations; spec 007 documents the server implementation.

### Key Entities *(include if feature involves data)*

- **User**: Represents a person who can log in. Attributes: unique identifier, email, display name, role (Collector or Coordinator), accepted status (boolean, default true), creation timestamp. Password is server-side only — never stored on the client.
- **AuthSession**: The client-side representation of an active login. Attributes: authentication token (secure storage), cached user profile (local storage for offline access).
- **AnonymousState**: Pseudo-entity representing the default "no login" state — simply the absence of an AuthSession.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **Zero Regression for Anonymous Users**: 100% of the flows available in the current (pre-006) app continue to work without login after 006 ships. Verified by running the spec 001 acceptance tests with no login.
- **SC-002**: **Login Speed**: Login completes (tap "Entrar" → Home reloaded with user indicator) in under 3 seconds under normal network conditions.
- **SC-003**: **Registration Speed**: New users can create an account and be logged in within 1 minute of starting the registration flow.
- **SC-004**: **Session Persistence**: Authentication persists across app restarts without requiring re-login, for the duration of the token's validity period.
- **SC-005**: **Logout Safety**: After logout, 100% of locally-created lessons remain on the device and are still exportable via share sheet. Zero data loss.
- **SC-006**: **Filter Correctness**: On a device with a mix of user A's lessons, user B's lessons, and anonymous lessons, logging in as A shows exactly A's lessons + anonymous ones, logging in as B shows exactly B's + anonymous ones, and logging out shows all of them.
- **SC-007**: **Migration Safety**: After applying the 006 schema changes on a database populated by spec 001/002/003/004/005, zero rows are lost and zero legacy field values are overwritten.

## Clarifications

### Session 2026-04-12

- Q: Server URL configuration — env variable, settings screen, or both? → A: Build-time env variable only (`EXPO_PUBLIC_API_URL`). Users never see or configure the server URL. Changing hosting providers (self-host ↔ Fly.io) requires a rebuild with the new URL. A single `apiClient` service encapsulates all HTTP calls, providing a clean seam for the URL swap without complex driver/strategy patterns.
- Q: Server error handling on login/registration (500, timeout, connection refused)? → A: Toast genérico "Erro no servidor, tente novamente" para qualquer erro não mapeado. Não expor detalhes técnicos ao usuário.
- Q: Display name editável após registro? → A: Fora do MVP. Display name é imutável no app após registro. Editável via DB direto pelo coordenador se necessário.

## Assumptions

- The backend from spec 007 is reachable over HTTPS at a URL embedded at build time via environment variable. Users do not configure the server URL — it is transparent. Changing the backend host (e.g., self-host to Fly.io) requires rebuilding the app with the updated URL.
- The device provides a secure storage mechanism for authentication tokens (confirmed available in the current platform setup).
- Authentication tokens are short-lived (7 days is the planned default). Refresh tokens are explicitly out of scope for the MVP — the user can re-login manually.
- Password reset is out of scope for this spec. If a user forgets their password, a coordinator resets it via a future admin tool.
- Display name editing is out of scope for MVP. If a user needs to change their name, the coordinator edits it directly in the database.
- A single user CAN have multiple active sessions on different devices — the server issues a new token per login and the old one remains valid until expiration (simpler than revocation lists).

## Related Specs

- **005-export-contract-v2** — this spec defines how the collector identity appears in the exported payload.
- **007-sync-backend** — implements the auth endpoints documented in `contracts/auth-api.md`.
- **008-offline-sync-client** — gates cloud sync on the presence of a valid authentication session from this spec.
- **009-statistics-dashboard** — uses current user id when available to scope statistics; shows all lessons when anonymous.
