# Copilot Review — PR #3

**Repository**: j0ruge/eb-analytics
**Branch**: `005-export-contract-v2` → `main`
**Reviewer**: copilot-pull-request-reviewer[bot]
**Total comments**: 6
**Date**: 2026-04-12

---

## Checklist

### HIGH

- [x] **1. [HIGH] src/services/lessonService.ts:177 — `status` field silently blocked by SKIP_FIELDS**
  `updateLesson` filters out `status` via `SKIP_FIELDS`, which prevents `handleComplete()` from marking lessons as COMPLETED — breaking the export lifecycle.
  - **Status**: Fixed — removed `status` from `SKIP_FIELDS`. The filter was added to prevent expo-sqlite crashes from the debounced auto-save, but `status` must pass through for intentional state transitions.

### MEDIUM

- [x] **2. [MEDIUM] src/db/client.ts:83 — `client_updated_at` backfill not crash-safe**
  The `UPDATE ... WHERE client_updated_at IS NULL` backfill only runs inside the `if (!hasClientUpdatedAt)` block. If the app crashes between ALTER and UPDATE, the column exists on next launch but rows have NULL values permanently.
  - **Status**: Fixed — moved the idempotent UPDATE outside the if block so it runs unconditionally on every migration pass.

- [x] **3. [MEDIUM] src/services/exportService.ts:173 — Sharing error message in English**
  The thrown error `"Sharing is not available on this device."` should be in pt-BR.
  - **Status**: Already fixed — changed to Portuguese in CodeRabbit review round (see coderabbit-review.md item #11).

- [x] **4. [MEDIUM] app/lesson/[id].tsx:429 — Inconsistent UI label: "Notas" vs "Observações"**
  Visual label says "Notas" but accessibilityLabel says "Observações". FR-020 uses "Observações" as the card name. The inconsistency confuses screen readers.
  - **Status**: Fixed — aligned visual label to "Observações" to match accessibilityLabel and spec terminology.

- [x] **5. [MEDIUM] app/(tabs)/sync.tsx:28 — Exported-lessons counter stale after v2 export**
  The Sync screen displays `exportedCount` based on `status = EXPORTED`, but v2 exports never write `EXPORTED` status (FR-018). The counter will show 0 for new exports.
  - **Status**: Not applicable — by design per FR-018 ("lessons MUST remain in status COMPLETED after export"). The counter accurately reflects legacy EXPORTED rows. Sync screen UI cleanup is deferred to spec 008 when `sync_status` replaces `status`.

- [x] **6. [MEDIUM] src/services/deviceIdService.ts:16 — Rejected promise cached permanently**
  If AsyncStorage throws, `pendingPromise` stays rejected and all future calls fail without retry.
  - **Status**: Already fixed — added `.catch()` handler in CodeRabbit review round (see coderabbit-review.md item #4).

---

## Final Result

| Status | Count |
|--------|-------|
| Fixed | 3 |
| Already fixed | 2 |
| Not applicable | 1 |
| Pending | 0 |
| **Total** | **6** |

### Tests
- **Command**: `npm test`
- **Result**: All passed (109 tests, 9 suites)

### Conversations
- **Total threads**: 18 (all reviewers combined)
- **Resolved in this run**: 0 (all resolved in previous CodeRabbit round)
- **Previously resolved**: 18
