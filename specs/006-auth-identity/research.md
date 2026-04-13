# Research: Auth & Identity (006)

**Date**: 2026-04-12
**Branch**: `006-auth-identity`

## Decision 1: JWT Storage Mechanism

**Decision**: Use `expo-secure-store` for JWT, `AsyncStorage` for user profile cache.

**Rationale**: JWT is a sensitive credential — storing it in AsyncStorage (which is plain text on Android) would be a security risk. expo-secure-store uses the platform's native keychain (iOS Keychain / Android Keystore). The user profile (id, name, role) is non-sensitive metadata and can stay in AsyncStorage for fast access — same pattern as `deviceIdService`.

**Alternatives considered**:
- AsyncStorage only: simpler, but JWT in plain text is a security antipattern
- expo-secure-store for everything: unnecessary for non-sensitive profile data, and SecureStore has a 2KB value limit on some platforms

## Decision 2: HTTP Client

**Decision**: Use native `fetch` with a thin `apiClient` wrapper. No external dependency.

**Rationale**: React Native includes `fetch` globally. The app only needs simple JSON POST/GET calls to 5 endpoints. A wrapper handles: base URL, auth headers, JSON serialization, error normalization. Adding axios or ky would be unnecessary weight for this use case.

**Alternatives considered**:
- `axios`: full-featured but adds ~30KB and is overkill for 5 endpoints
- `ky`: lighter but still an unnecessary dependency
- Raw `fetch` without wrapper: would duplicate header/error logic across every call

## Decision 3: Auth State Management

**Decision**: React Context (`AuthProvider`) following the existing `ThemeProvider` pattern.

**Rationale**: The app already uses Context + hook pattern successfully for theme state. Auth state has the same characteristics: global, read by many screens, rarely changes, needs to persist across restarts. The codebase doesn't use Redux/Zustand (CLAUDE.md section 9 explicitly says "No Redux, MobX, or Zustand — keep it simple").

**Alternatives considered**:
- Zustand: explicitly excluded by project rules
- Plain AsyncStorage reads in each screen: would cause inconsistent state and duplicate code
- Event emitter pattern: more complex, no existing precedent in codebase

## Decision 4: API Base URL Configuration

**Decision**: Build-time env variable via `app.config.js` using `EXPO_PUBLIC_API_URL`.

**Rationale**: Expo SDK 54 supports `EXPO_PUBLIC_*` env vars natively. Creating `app.config.js` (instead of static `app.json`) allows dynamic config. The current `app.json` stays as the base, extended by the JS config. Users never see or configure the URL.

**Alternatives considered**:
- Settings screen field: rejected — adds technical complexity to non-technical users
- Hardcoded URL: no flexibility for hosting changes
- `.env` file with dotenv: Expo already handles `EXPO_PUBLIC_*` natively, no need for dotenv

## Decision 5: Local User Cache Table

**Decision**: Create a `auth_users` SQLite table to cache user metadata for offline access.

**Rationale**: The spec requires offline access to user profile (display name, role) for header display and role-based UI (FR-012). AsyncStorage stores the current user's profile, but a SQLite table mirrors the server's user list for the coordinator moderation screen (User Story 7). This follows the existing entity-per-table pattern.

**Alternatives considered**:
- AsyncStorage only: works for current user but can't store a list of all users for moderation
- No local cache: would break offline display of user info

## Decision 6: expo-secure-store Web Compatibility

**Decision**: Use `expo-secure-store` with a web fallback to `AsyncStorage`.

**Rationale**: expo-secure-store doesn't support web (throws at runtime). The app runs on web for E2E testing (Playwright). For web, JWT can be stored in AsyncStorage (acceptable for dev/testing, not a production web deployment). The authService abstracts this behind a `tokenStorage` helper.

**Alternatives considered**:
- Skip web support: would break E2E tests
- Use only AsyncStorage everywhere: sacrifices mobile security
- Conditional import: this is essentially what the fallback does, cleanly

## Decision 7: New Screen Files vs Modal

**Decision**: Separate screen files (`app/login.tsx`, `app/register.tsx`) using Expo Router navigation.

**Rationale**: Following existing patterns — the app uses file-based routing with separate screens for entity creation (`app/professors/new.tsx`, `app/lesson/new.tsx`). Login and registration are separate screens navigated from Settings. A modal would break the navigation pattern.

**Alternatives considered**:
- Single auth screen with tabs: adds complexity, login and registration have different fields
- Modal overlay: breaks existing navigation pattern, harder to test with Playwright
