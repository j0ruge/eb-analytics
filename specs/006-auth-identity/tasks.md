# Tasks: Auth & Identity (006)

**Input**: Design documents from `/specs/006-auth-identity/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth-api.md

**Tests**: E2E tests included per CLAUDE.md section 12 ("After implementing any feature that modifies UI screens, create or update Playwright E2E tests").

**Organization**: Tasks grouped by user story. US1-US5 are all P1, US6 is P2, US7 is P3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1-US7)

---

## Phase 1: Setup

**Purpose**: Install dependencies and create config files

- [x] T001 Install expo-secure-store: `npx expo install expo-secure-store`
- [x] T002 Create `app.config.js` at repo root — extend `app.json` with `extra.apiUrl` from `process.env.EXPO_PUBLIC_API_URL` (default: `http://localhost:3000`). Remove duplicate fields from `app.json` that move to the JS config.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types, services, auth context, and DB migration that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 [P] Create auth types in `src/types/auth.ts` — `Role` enum (COLLECTOR, COORDINATOR), `User` interface (id, email, display_name, role, accepted, created_at), `AuthSession` interface, `LoginDTO`, `RegisterDTO`, `AuthState` type (loading, anonymous, authenticated)
- [x] T004 [P] Update `src/types/lesson.ts` — add `collector_user_id: string | null` field to `Lesson` interface (after `notes` field)
- [x] T005 [P] Create `src/services/apiClient.ts` — thin fetch wrapper: `get<T>(path)`, `post<T>(path, body)`, `patch<T>(path, body)`. Base URL from `Constants.expoConfig.extra.apiUrl`. Auto-inject `Authorization: Bearer <jwt>` from secure store. JSON serialization. Return typed `{ data, error, status }` — never throw for expected HTTP errors (401, 403, 409). Handle network errors → `{ error: "Sem conexão" }`
- [x] T006 Create `src/services/authService.ts` — object literal following `professorService` pattern. Methods: `register(dto)`, `login(email, password)`, `logout()`, `getSession()`, `getCurrentUser()`. JWT in expo-secure-store (`eb:auth:jwt`) with web fallback to AsyncStorage. User profile in AsyncStorage (`@eb-insights/auth-user`). Use `pendingPromise` coalescing pattern from `deviceIdService.ts`. Depends on T005 (apiClient).
- [x] T007 [P] Add DB migration in `src/db/migrations.ts` — new function `migrateAddCollectorUserId(db)`: (1) ALTER TABLE lessons_data ADD COLUMN collector_user_id TEXT, (2) CREATE INDEX idx_lessons_collector_user_id, (3) CREATE TABLE auth_users (id, email, display_name, role, accepted, created_at). Follow existing migration flag pattern (`isMigrationComplete`/`markMigrationComplete`).
- [x] T008 Call new migration from `src/db/client.ts` — add `migrateAddCollectorUserId(db)` call in `applyMigrations()` after existing migrations
- [x] T009 Create `src/contexts/AuthProvider.tsx` — follow `src/theme/ThemeProvider.tsx` pattern exactly. `AuthContext` with `createContext`. `isLoading` state while reading stored session on boot. Provides: `{ user, isAuthenticated, isCoordinator, login(), register(), logout(), isLoading }`. Calls `authService.getSession()` on mount. Depends on T006.
- [x] T010 [P] Create `src/hooks/useAuth.ts` — follow `src/hooks/useTheme.ts` pattern. `useAuth()` consumes `AuthContext`, throws if used outside `AuthProvider`. Also export `useAuthOptional()` that returns null instead of throwing (for use in services).
- [x] T011 Update `app/_layout.tsx` — wrap `<ThemeProvider>` with `<AuthProvider>` (AuthProvider as outermost provider). Import from `@/contexts/AuthProvider`.

**Checkpoint**: App compiles. All 109 existing tests pass. Auth context available throughout app. DB migration applied. No UI changes yet.

---

## Phase 3: User Story 1 — Anonymous Baseline (P1) MVP

**Goal**: Verify the app works exactly as before without login. Zero regression.

**Independent Test**: Install the app with airplane mode on. Create lesson, complete, export JSON. No login prompt anywhere.

