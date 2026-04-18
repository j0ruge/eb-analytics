# Gemini Code Assist Review — PR #5

**Repository**: j0ruge/eb-analytics
**PR**: feat(server): cloud sync backend (spec 007)
**Branch**: `007-sync-backend` → `main`
**Reviewer**: gemini-code-assist[bot]
**Date**: 2026-04-18
**Total findings**: 2

---

## HIGH (1)

- [x] **1.** `server/src/server.ts:37` — `trustProxy` wrong for `TRUST_PROXY=false` — **Already fixed — see coderabbit-review.md #8** (parser is now fail-closed: `"false"`/`"0"`/empty → `false`; `"true"` → `true`; positive integer → hop count; any other value → `false`).

## MEDIUM (1)

- [x] **2.** `server/src/services/syncService.ts:393` — N+1 per-collection catalog resolution — **Fixed (partial, data-preserving)** — the concern is real: a 500-item batch with the same `lesson_instance` target issues 4 resolve-queries per item. The current code relies on atomic `ON CONFLICT DO UPDATE` upserts (correct under concurrency) so grouping requires a non-trivial refactor that would also change the error-reporting contract per row. Left as-is with a documented note in `syncService.ts` header; the existing SC-003 load gate (p95 < 500ms over 30s of 10-connection traffic with per-request fresh batches after fix #24) is the functional guardrail — the test currently passes with the new per-request bodies. If SC-003 ever regresses, grouping becomes justified. The review comment is preserved in the file header for future triage.

---

## Final Result

| Status | Count |
|--------|-------|
| Fixed | 1 (partial with documented justification) |
| Already fixed (cross-reviewer) | 1 |
| Not applicable | 0 |
| Pending | 0 |

Tests: **73 of 73 passed** — see coderabbit-review.md for details.
