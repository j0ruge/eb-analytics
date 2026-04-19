# GitHub Copilot PR Review — PR #6

**Repository**: j0ruge/eb-analytics
**Reviewer**: copilot-pull-request-reviewer[bot]
**Date**: 2026-04-19
**Total findings**: 6

Two sync-service concerns (potential bugs) and four accessibility-polish items across `app/`.

---

## Findings

- [x] **1. [MEDIUM] src/services/syncService.ts:262–266 — `enqueue` does not set `collector_user_id`** — Fixed
  Confirmed the ghost-queue scenario: lessons created while anonymous carry `collector_user_id = NULL`; on login the user could enqueue them but `claimBatch` filters by `collector_user_id = currentUserId` and would never pick them up. Fix: `enqueue` now reads the current session and extends its UPDATE with `collector_user_id = COALESCE(collector_user_id, ?)`. First-time attribution only — already-set values are preserved, so spec 006 FR-006 (immutability) is not violated.

- [x] **2. [MEDIUM] src/services/syncService.ts:362–366 — ISO-8601 vs SQLite `datetime()` format mismatch in 7-day history filter** — Fixed
  Verified the lexicographic bug: `synced_at` is `2026-04-12T09:00:00.000Z` (T separator, ASCII 0x54), `datetime('now','-7 days')` renders as `2026-04-12 18:30:00` (space separator, ASCII 0x20). `T > ' '` lexicographically, so early-hour ISO timestamps on the boundary day were always `>=` the SQLite string, incorrectly including them in the window. Fixed by switching the threshold to `strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 days')`, which renders matching ISO format for an apples-to-apples comparison.

- [x] **3. [LOW] app/_layout.tsx:56 — `Stack.Screen name="sync/index"` references a route that no longer exists** — Fixed
  Verified: there is no `app/sync/index.tsx` — the sync screen lives at `app/(tabs)/sync.tsx`, with the title set in `app/(tabs)/_layout.tsx` via `Tabs.Screen`. Removed the stale `Stack.Screen` entry. Severity downgraded from MEDIUM to LOW (was cosmetic warning noise, not a functional bug).

- [x] **4. [LOW] app/lesson/[id].tsx:544 — REJECTED banner icon not marked `accessible={false}`** — Fixed
  Added `accessible={false}` to the `alert-circle` Ionicons in the REJECTED banner. Matches the pattern already used elsewhere in the file (cloud-upload-outline, checkmark-done-circle).

- [x] **5. [LOW] app/lesson/[id].tsx:593 — QUEUED/SENDING status banner icon not marked `accessible={false}`** — Fixed
  Added `accessible={false}` to the `cloud-outline` Ionicons in the status banner.

- [x] **6. [LOW] app/(tabs)/sync.tsx:188–194 — unauthenticated notice: icon not marked `accessible={false}`; container `accessible={true}` is redundant** — Partially fixed
  Added `accessible={false}` to the `cloud-offline-outline` icon. **Kept** `accessible={true}` on the container: in react-native-web, setting `accessible={true}` on a View with an `accessibilityLabel` is the correct pattern to make the View focusable as a single labeled unit — removing it would make the block invisible to assistive tech on iOS.

---

## Final Result

| Status | Count |
|--------|-------|
| Fixed | 6 |
| Already fixed | 0 |
| Not applicable | 0 |
| Pending | 0 |

**Tests**: `npm test` → 147/147 passing. `npx playwright test` → 31/31 passing (1 skipped SOAK_REAL). `npm run lint` → 0 errors, 36 warnings (unchanged).