- [x] T012 [US1] Verify anonymous baseline — run `npm test` and confirm all 109 tests pass after Phase 2 changes. Run `npm run test:e2e` and confirm all existing E2E tests pass. No UI changes needed — this story is about proving zero regression.
- [x] T013 [US1] Write E2E test in `tests/e2e/auth-anonymous.spec.ts` — verify: (1) app opens directly to Home with no login prompt, (2) can create a lesson without being logged in, (3) exported JSON contains `"collector": null`

**Checkpoint**: Anonymous flow confirmed working. App behaves identically to pre-006.

---

## Phase 4: User Story 2 — Self-Registration (P1)

**Goal**: Users can create an account via Settings → "Criar conta"

**Independent Test**: Open Settings → tap "Criar conta" → fill email, password, display name → tap "Registrar" → verify account created and user logged in

- [x] T014 [P] [US2] Create `app/register.tsx` — registration screen with fields: email (TextInput, keyboardType email), password (TextInput, secureTextEntry), display name (TextInput). "Registrar" button calls `register()` from useAuth. Error states: duplicate email ("Este email já está cadastrado"), offline ("Sem conexão — registro precisa de internet"), server error ("Erro no servidor, tente novamente"), weak password (show server message). Success: toast "Conta criada com sucesso", navigate to Home. First-user toast: "Você é o coordenador deste grupo". Style with `createStyles(theme)` pattern.
- [x] T015 [US2] Add "Criar conta" button to `app/settings.tsx` — visible only when not logged in. Add new "Conta" section after "Padrões" section (after line ~164). Tap navigates to `/register`. Use `useAuth()` to check `isAuthenticated`.

**Checkpoint**: Can register a new account (requires server running). First user becomes coordinator.

---

## Phase 5: User Story 3 — Optional Login (P1)

**Goal**: Users with an account can log in from Settings and stay logged in across restarts

**Independent Test**: Settings → "Entrar" → enter credentials → verify logged in → force close → reopen → still logged in

- [x] T016 [P] [US3] Create `app/login.tsx` — login screen with fields: email (TextInput, keyboardType email), password (TextInput, secureTextEntry). "Entrar" button calls `login()` from useAuth. Error states: invalid credentials ("Email ou senha inválidos"), offline ("Sem conexão — login precisa de internet na primeira vez"), server error ("Erro no servidor, tente novamente"). Success: navigate back. Style with `createStyles(theme)` pattern.
- [x] T017 [US3] Add "Entrar" button to `app/settings.tsx` — visible only when not logged in (alongside "Criar conta" from T015). Tap navigates to `/login`.
- [x] T018 [US3] Write E2E test in `tests/e2e/auth-login.spec.ts` — verify: (1) Settings shows "Entrar" when not logged in, (2) login form renders with email and password fields, (3) successful login navigates to Home (mock or test server needed)

**Checkpoint**: Can log in with existing account. Session persists across restarts.

---

## Phase 6: User Story 4 — Logout (P1)

**Goal**: Logged-in users can log out from Settings without losing local data

**Independent Test**: Log in → create 2 lessons → log out → verify 2 lessons still visible → verify anonymous state

- [x] T019 [US4] Add logout UI to `app/settings.tsx` — visible only when logged in (same "Conta" section). Show current user display name, email, role badge. "Sair" button with Alert.alert confirmation dialog. On confirm: call `logout()` from useAuth. After logout: UI reverts to showing "Entrar"/"Criar conta" buttons.
- [x] T020 [US4] Write E2E test in `tests/e2e/auth-logout.spec.ts` — verify: (1) Settings shows user info and "Sair" when logged in, (2) after logout, Settings shows "Entrar" and "Criar conta", (3) local lessons remain visible after logout

**Checkpoint**: Full login/logout cycle works. Local data preserved.

---

## Phase 7: User Story 5 — Collector Identity on New Lessons (P1)

**Goal**: Lessons created while logged in are tagged with the user's ID. Anonymous lessons stay unattributed.

**Independent Test**: Log in as X → create lesson → verify lesson has collector_user_id = X → log out → create lesson → verify collector_user_id = null

