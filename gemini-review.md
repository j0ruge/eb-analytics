# Gemini Code Assist Review — PR #4

**Repository**: j0ruge/eb-analytics
**Branch**: `006-auth-identity` → `main`
**Reviewer**: gemini-code-assist[bot]
**Total comments**: 3
**Date**: 2026-04-13

---

## Checklist

### HIGH

- [x] **1. [HIGH] src/services/apiClient.ts:84 — JWT not cleared on 401 when server returns custom error body**
  EC-001 requires clearing session on 401. Custom JSON error body causes early return at line 88, so `clearJwt()` is never called, leaving stale token.
  - **Status**: Fixed — moved `clearJwt()` call above the error body parsing block, so it always executes on 401 regardless of response body format.

### MEDIUM

- [x] **2. [MEDIUM] src/services/apiClient.ts:28 — JWT read from storage on every request (performance)**
  Dynamic import of `expo-secure-store` and storage read on every API call adds latency. In-memory cache recommended.
  - **Status**: Not applicable — dynamic `import()` is cached by the JS bundler after first resolution. Storage reads are fast (keychain on iOS, Keystore on Android). For ~5 endpoints/session in MVP, the overhead is negligible. Caching introduces stale-token complexity. Acceptable tradeoff.

- [x] **3. [MEDIUM] src/services/apiClient.ts:53 — Missing `BASE_URL` guard causes silent failure on native**
  If `BASE_URL` is empty, `fetch` with relative path fails silently on native.
  - **Status**: Already fixed — see copilot-review.md #2. Guard added at start of `request()`.

---

## Final Result

| Status | Count |
|--------|-------|
| Fixed | 1 |
| Already fixed | 1 |
| Not applicable | 1 |
| Pending | 0 |
| **Total** | **3** |

### Tests
- **Command**: `npm test`
- **Result**: All passed (115 tests, 10 suites)

### Conversations
Pending
