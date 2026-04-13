# Implementation Plan: Auth & Identity (006)

**Branch**: `006-auth-identity` | **Date**: 2026-04-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/006-auth-identity/spec.md`

## Summary

Add optional user authentication to the mobile app. The app continues to work fully offline without login (anonymous baseline). Users who register/login get their lessons tagged with their identity for cloud sync. Logged-in users see only their own lessons + anonymous ones on shared devices. A coordinator role enables moderation of collectors.

**Technical approach**: AuthProvider context (following ThemeProvider pattern), authService for business logic, apiClient for HTTP calls, SQLite migration for `collector_user_id`, expo-secure-store for JWT persistence.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict)
**Primary Dependencies**: React Native 0.81, Expo SDK 54, Expo Router 6, expo-secure-store (NEW), expo-constants
**Storage**: SQLite (expo-sqlite 16) for lessons + local user cache; AsyncStorage for user profile; expo-secure-store for JWT
**Testing**: Jest (unit), Playwright (E2E)
**Target Platform**: iOS, Android, Web (Expo)
**Project Type**: Mobile app (client-side only — server is spec 007)
**Performance Goals**: Login < 3s on normal network; zero regression on offline flows
**Constraints**: Offline-first, no forced login, backward compatible migration
**Scale/Scope**: ~5-10 collectors, ~100 lessons/month, 1 coordinator

## Constitution Check

*GATE: All pass — no violations.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Local-First Architecture | PASS | App works fully offline. Auth is optional. All SQLite operations unchanged. |
| II. Zero-Friction UX | PASS | No login wall. Collector identity auto-tagged from auth state. No extra taps. |
| III. Auto-Save & Fail-Safe | PASS | `collector_user_id` is set-once at creation, not part of auto-save cycle. Immutable after INSERT. |
| IV. Backward Compatibility | PASS | Migration adds nullable column. Legacy `coordinator_name` preserved read-only. Zero data loss. |
| V. Separation of Concerns | PASS | authService (logic) → apiClient (HTTP) → AuthProvider (React state) → screens (UI). Services don't know UI. |

## Project Structure

### Documentation (this feature)

```text
specs/006-auth-identity/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── auth-api.md      # API contract (already exists)
├── checklists/
│   └── requirements.md  # Quality checklist (already exists)
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (files to create/modify)

```text
# NEW FILES
src/services/authService.ts        # Auth business logic (login, register, logout, getSession)
src/services/apiClient.ts          # HTTP client wrapper (fetch + auth headers + base URL)
src/contexts/AuthProvider.tsx       # React context provider (follows ThemeProvider pattern)
src/hooks/useAuth.ts               # Hook to consume auth context (follows useTheme pattern)
src/types/auth.ts                  # Auth types (User, AuthSession, Role)
app/login.tsx                      # Login screen
app/register.tsx                   # Registration screen
app.config.js                      # Dynamic Expo config (for EXPO_PUBLIC_API_URL)

# MODIFIED FILES
src/types/lesson.ts                # Add collector_user_id to Lesson interface
src/db/migrations.ts               # Add migration: collector_user_id column + index + local users table
src/db/client.ts                   # Call new migration in applyMigrations()
src/services/lessonService.ts      # Inject collector_user_id in createLesson; filter in getAllLessons
src/services/exportService.ts      # Include collector identity in export payload
app/_layout.tsx                    # Wrap with AuthProvider (outside ThemeProvider)
app/settings.tsx                   # Add auth section (login/register/logout controls)
app/(tabs)/index.tsx               # Add user indicator in header; pass userId to queries
package.json                       # Add expo-secure-store dependency
```

**Structure Decision**: Mobile-only changes. No server code in this spec (server = spec 007). All new files follow existing directory conventions from CLAUDE.md.

## Implementation Phases

### Phase A: Foundation (no UI changes)

**Goal**: Auth types, API client, auth service, database migration. App compiles and all existing tests pass.

1. **Add dependency**: `npx expo install expo-secure-store`
2. **Create `app.config.js`**: Dynamic config that reads `EXPO_PUBLIC_API_URL` from env, falling back to `http://localhost:3000`
3. **Create `src/types/auth.ts`**: `User`, `AuthSession`, `Role` enum, `LoginDTO`, `RegisterDTO`
4. **Update `src/types/lesson.ts`**: Add `collector_user_id: string | null` to `Lesson` interface
5. **Create `src/services/apiClient.ts`**: Thin wrapper around `fetch` with:
   - Base URL from `Constants.expoConfig.extra.apiUrl`
   - Auto-inject `Authorization: Bearer <jwt>` header when token exists
   - JSON request/response helpers
   - Generic error handling (returns typed errors, never throws for expected HTTP errors)