- [x] T021 [US5] Update `src/services/lessonService.ts` `createLesson()` — accept optional `collectorUserId?: string | null` parameter. Add `collector_user_id` to INSERT query with value from param (or null). Do NOT inherit from previous lesson via smart-defaults (see Write-Path Impact Checklist). Ensure `updateLesson()` does NOT allow changing collector_user_id (immutable after creation).
- [x] T022 [US5] Update lesson creation flow — in `app/lesson/new.tsx` (or wherever "Nova Aula" navigates), read `user?.id` from `useAuth()` and pass as `collectorUserId` to `lessonService.createLesson()`.
- [x] T023 [US5] Update `src/services/exportService.ts` — change `collector: null` (line ~153 in `buildEnvelope()`) to: when logged in, `{ user_id: string, display_name: string }`; when anonymous, `null`. Get current user from `authService.getCurrentUser()`. Also update `ExportEnvelopeV2` interface: change `collector` field type from `null` to `CollectorInfo | null`.
- [x] T024 [P] [US5] Update `app/(tabs)/sync.tsx` — if user is not logged in (`!isAuthenticated` from `useAuth()`), hide or disable the "Enviar pra Nuvem" button per FR-010. Show a message like "Faça login para sincronizar" instead.
- [x] T025 [US5] Write unit test in `tests/unit/lessonServiceAuth.test.ts` — verify: (1) createLesson with collectorUserId sets the field, (2) createLesson without collectorUserId leaves it null, (3) updateLesson cannot change collector_user_id

**Checkpoint**: Lessons are correctly attributed. Export includes collector identity.

---

## Phase 8: User Story 6 — Filtered Lesson List (P2)

**Goal**: Logged-in users see only their lessons + anonymous lessons. Anonymous users see all.

**Independent Test**: Device has lessons from A, B, and anonymous → log in as A → see only A's + anonymous → log out → see all

- [ ] T026 [US6] Update `src/services/lessonService.ts` `getAllLessonsWithDetails()` — accept optional `collectorUserId?: string | null`. When provided: add WHERE clause `(collector_user_id = ? OR collector_user_id IS NULL)`. When null: no filter (show all). Apply same filter to `getAllLessons()`, `getCompletedLessons()`, `getExportedLessons()`, and `getLastLesson()`.
- [ ] T027 [US6] Update `app/(tabs)/index.tsx` — get `user` from `useAuth()`. Pass `user?.id` to `lessonService.getAllLessonsWithDetails()`. Refresh data when auth state changes (add `user?.id` to `useFocusEffect` dependency).
- [ ] T028 [US6] Add auth indicator to Home header in `app/(tabs)/index.tsx` — no badge when anonymous, "Logado: {name}" when collector (fallback to email if display_name is empty per EC-006), "Logado: {name} ⭐" when coordinator. Position in the screen header area or above StatusFilterBar.
- [ ] T029 [US6] Write E2E test in `tests/e2e/auth-filter.spec.ts` — verify: (1) when not logged in, all lessons visible, (2) when logged in as user A, only A's lessons + anonymous visible

**Checkpoint**: Lesson filtering works correctly on shared devices.

---

## Phase 9: User Story 7 — Coordinator Moderation UI (P3)

**Goal**: Coordinators can see all users and toggle their "accepted" status

**Independent Test**: Log in as coordinator → Settings → "Moderar coletores" → see user list → toggle a user → verify server updated

- [ ] T030 [P] [US7] Create `app/settings/users.tsx` — moderation screen. FlatList of all registered users (from `GET /users` endpoint via apiClient). Each row: name, email, "Aceito" switch. Toggle calls `PATCH /users/:id/accepted`. Non-coordinator redirect: if `!isCoordinator`, navigate back to Settings with "Acesso restrito" toast. Style with `createStyles(theme)` pattern.
- [ ] T031 [US7] Add "Moderar coletores" menu item to `app/settings.tsx` — visible only when `isCoordinator` is true. Tap navigates to `/settings/users`.
- [ ] T032 [US7] Write E2E test in `tests/e2e/auth-moderation.spec.ts` — verify: (1) "Moderar coletores" visible for coordinator, hidden for collector, (2) moderation screen shows user list

**Checkpoint**: Coordinator can manage collector acceptance.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, cleanup, final verification

