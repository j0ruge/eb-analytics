# Gemini Code Assist Review — PR #6

**Repository**: j0ruge/eb-analytics
**Reviewer**: gemini-code-assist[bot]
**Date**: 2026-04-19
**Total findings**: 3

All three findings target `src/services/syncService.ts`. Two are N+1 query patterns; one is a UX issue around auth-failure retry timing.

---

## Findings

- [x] **1. [HIGH] src/services/syncService.ts:494 — 401 auth failure leaves rows with future backoff** — Fixed
  Severity recalibrated from MEDIUM to HIGH: broken feature flow, not just cosmetic. Added a dedicated `revertToQueuedClearBackoff` helper (and its `-Inner` transactional variant) that resets `sync_next_attempt_at = NULL` and `sync_attempt_count = 0`. The 401 branch now calls this instead of the backoff-applying revert, so items flush immediately after the user signs back in.

- [x] **2. [MEDIUM] src/services/syncService.ts:150–157 — N+1 on lesson fetch during batch build** — Fixed
  Added `lessonService.getByIdsWithDetails(ids)` that issues a single `WHERE id IN (?, ?, …)` query with the same joins as `getByIdWithDetails`. `syncService.loadLessonsByIds` now delegates to it. For a 20-item batch this collapses 20 round-trips into one.

- [x] **3. [MEDIUM] src/services/syncService.ts:171–174 — N+1 on `sync_attempt_count` read inside requeue loop** — Fixed
  `claimBatch` now returns `ClaimedItem[]` (`{ id, attemptCount }`) and its `SELECT` already pulls `sync_attempt_count`. `revertToQueuedWithBackoffInner` accepts the items directly and uses the pre-read count — no per-row `SELECT` inside the loop. All other revert call sites (401 clear-backoff, 413, 5xx, defensive, transient) now thread `ClaimedItem[]` too.

---

## Final Result

| Status | Count |
|--------|-------|
| Fixed | 3 |
| Already fixed | 0 |
| Not applicable | 0 |
| Pending | 0 |

**Tests**: `npm test` → 147/147 passing (13 suites). `npx playwright test` → 31/31 passing (1 skipped SOAK_REAL, by design). `npm run lint` → 0 errors.
