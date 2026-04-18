# Copilot Review — PR #5

**Repository**: j0ruge/eb-analytics
**PR**: feat(server): cloud sync backend (spec 007)
**Branch**: `007-sync-backend` → `main`
**Reviewer**: copilot-pull-request-reviewer[bot]
**Date**: 2026-04-18
**Total findings**: 5

---

## MEDIUM (3)

- [x] **1.** `specs/007-sync-backend/quickstart.md:76` — Flat vs nested v2 envelope — **Already fixed — see coderabbit-review.md #28** (rewrote the quickstart POST payload to the nested `lesson_instance`/`times`/`attendance` envelope so it matches `syncService`'s validator).
- [x] **2.** `specs/007-sync-backend/contracts/sync.md:37` — **Fixed** — contract line for `schema_version_unsupported` now reads `"schema_version ≠ \"2.0\""` (was `≠ "2"`) with an explicit note that the exact string `"2.0"` is the only accepted value.
- [x] **3.** `specs/007-sync-backend/contracts/auth.md:42` — **Fixed** — `invalid_email` doc now says the server uses a pragmatic regex subset of RFC-5321 (not the full grammar), listing the concrete rejection rules so clients know what will fail.

## LOW (2)

- [x] **4.** `server/Dockerfile:28` — Prisma CLI not in runtime — **Already fixed — see coderabbit-review.md #1** (moved `prisma` to `dependencies`).
- [x] **5.** `specs/007-sync-backend/contracts/users.md:18` — TS-union in json fence — **Fixed** — switched fence to `jsonc`, rewrote the example with a single valid `"role": "COLLECTOR"` and a leading comment explaining the allowed enum values; also rewrote the PATCH body snippet so it's valid JSON.

---

## Final Result

| Status | Count |
|--------|-------|
| Fixed | 3 |
| Already fixed (cross-reviewer) | 2 |
| Not applicable | 0 |
| Pending | 0 |

Tests: **73 of 73 passed** — see coderabbit-review.md for details.