- [ ] T033 [P] Handle EC-001 (Session Expired) in `src/services/apiClient.ts` — intercept 401 responses, call `authService.logout()`, show toast "Sessão expirada — entre novamente para sincronizar"
- [ ] T034 [P] Handle EC-008 (Generic Server Error) — ensure apiClient returns user-friendly error for 500/timeout/connection refused: "Erro no servidor, tente novamente"
- [ ] T035 Run full test suite: `npm test` (all unit tests pass) + `npm run test:e2e` (all E2E tests pass)
- [ ] T036 Run quickstart.md verification checklist — manually verify all items
- [ ] T037 Verify migration safety: confirm existing test database data survives the 006 migration without data loss

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1 Anonymous)**: Depends on Phase 2 — verify baseline before adding features
- **Phase 4-7 (US2-US5)**: Depend on Phase 3 — can proceed in priority order (P1 stories)
  - US2 (Registration) and US3 (Login) can run in parallel (different screen files)
  - US4 (Logout) depends on US3 (need login to test logout)
  - US5 (Collector Identity) depends on US2 or US3 (need a logged-in user to test)
- **Phase 8 (US6 Filtered List)**: Depends on US5 (needs collector_user_id on lessons)
- **Phase 9 (US7 Moderation)**: Depends on US2 (needs registered users). Can run in parallel with US6.
- **Phase 10 (Polish)**: Depends on all desired user stories being complete

### User Story Dependencies

```
Phase 1 (Setup) → Phase 2 (Foundation) → Phase 3 (US1 Baseline)
                                              │
                                    ┌─────────┴─────────┐
                                    ▼                     ▼
                              Phase 4 (US2)         Phase 5 (US3)
                              Registration            Login
                                    │                     │
                                    └──────┬──────────────┘
                                           ▼
                                     Phase 6 (US4)
                                      Logout
                                           │
                                           ▼
                                     Phase 7 (US5)
                                   Collector Identity
                                           │
                                    ┌──────┴──────┐
                                    ▼              ▼
                              Phase 8 (US6)  Phase 9 (US7)
                              Filter List    Moderation
                                    │              │
                                    └──────┬───────┘
                                           ▼
                                    Phase 10 (Polish)
```

### Within Each User Story

- Models/types before services
- Services before screens
- Screens before E2E tests
- Tasks marked [P] within same phase can run in parallel

### Parallel Opportunities

- T003 + T004 + T005 + T007 + T010 can run in parallel (different files, no dependencies)
- T014 (register screen) + T016 (login screen) can run in parallel
- T030 (moderation screen) can run in parallel with T026-T029 (US6)
- T033 + T034 can run in parallel (different concerns, different files)

---

## Parallel Example: Foundational Phase

```
# Parallel batch 1 (no dependencies between these):
T003: Create src/types/auth.ts
T004: Update src/types/lesson.ts
T005: Create src/services/apiClient.ts
T007: Add DB migration in src/db/migrations.ts
T010: Create src/hooks/useAuth.ts

# Sequential after batch 1:
T006: Create src/services/authService.ts (depends on T005)
T008: Call migration from src/db/client.ts (depends on T007)
T009: Create src/contexts/AuthProvider.tsx (depends on T006)
T011: Update app/_layout.tsx (depends on T009)
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 + US4 + US5)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks everything)
3. Complete Phase 3: US1 Anonymous Baseline (verify zero regression)
4. Complete Phase 4-7: US2-US5 (core auth features)
5. **STOP and VALIDATE**: Full login/register/logout cycle + collector identity
6. Deploy for testing with real users

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 (Anonymous) → Verify baseline → **Safe to ship (no behavior change)**
3. US2+US3 (Register+Login) → Test login cycle → **Auth available**
4. US4 (Logout) → Test shared device flow → **Full auth cycle**
5. US5 (Collector Identity) → Test attribution → **Lessons tagged**
6. US6 (Filtered List) → Test shared device → **Multi-user ready**
7. US7 (Moderation) → Test coordinator flow → **Full feature**

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Server (spec 007) must be running for registration/login testing. Use mock/stub for offline dev.
- E2E tests run against Expo web build (`npx expo start --web --port 8082`)
- Commit after each completed phase
- Total tasks: 37 (renumbered after C1 fix: T024 added for sync button, T034 merged into T023)
