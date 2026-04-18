# CodeRabbit Review — PR #5

**Repository**: j0ruge/eb-analytics
**PR**: feat(server): cloud sync backend (spec 007)
**Branch**: `007-sync-backend` → `main`
**Reviewer**: coderabbitai[bot]
**Date**: 2026-04-18
**Total findings**: 28 (7 inline + 21 from review body; 1 duplicate collapsed)

## Legend
- `[x]` resolved • **Fixed** / **Already fixed** / **Not applicable** / **Deferred (out of spec-007 scope)**

---

## CRITICAL (2)

- [x] **1.** `server/Dockerfile:28` — Prisma CLI unavailable in runtime — **Fixed** — `prisma` moved from `devDependencies` to `dependencies` in `server/package.json` so `npm ci --omit=dev` keeps it and `npx prisma migrate deploy` no longer triggers a network fetch at container start.
- [x] **2.** `server/src/services/syncService.ts:309` — Race on professorId update — **Fixed** — both `ON CONFLICT` branches now set `"professorId" = COALESCE("LessonInstance"."professorId", EXCLUDED."professorId")` atomically; removed the separate SELECT+UPDATE round that raced under concurrent batches.

## HIGH / MAJOR — product code (9)

- [x] **3.** `server/prisma/migrations/0002_concurrency_fixes/migration.sql:11-20` — **Fixed** — added two `WITH ranked AS (...) UPDATE LessonInstance SET topicId/professorId = keeper; DELETE duplicates` preflight passes so the unique-index creation succeeds on DBs that already have duplicate pending rows from the pre-migration race.
- [x] **4.** `server/test/helpers/setup.ts:2-6` — **Fixed** — setup now hard-requires either `TEST_DATABASE_URL` (preferred) or a `DATABASE_URL` that looks like a local test DB (`localhost|127.0.0.1|@db:` AND `_test|eb_insights`); otherwise throws and refuses to run `resetDb()`.
- [x] **5.** `server/src/routes/auth.ts:37-62` — **Fixed** — declared `userSchema` + `authResponseSchema`, wired `schema.response` on `/auth/register` (201), `/auth/login` (200), and `/me` (200).
- [x] **6.** `server/src/routes/instances.ts:16-50` — **Fixed** — added `listQuerySchema` on `/instances`, `idParamsSchema` on `/instances/:id` and `/instances/:id/recompute`. Schema stays loose on `from/to` shape so the handler keeps returning `invalid_query` (contract-documented) rather than the generic Fastify `invalid_payload`.
- [x] **7.** `server/docker-compose.yml:4-27` — **Fixed** — `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`/`DATABASE_URL` now required via `${VAR:?}` (compose refuses to start without them); Postgres port bound to `127.0.0.1` by default with an opt-in override via `DB_PORT_BIND`.
- [x] **8.** `server/src/server.ts:29-37` — **Fixed** — `TRUST_PROXY` parsing now fail-closed: `undefined`/empty/`"false"`/`"0"` → `false`; `"true"` → `true`; positive integer → hop count; any other value (including `NaN`) → `false`. Also duplicate of Gemini #1.
- [x] **9.** `server/src/services/syncService.ts:448-472` — **Fixed** — update path now mirrors the REJECTED-insert defensive fallbacks when `dataError` is set, preserving existing field values when the new payload's `c.times`/`c.attendance` are malformed instead of crashing on `c.times.expected_start`.
- [x] **10.** `server/src/services/syncService.ts:93-108` — **Fixed** — `validateInstanceStructure` now guards: `c` is object, `c.id` is non-empty string, `c.lesson_instance.date` is string (not coerced), and each of `series_id`/`series_code_fallback`/`topic_id`/`topic_title_fallback`/`professor_id`/`professor_name_fallback` is either `null` or `string`, and both timestamps are strings that `Date.parse` accepts.
- [x] **11.** `server/src/services/catalogService.ts:225-253` — **Fixed** — `deleteSeries` now wraps the transaction in `try/catch` and maps Prisma `P2003` (FK violation) from concurrent inserts to `409 series_referenced` instead of 500. Added `isPrismaForeignKeyViolation` helper.

