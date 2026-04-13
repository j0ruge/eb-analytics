# Copilot Review — PR #4

**Repository**: j0ruge/eb-analytics
**Branch**: `006-auth-identity` → `main`
**Reviewer**: copilot-pull-request-reviewer[bot]
**Total comments**: 5
**Date**: 2026-04-13

---

## Checklist

### HIGH

- [x] **1. [HIGH] src/services/authService.ts:60 — Inconsistent session state when user JSON is missing**
  `getSession()` can return `null` while JWT remains in storage, causing API calls to still send `Authorization: Bearer` header even though app treats user as anonymous. Should clear JWT proactively.
  - **Status**: Fixed — added `clearJwt()` call when userJson is missing or user data is corrupt/incomplete.

- [x] **2. [HIGH] src/services/apiClient.ts:15 — Empty `BASE_URL` causes opaque fetch failures in prod**
  When `apiUrl` not configured, `BASE_URL` is `''`, fetch fails as `Sem conexão` (status 0), indistinguishable from real network failure.
  - **Status**: Fixed — added early return `{ error: 'API não configurada', status: 0 }` at start of `request()` when BASE_URL is empty.

### MEDIUM

- [x] **3. [MEDIUM] src/services/apiClient.ts:69 — Truthy check drops valid falsy request body values**
  `body ? JSON.stringify(body) : undefined` drops `0`, `false`, `''`, `null`. Should use `body !== undefined`.
  - **Status**: Fixed — changed to `body !== undefined ? JSON.stringify(body) : undefined`.

- [x] **4. [MEDIUM] src/services/exportService.ts:153 — Collector from AsyncStorage cache, not full session**
  `getCurrentUser()` reads AsyncStorage only. If JWT wiped but cache survives, exports include stale collector identity.
  - **Status**: Fixed — changed to `authService.getSession()` which validates JWT + user atomically. Updated tests to match.

### LOW

- [x] **5. [LOW] src/db/migrations.ts:232 — Migration-flag logic duplicated instead of reusing helpers**
  `migrateAddAuthIdentity` re-implements `_migration_flags` table query inline rather than reusing `isMigrationComplete`/`markMigrationComplete` helpers.
  - **Status**: Not applicable — existing helpers use AsyncStorage, not SQLite. Migration 006 deliberately uses `_migration_flags` SQLite table, which is a different and better mechanism. Extracting a shared helper is deferred to when migration 003 is refactored.

---

## Final Result

| Status | Count |
|--------|-------|
| Fixed | 4 |
| Already fixed | 0 |
| Not applicable | 1 |
| Pending | 0 |
| **Total** | **5** |

### Tests
- **Command**: `npm test`
- **Result**: All passed (115 tests, 10 suites)

### Conversations
Pending
