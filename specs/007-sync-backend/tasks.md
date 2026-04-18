---
description: "Task list for Cloud Sync Backend (spec 007)"
---

# Tasks: Cloud Sync Backend

**Input**: Design documents from `specs/007-sync-backend/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/{auth,sync,catalog,instances,users,error-codes}.md, quickstart.md

**Tests**: INCLUDED — the spec defines property-based correctness criteria (SC-001, SC-002) and explicit per-scenario acceptance tests per user story. Testing strategy is fixed in `research.md §14`: unit / integration / property / load layers via Vitest + fast-check + autocannon.

**Organization**: One phase per user story. All backend work lives under `server/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unfinished dependencies)
- **[Story]**: User story label (US1..US7) on user-story phase tasks only
- Paths are absolute within the repo (`server/...`)

## Path Conventions

Monorepo web service. All tasks touch `server/**`; mobile code (`src/`, `app/`) is off-limits (server CLAUDE §9). Test files live in `server/test/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bring the `server/` package to a buildable state and provide the Docker artifacts required by SC-004.

- [X] T001 Add runtime deps to `server/package.json`: `@fastify/cors`, `@fastify/rate-limit`, `@fastify/sensible`, and devDeps `fast-check`, `autocannon`, `@types/autocannon`
- [X] T002 Run `npm install` in `server/` to refresh `server/package-lock.json`
- [X] T003 [P] Create `server/.env.example` with `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `LOG_LEVEL`, `PORT` (matches quickstart.md §1)
- [X] T004 [P] Create `server/Dockerfile` as a multi-stage build on `node:22-alpine` with `npx prisma generate` and `tsc` in stage 1 and a non-root runtime in stage 2 (research §15)
- [X] T005 [P] Create `server/docker-compose.yml` with `db` (postgres:16) and `server` services, wait-for-db entrypoint, mounted volume `pg_data`, exposing port 3000
- [X] T006 [P] Update `server/tsconfig.json` to include `"types": ["vitest/globals"]` and confirm strict, NodeNext module settings
- [X] T007 [P] Update `server/.gitignore` to exclude `dist/`, `src/generated/`, `.env`, `node_modules/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: All infrastructure every user story depends on — Prisma schema + migration, shared libs, plugins, error handling, aggregation service, test harness. No story work begins until this phase passes lint+build.

**⚠️ CRITICAL**: No user story (Phase 3+) may start before this phase is complete.

- [X] T008 **PRECONDITION** (data-loss gate per plan §Constitution Check item IV): before editing the schema, confirm with the operator that no production or staging DB has been pointed at this `server/` codebase — this migration rewrites the scaffold and will drop `Professor.docId` plus the `COMPLETED` status. If any DB has live rows, STOP and write a data-preserving migration instead. Once confirmed empty, revise `server/prisma/schema.prisma` per `data-model.md`: rename `Professor.docId` → `Professor.email String? @unique`, reduce `CollectionStatus` to `{SYNCED, REJECTED}`, add `LessonCollection.rejectionReason String?`
- [X] T009 Generate first migration at `server/prisma/migrations/0001_sync_backend_schema/migration.sql` via `npx prisma migrate dev --name sync_backend_schema`
- [X] T010 Append raw SQL constraints to `server/prisma/migrations/0001_sync_backend_schema/migration.sql`: (a) `ALTER TABLE "LessonCollection" ADD CONSTRAINT rejection_reason_required CHECK ((status='REJECTED' AND "rejectionReason" IS NOT NULL) OR (status='SYNCED' AND "rejectionReason" IS NULL))`; (b) `CREATE UNIQUE INDEX lesson_instance_date_series_no_topic_key ON "LessonInstance"("date", "seriesCode") WHERE "topicId" IS NULL` — closes the NULL-is-distinct gap in `@@unique([date, seriesCode, topicId])` so two topicless instances cannot coexist on the same day/series (data-model.md §LessonInstance)
- [X] T011 Create `server/src/lib/prisma.ts` — `PrismaClient` singleton using `PrismaPg` adapter from `@prisma/adapter-pg`
- [X] T012 [P] Create `server/src/lib/errors.ts` — `HttpError` class with `{code, message, statusCode}` and helper `httpError(code, message, status)` (FR-065)
- [X] T013 [P] Create `server/src/lib/jwt.ts` — `signToken(user)` / `verifyToken(raw)` HS256, 7d TTL, payload `{sub, role, iat, exp}` from `JWT_SECRET` (FR-064, research §2)
- [X] T014 [P] Create `server/src/lib/hash.ts` — `hashPassword(plain)` / `verifyPassword(plain, hash)` using bcrypt cost 12 (FR-014, research §3)
- [X] T015 [P] Create `server/src/lib/median.ts` — pure numeric `median(values: number[]): number` with stable tie-break (lower-middle of sorted array)
- [X] T016 [P] Create `server/src/lib/schemaVersion.ts` — `SUPPORTED_SCHEMA_VERSION = "2.0"` (exact string literal — must match the `const` in `specs/005-export-contract-v2/contracts/export-envelope.v2.schema.json`) and `assertSchemaVersion(body)` that throws `schema_version_required` when missing, `schema_version_unsupported` when the value is anything other than `"2.0"` (EC-006, research §7)
- [X] T017 [P] Create `server/src/lib/roles.ts` — re-export `Role` enum from generated client, no runtime logic
- [X] T018 Create `server/src/plugins/errorHandler.ts` — Fastify plugin that catches thrown errors and emits `{code, message}` JSON with the `HttpError.statusCode`; falls back to 500 `internal_error` (FR-065, error-codes.md)
- [X] T019 [P] Create `server/src/plugins/auth.ts` — `onRequest` hook that reads `Authorization: Bearer …`, verifies via `lib/jwt.ts`, attaches `request.user = {id, role}` or leaves null
- [X] T020 [P] Create `server/src/plugins/rbac.ts` — `requireRole(role: Role)` pre-handler that throws `unauthenticated` when no user or `forbidden` when role mismatches (FR-060, FR-061)
- [X] T021 [P] Create `server/src/plugins/cors.ts` — registers `@fastify/cors` with origin list parsed from `CORS_ORIGIN` (FR-062, research §5)
- [X] T022 [P] Create `server/src/plugins/rateLimit.ts` — registers `@fastify/rate-limit` with 60/min per `request.user.sub ?? request.ip`, scoped to `POST`/`PATCH`/`DELETE` (FR-063, research §4)
- [X] T023 Create `server/src/services/aggregateService.ts` — `recompute(tx, lessonInstanceId)` that: takes `pg_advisory_xact_lock(hashtext(id))`, loads instance + eligible collections (SYNCED + accepted-override-or-user-accepted), applies `includes_professor` −1 normalization, writes median `aggStart/Mid/End`, `aggDist`, `aggCollectorCount`, clears all to null when empty (Aggregation Rules §1-4, research §9)
- [X] T024 Create `server/src/server.ts` — `buildApp()` factory that registers plugins (errorHandler, cors, auth, rbac, rateLimit) and a bare `pino` logger; `main()` invokes `app.listen({port: PORT, host: '0.0.0.0'})`
- [X] T025 Create `server/test/helpers/buildTestApp.ts` — exports `buildTestApp()` (calls `buildApp()`) and `resetDb()` (TRUNCATE every table in FK-safe order via `prisma.$executeRawUnsafe`), used by every integration test
- [X] T026 [P] Create `server/vitest.config.ts` — test env `node`, `test.setupFiles: ['./test/helpers/setup.ts']`, coverage threshold optional, `test.pool: 'forks'` to isolate DB state per file

**Checkpoint**: `npm run build` compiles, `npm test` runs (zero tests still green), `docker compose up -d` boots Postgres + empty server. User story work can begin.

---

## Phase 3: User Story 1 - Receive Idempotent Batch from Client (Priority: P1) 🎯 MVP

**Goal**: POST `/sync/batch` accepts a v2-schema payload from an authenticated collector, persists each collection idempotently keyed by client id, auto-creates pending catalog items from free-text fallbacks, recomputes affected `LessonInstance` aggregates inside the same transaction, returns `{accepted, rejected, server_now}`.

**Independent Test**: With a registered collector user and a valid JWT, POST a batch of 3 collections → all 3 persist, affected aggregates update; re-POST the same batch → identical response but the DB row count is unchanged (SC-001 verification).

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation.**

- [X] T027 [P] [US1] Property test `server/test/sync.idempotency.property.test.ts` — `fast-check` generates random batches (1..100 collections), posts each 1000× in a single Vitest run, asserts final DB row count equals the number of unique ids (SC-001)
- [X] T028 [P] [US1] Integration test `server/test/sync.test.ts` covering US-1 scenarios 1-5, EC-001 (missing catalog reference returned in `rejected[]`), EC-002 (free-text auto-creates pending with `email=null` for Professor), EC-003 (partial batch still 200), EC-006 (schema version required / unsupported — both `missing` and `"2"` rejected; only `"2.0"` accepted), EC-007 (413 batch_too_large). MUST include a "server-only fields are preserved on re-sync" case: ingest a collection, set its `acceptedOverride=true` via direct DB write, re-post the same `id` with newer `clientUpdatedAt` and a subset of client-authored fields, then assert that the re-fetched row has the updated client fields AND still has `acceptedOverride=true` (i.e., the merge is field-level per FR-021, not row-replace)
- [X] T029 [P] [US1] Integration test `server/test/collections.mine.test.ts` for `GET /collections?mine=true[&since=]` — returns only caller's collections, includes both `SYNCED` and `REJECTED` with `rejection_reason` populated when rejected (FR-043)

### Implementation for User Story 1

- [X] T030 [US1] Create `server/src/services/syncService.ts` with `ingestBatch(userId, payload)` that: validates schema version (T016), enforces 500/5MB limits, opens Serializable `$transaction`, upserts referenced catalog items (series by code, topic by `(seriesId, title)`, professor by name with `email=null`) flipping `isPending=true` only on insert, upserts `LessonInstance` by `(date, seriesCode, topicId)`, takes `pg_advisory_xact_lock` per instance, applies **field-level** newer-wins merge keyed by `clientUpdatedAt` — when `clientUpdatedAt` is newer the UPDATE sets ONLY the client-authored columns (attendance*, includesProfessor, uniqueParticipants, real*, weather, notes, clientUpdatedAt) and MUST preserve server-only columns (`acceptedOverride`, `status`, `rejectionReason`, `serverReceivedAt`); never row-replace (FR-021), classifies each collection as `SYNCED` or `REJECTED` with `rejectionReason`, then calls `aggregateService.recompute` for every touched instance, returns `{accepted, rejected, server_now}`
- [X] T031 [US1] Create `server/src/routes/sync.ts` — `POST /sync/batch` Fastify plugin with JSON Schema body validation sourced from `specs/005-export-contract-v2/contracts/export-envelope.v2.schema.json`, `bodyLimit: 5*1024*1024`, auth required via `plugins/auth.ts`, delegates to `syncService.ingestBatch`
- [X] T032 [US1] Create `server/src/routes/collections.ts` — `GET /collections?mine=true[&since=]` returning serialized collections per `contracts/sync.md` (FR-043); rejects any `mine` value other than `true` with `invalid_query`
- [X] T033 [US1] Register `routes/sync.ts` and `routes/collections.ts` in `server/src/server.ts` after the auth plugin; wire rate-limit to POST

**Checkpoint**: US-1 fully testable. Running `vitest run test/sync*.test.ts test/collections.mine.test.ts` passes all assertions.

---

## Phase 4: User Story 2 - Serve Catalog to Clients (Priority: P1)

**Goal**: `GET /catalog` returns the three non-pending arrays plus `server_now`; supports `?since=` incremental pulls; topics are pre-sorted; `?include_pending=true` is coordinator-only.

**Independent Test**: Authenticate as any role, fetch catalog → receive the three arrays; add a curated series via direct DB insert, fetch with `since` = previous `server_now` → only the new series is in the response.

### Tests for User Story 2

- [X] T034 [P] [US2] Integration test `server/test/catalog.reads.test.ts` covering US-2 scenarios 1-4: baseline full catalog, `since` filter, pending exclusion by default, pending inclusion coordinator-only with 403 for collector, topic sort order

### Implementation for User Story 2

- [X] T035 [US2] Create `server/src/services/catalogService.ts` with `listCatalog({since?, includePending, actorRole})` that returns `{series, topics, professors, server_now}` filtered by `updatedAt > since` when provided, with pending hidden unless `includePending && actorRole === 'COORDINATOR'`; topics sorted by `(seriesId, sequenceOrder)` (FR-030, FR-031)
- [X] T036 [US2] Create `server/src/routes/catalog.ts` with `GET /catalog` handler only (mutations land in Phase 8); enforces coordinator gate on `include_pending=true` before calling the service
- [X] T037 [US2] Register `routes/catalog.ts` in `server/src/server.ts`

**Checkpoint**: US-2 tests green. Clients can pull catalog; collectors cannot see pending items.

---

## Phase 5: User Story 3 - Compute Aggregates Across Collectors (Priority: P1)

**Goal**: Coordinator-only `GET /instances` endpoints expose each `LessonInstance` with its contributing collections and aggregate values; `POST /instances/:id/recompute` forces re-aggregation.

**Independent Test**: Seed 3 collections for one lesson with attendance_start `[10,12,15]` → `GET /instances/:id` returns `agg_start = 12`; set one contributor's `user.accepted = false` → aggregate recomputes automatically to the median of the remaining two; flip `includes_professor=true` on one submission → counts decremented by 1 before median.

### Tests for User Story 3

- [X] T038 [P] [US3] Property test `server/test/aggregation.property.test.ts` — `fast-check` generates random `{attendance_start[], includes_professor[], user_accepted[]}` arrays, asserts `aggStart` equals the median of `includes_professor`-normalized, eligibility-filtered values; runs 1000× (SC-002)
- [X] T039 [P] [US3] Integration test `server/test/instances.test.ts` covering US-3 scenarios 1-5 plus FR-040 (collector forbidden to see aggregates), FR-041 (single instance fetch), FR-042 (forced recompute)

### Implementation for User Story 3

- [X] T040 [US3] Create `server/src/routes/instances.ts` with `GET /instances?from=&to=`, `GET /instances/:id`, `POST /instances/:id/recompute`; all guarded by `requireRole(COORDINATOR)`; the POST calls `aggregateService.recompute(prisma, id)` inside a transaction
- [X] T041 [US3] Register `routes/instances.ts` in `server/src/server.ts`

**Checkpoint**: Aggregates visible to coordinators, property-verified for correctness across random inputs.

---

## Phase 6: User Story 4 - Authenticate Users (Priority: P1)

**Goal**: `POST /auth/register`, `POST /auth/login`, `GET /me` cover the auth lifecycle; first registered user is promoted to `COORDINATOR`; login error leaks nothing; password minimum 8 chars.

**Independent Test**: Register against an empty DB → response user `role="COORDINATOR"`; register a second user → `role="COLLECTOR"`; login with wrong password → 401 `invalid_credentials`; login with 7-char password on register → 400 `password_too_short`.

### Tests for User Story 4

- [X] T042 [P] [US4] Integration test `server/test/auth.test.ts` covering US-4 scenarios 1-5 and FR-015 (8-char minimum), asserting error `code` values (`invalid_credentials`, `password_too_short`, `email_already_registered`) against the registry in `contracts/error-codes.md`

### Implementation for User Story 4

- [X] T043 [US4] Create `server/src/services/authService.ts` with `register(dto)` (tx: count users; first → COORDINATOR, else COLLECTOR; hash password; insert; return `{jwt, user}`), `login(email, password)` (generic `invalid_credentials` on any failure), `getMe(userId)` (per FR-012)
- [X] T044 [US4] Create `server/src/routes/auth.ts` with `POST /auth/register` (validates `password.length >= 8` in-body schema → `password_too_short`), `POST /auth/login`, `GET /me` (auth required)
- [X] T045 [US4] Register `routes/auth.ts` in `server/src/server.ts` BEFORE the blanket auth gate, since register/login are public (FR-060)

**Checkpoint**: Every other phase's integration tests can now use `authService.register` (directly) to create fixture users; full HTTP flow exercisable via the three endpoints.

---

## Phase 7: User Story 5 - Coordinator Moderation Endpoints (Priority: P2)

**Goal**: Coordinators list users and toggle `accepted`; toggling a user recomputes every affected `LessonInstance` in the same transaction (SC-006).

**Independent Test**: Seed 100 instances where user `U` contributes at least one collection each → `PATCH /users/U/accepted {accepted:false}` completes in <1 s and every affected aggregate reflects U's exclusion.

### Tests for User Story 5

- [X] T046 [P] [US5] Integration test `server/test/moderation.test.ts` covering US-5 scenarios 1-3 and SC-006 timing assertion (patch call must resolve in <1 s for ~100 affected instances)

### Implementation for User Story 5

- [X] T047 [US5] Create `server/src/services/moderationService.ts` with `listUsers()` and `toggleAccepted(userId, accepted)`; the latter opens a transaction, updates the flag, fetches the distinct set of `lessonInstanceId` the user has contributed to via `LessonCollection.collectorUserId=userId`, and calls `aggregateService.recompute(tx, instanceId)` for each (FR-051)
- [X] T048 [US5] Create `server/src/routes/users.ts` with `GET /users` and `PATCH /users/:id/accepted`; both guarded by `requireRole(COORDINATOR)`
- [X] T049 [US5] Register `routes/users.ts` in `server/src/server.ts`

**Checkpoint**: Moderation round-trip works; cascade recompute verified under realistic load.

---

## Phase 8: User Story 6 - Coordinator Manages Catalog (Priority: P2)

**Goal**: Coordinators CRUD series / topics / professors; deletions refused with `*_referenced` when still in use.

**Independent Test**: Create a series → it appears in `GET /catalog`; PATCH its title → `updated_at` refreshes; DELETE while a `LessonInstance` references it → 409 `series_referenced`; DELETE after removing references → 204.

### Tests for User Story 6

- [X] T050 [P] [US6] Integration test `server/test/catalog.mutations.test.ts` covering US-6 scenarios 1-4 (create / patch / delete / referenced-conflict) for all three resources, plus coordinator-only gate (FR-032..034)

### Implementation for User Story 6

- [X] T051 [US6] Extend `server/src/services/catalogService.ts` with `createSeries/Topic/Professor(dto)` (sets `isPending=false`), `updateSeries/Topic/Professor(id, partial)` (refreshes `updatedAt`), and `deleteSeries/Topic/Professor(id)` (counts references in `LessonInstance`, throws `*_referenced` when non-zero)
- [X] T052 [US6] Extend `server/src/routes/catalog.ts` with `POST /catalog/:resource`, `PATCH /catalog/:resource/:id`, `DELETE /catalog/:resource/:id` for `resource ∈ {series, topics, professors}`; all guarded by `requireRole(COORDINATOR)`

**Checkpoint**: Catalog is coordinator-curatable end to end; pending items auto-created by sync can be cleaned up.

---

## Phase 9: User Story 7 - Health and Observability (Priority: P3)

**Goal**: `GET /health` reports DB reachability; every request logs a structured line with `req_id`, `method`, `url`, `statusCode`, `responseTime`.

**Independent Test**: With Postgres up, `GET /health` → 200 `{status:"ok", postgres:"up"}`; stop Postgres container → `GET /health` → 503 `{status:"degraded", postgres:"down"}`; any request emits a JSON log with all five fields.

### Tests for User Story 7

- [X] T053 [P] [US7] Integration test `server/test/health.test.ts` covering US-7 scenarios 1-3 (healthy, degraded via Prisma connection stub, log line shape)

### Implementation for User Story 7

- [X] T054 [US7] Create `server/src/routes/health.ts` — `GET /health` runs `prisma.$queryRawUnsafe('SELECT 1')` with a 500 ms timeout, returns 200 or 503 per research §13; no auth required (FR-060 exempts it)
- [X] T055 [US7] Configure `pino` in `server/src/server.ts` with `genReqId: () => crypto.randomUUID()`, `redact: ['req.headers.authorization', 'req.body.password']`, pretty transport in non-production (US-7 scenario 3, research §12)
- [X] T056 [US7] Register `routes/health.ts` in `server/src/server.ts` BEFORE the blanket auth gate

**Checkpoint**: Operator has an endpoint to monitor and structured logs to debug.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Performance validation, registry consistency, docs.

- [X] T057 [P] Load test `server/test/load/sync-latency.k6.js` — posts a 50-collection batch, asserts p95 < 500 ms on the reference rig (2 vCPU / 2 GB RAM) per SC-003. **MVP gate**: this test MUST be executed and pass before tagging an MVP release (referenced from §Implementation Strategy below); it is marked Phase 10 because the test code lands last, not because its pass/fail is optional. Document run command + reference-rig specs in `server/README.md`
- [X] T058 [P] Load test `server/test/load/concurrent-writes.k6.js` — fires 10 parallel batches at a single lesson instance, asserts every collection persisted and final aggregate matches expected median (SC-005)
- [X] T059 [P] Load test `server/test/load/moderation-recompute.k6.js` — seeds a user with ~100 contributing instances, patches `accepted=false`, asserts total wall time < 1 s (SC-006)
- [X] T060 [P] Create `server/test/lib/error-codes.check.test.ts` — static-asserts that every `HttpError.code` literal used in `server/src/**` appears in `specs/007-sync-backend/contracts/error-codes.md` (guard against registry drift)
- [X] T061 [P] Update `server/README.md` to point at `specs/007-sync-backend/quickstart.md` and the contracts directory
- [X] T062 Run `specs/007-sync-backend/quickstart.md` end-to-end manually on a clean Docker environment; record timing to validate SC-004 (<5 minutes)
- [X] T063 [P] Integration test `server/test/rateLimit.test.ts` — acquires a JWT via `authService.register`, bursts 61 `POST /sync/batch` calls inside a single minute against a dev-tuned limiter (window may be shortened to seconds for test speed as long as the per-window count under test equals the production value), asserts that at least one call returns HTTP 429 with `code: rate_limited`, and that `GET` reads in the same window are NOT throttled (FR-063)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup. Blocks all user stories.
- **Phase 3 (US-1 Sync)**: Depends on Phase 2 (needs Prisma, aggregate service, auth plugin, test harness). MVP-critical.
- **Phase 4 (US-2 Catalog reads)**: Depends on Phase 2. Independent of US-1 but shares the test harness.
- **Phase 5 (US-3 Aggregation)**: Depends on Phase 2 (aggregate service already lives in foundational); US-3 surface is just the read endpoints + property tests. Can overlap with US-1.
- **Phase 6 (US-4 Auth)**: Depends on Phase 2. **Soft-blocks full-stack HTTP testing of US-1/2/3**, but those phases' integration tests can bypass HTTP auth by calling `authService.register` directly — so phases 3–6 can proceed in parallel.
- **Phase 7 (US-5 Moderation)**: Depends on Phase 2 + Phase 6 (needs registered users).
- **Phase 8 (US-6 Catalog mutations)**: Depends on Phase 2 + Phase 6 (coordinator JWT required).
- **Phase 9 (US-7 Health)**: Depends on Phase 2 only. Independent of every other story.
- **Phase 10 Polish**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US-1 (P1)**: Phase 2 only. Independently testable.
- **US-2 (P1)**: Phase 2 only. Independent.
- **US-3 (P1)**: Phase 2 only. Independent (aggregateService lives in foundational).
- **US-4 (P1)**: Phase 2 only. Independent.
- **US-5 (P2)**: Phase 2 + US-4 (needs users).
- **US-6 (P2)**: Phase 2 + US-4 (needs coordinator JWT).
- **US-7 (P3)**: Phase 2 only. Independent.

### Within Each User Story

- Tests MUST be written and FAIL before implementation.
- Services before routes.
- Route registration (`server.ts`) is the last step of each story phase.

### Parallel Opportunities

- Phase 1: T003..T007 all `[P]`.
- Phase 2: T012..T017, T019..T022, T026 all `[P]` once T008–T011 (Prisma) and T018 (errorHandler) land.
- Phase 3+: Every test task per story is `[P]`. The implementation service and route tasks inside one story touch the same files (e.g., `server.ts`) so they are sequential.
- Across phases: once Phase 2 is done, US-1 / US-2 / US-3 / US-4 / US-7 can progress in parallel with different developers; US-5 and US-6 wait for US-4.

---

## Parallel Example: Phase 2 Foundational

```bash
# Sequential gate first — schema + migration must exist
Task: T008 Revise server/prisma/schema.prisma
Task: T009 Generate first Prisma migration
Task: T010 Append rejection_reason check constraint
Task: T011 Create server/src/lib/prisma.ts
Task: T018 Create server/src/plugins/errorHandler.ts

# Then fan out — all independent files
Task: T012 [P] server/src/lib/errors.ts
Task: T013 [P] server/src/lib/jwt.ts
Task: T014 [P] server/src/lib/hash.ts
Task: T015 [P] server/src/lib/median.ts
Task: T016 [P] server/src/lib/schemaVersion.ts
Task: T017 [P] server/src/lib/roles.ts
Task: T019 [P] server/src/plugins/auth.ts
Task: T020 [P] server/src/plugins/rbac.ts
Task: T021 [P] server/src/plugins/cors.ts
Task: T022 [P] server/src/plugins/rateLimit.ts
Task: T026 [P] server/vitest.config.ts

# Then converge
Task: T023 server/src/services/aggregateService.ts
Task: T024 server/src/server.ts (buildApp)
Task: T025 server/test/helpers/buildTestApp.ts
```

## Parallel Example: Phase 3 User Story 1

```bash
# All three test files are independent
Task: T027 [P] [US1] server/test/sync.idempotency.property.test.ts
Task: T028 [P] [US1] server/test/sync.test.ts
Task: T029 [P] [US1] server/test/collections.mine.test.ts

# Implementation — syncService + route + register — sequential because server.ts is shared
Task: T030 [US1] server/src/services/syncService.ts
Task: T031 [US1] server/src/routes/sync.ts
Task: T032 [US1] server/src/routes/collections.ts
Task: T033 [US1] Register routes in server/src/server.ts
```

---

## Implementation Strategy

### MVP Scope

1. Phase 1 Setup → Phase 2 Foundational.
2. Phase 6 (US-4 Auth) **before** all the other P1 stories, because auth is the real prerequisite for anything a user touches end-to-end. The dependency graph above allows this reordering.
3. Phase 3 (US-1 Sync) — the reason the backend exists.
4. Phase 4 (US-2 Catalog reads) — unblocks the client's dropdowns.
5. Phase 5 (US-3 Aggregation) — makes collected data actionable.
6. Run T057 (SC-003 latency load test) on the reference rig — MUST pass before cutting an MVP release per C1 remediation.
7. **Stop and validate**: run `specs/007-sync-backend/quickstart.md` end-to-end — this is the MVP.

### Incremental Delivery After MVP

7. Phase 7 (US-5 Moderation).
8. Phase 8 (US-6 Catalog mutations).
9. Phase 9 (US-7 Health & observability).
10. Phase 10 Polish (load tests, registry check, docs).

### Parallel Team Strategy

With two developers after Phase 2 is done:

- Dev A: Phase 6 (Auth) → Phase 3 (Sync) → Phase 5 (Aggregation).
- Dev B: Phase 9 (Health) → Phase 4 (Catalog reads) → Phase 8 (Catalog mutations).

Moderation (Phase 7) lands after Auth + Sync; either dev can take it.

---

## Notes

- Every test task MUST be written and asserted to FAIL before its implementation task starts.
- `[Story]` label is absent on Setup, Foundational, and Polish phases by design.
- Each service/route task touches a single file; dependent route tasks within one phase are sequential because they share `server/src/server.ts`.
- `server/src/generated/client/` is produced by `npx prisma generate` during T009 and is git-ignored.
- Assertions against error responses MUST key off the English `code` field per FR-065; pt-BR `message` is advisory.