6. **Create `src/services/authService.ts`**: Object literal following `professorService` pattern:
   - `register(dto)` → calls `apiClient.post('/auth/register')`, saves JWT + user
   - `login(email, password)` → calls `apiClient.post('/auth/login')`, saves JWT + user
   - `logout()` → clears JWT from secure store, clears user from AsyncStorage
   - `getSession()` → reads JWT + user from storage (follows `deviceIdService` caching pattern)
   - `getCurrentUser()` → returns cached user or null
   - JWT stored in expo-secure-store under key `eb:auth:jwt`
   - User profile cached in AsyncStorage under key `@eb-insights/auth-user`
7. **DB Migration**: Add `collector_user_id TEXT` column to `lessons_data` + create index
   - Follow existing migration pattern in `migrations.ts` (check flag → ALTER TABLE → mark complete)
   - Add local `auth_users` cache table (id, email, display_name, role, accepted, created_at)
8. **Update `lessonService.createLesson()`**: Accept optional `collectorUserId` param, set on INSERT
9. **Update `lessonService.getAllLessonsWithDetails()`**: Accept optional `collectorUserId` param, add WHERE filter

### Phase B: Auth Context + Screens

**Goal**: AuthProvider, useAuth hook, login/register screens. User can register, login, logout.

1. **Create `src/contexts/AuthProvider.tsx`**: Following `ThemeProvider.tsx` pattern exactly:
   - `AuthContext` with `createContext`
   - `isLoading` state while reading stored session on boot
   - Provides: `{ user, isAuthenticated, isCoordinator, login(), register(), logout(), isLoading }`
   - Calls `authService.getSession()` on mount
2. **Create `src/hooks/useAuth.ts`**: Following `useTheme.ts` pattern:
   - `useAuth()` → consumes `AuthContext`, throws if outside provider
3. **Update `app/_layout.tsx`**: Wrap `<ThemeProvider>` with `<AuthProvider>`
4. **Create `app/login.tsx`**: Email + password fields, "Entrar" button
   - Error states: invalid credentials, offline, server error (EC-008)
   - On success: navigate back to previous screen
5. **Create `app/register.tsx`**: Email + password + display name, "Registrar" button
   - Error states: duplicate email, offline, server error, weak password
   - First-user toast: "Você é o coordenador deste grupo"
   - On success: auto-login + navigate to Home

### Phase C: Integration (Home + Settings + Export)

**Goal**: Connect auth state to existing screens. Feature is functionally complete.

1. **Update `app/settings.tsx`**: Add "Conta" section (after "Padrões", before "Desenvolvimento"):
   - Not logged in: "Entrar" button + "Criar conta" button
   - Logged in: show user name/email, role badge, "Sair" button
   - Coordinator: show "Moderar coletores" button (navigates to future screen, disabled for now)
2. **Update `app/(tabs)/index.tsx`**:
   - Header: show auth indicator (anonymous / "Logado: Name" / "Logado: Name ⭐")
   - Pass `user?.id` to `lessonService.getAllLessonsWithDetails()` for filtering
   - "Nova Aula" button: pass `user?.id` as collectorUserId to createLesson flow
3. **Update `app/lesson/new.tsx`** (if exists) or lesson creation flow: inject `collectorUserId`
4. **Update `src/services/exportService.ts`**: Change `collector: null` to include `{ user_id, display_name }` when logged in

### Phase D: Edge Cases + Testing

**Goal**: Handle all edge cases, write tests, verify E2E.

1. **EC-001 (Session Expired)**: apiClient intercepts 401 → clears session → toast
2. **EC-003 (Rejected Collector)**: No client change needed (invisible to user)
3. **EC-004 (Secure Storage Wiped)**: authService.getSession() returns null gracefully
4. **Unit tests**: authService (mock fetch), apiClient (mock responses), migration (existing pattern)
5. **E2E tests** (Playwright): anonymous flow unchanged, login flow, logout flow, filtered list
6. **Manual verification**: install on device with airplane mode, create lesson, verify no login prompt

## Key Patterns to Reuse

| Pattern | Source File | Reuse In |
|---------|------------|----------|
| Context Provider | `src/theme/ThemeProvider.tsx` | `src/contexts/AuthProvider.tsx` |
| Hook | `src/hooks/useTheme.ts` | `src/hooks/useAuth.ts` |
| Service object literal | `src/services/professorService.ts` | `src/services/authService.ts` |
| AsyncStorage + cache | `src/services/deviceIdService.ts` | `authService` token/user persistence |
| DB migration | `src/db/migrations.ts` | `collector_user_id` column migration |
| Screen style factory | `app/settings.tsx` | `app/login.tsx`, `app/register.tsx` |

## Complexity Tracking

No constitution violations — table not needed.