## MAJOR — docs / specs / templates (11)

- [x] **12.** `server/src/services/catalogService.ts:258-289` — **Fixed** — added `parseOptionalDate()` helper that rejects bad ISO strings with `400 invalid_payload`; `createTopic` and `updateTopic` now both validate `sequence_order` is integer ≥ 0. Error-code casing: `server/CLAUDE.md` corrected — the impl + PRD both use `lower_snake_case` (the CLAUDE.md `UPPER_SNAKE_CASE` row was drift).
- [x] **13.** `specs/007-sync-backend/prd.md:160-162` — **Fixed** — FR-021 updated to require `existing.collectorUserId === jwt.sub`; `server/src/services/syncService.ts` now rejects cross-collector replays with `409 collection_ownership_conflict` before touching the row.
- [x] **14.** `specs/007-sync-backend/prd.md:69-76` — **Fixed** — harmonized to `/me` throughout the PRD (matches impl, all tests, and other contract docs).
- [x] **15-22.** `.claude/`, `.agent/`, `.agents/`, `.cursor/`, `.gemini/`, `.github/`, `.specify/` speckit scaffolding (`git add .` auto-commit concerns, PS `;` separator) — **Deferred (out of spec-007 scope)** — these are vendored templates from the speckit toolkit, not active hooks on this repo (nothing in this branch wires them up to auto-run). The concerns are valid but the fix belongs upstream in the speckit skill package or in a dedicated tooling PR; rewriting all 8 mirrored copies in this PR would create churn without reducing exposure because they don't execute. Tracking note added for a follow-up tooling PR.

## MAJOR — load tests (3)

- [x] **23.** `server/test/load/sync-latency.k6.js:52` — **Fixed** — `unique_participants` raised to 60 and `attendance.start/mid/end` clamped to `min(base + i, uniq)` so no generated collection fails `validateCollectionData`'s "attendance ≤ unique_participants" invariant.
- [x] **24.** `server/test/load/sync-latency.k6.js:76` — **Fixed** — switched from `setupClient` + shared body to `setupRequest` + fresh `buildBatch()` per request; every request now carries a fresh set of UUIDs, so the server does real insert work instead of hitting the idempotent fast-path.
- [x] **25.** `server/test/load/sync-latency.k6.js:95` — **Fixed** — added a fail-closed gate: any `errors + timeouts + non2xx > 0` aborts with exit 1 before the p97.5 latency check. The pass line now prints "0 errors" explicitly.

## MINOR (3)

- [x] **26.** `server/test/helpers/fixtures.ts:9` — **Fixed** — `pinnedOrRandom()` helper now rejects env-pinned values shorter than 8 chars and falls back to `randomBytes(12).toString('hex')` so `registerUser()` never hits `password_too_short` due to a too-short pinned `TEST_PASSWORD`.
- [x] **27.** `server/test/helpers/fixtures.ts:15` — **Fixed** — `nextEmail()` now uses `randomUUID()` instead of a process-local counter + `Date.now()`; parallel vitest workers against a shared DB no longer collide.
- [x] **28.** `specs/007-sync-backend/quickstart.md:58-73` — **Fixed** — payload rewritten to the nested v2 envelope (`lesson_instance`, `times`, `attendance`) matching what `syncService` validates and what `server/README.md` already documented.

---

## Final Result

| Status | Count |
|--------|-------|
| Fixed | 20 |
| Already fixed | 0 |
| Not applicable | 0 |
| Deferred (out of scope) | 8 (speckit scaffolding items #15-22) |
| Pending | 0 |

Tests: **73 of 73 passed** with `TEST_DATABASE_URL` set, `npm test` via `vitest run`. No regressions from any of the applied fixes.
