# Feature Specification: Cloud Sync Backend

**Feature Branch**: `007-sync-backend`
**Created**: 2026-04-11
**Status**: Draft
**Input**: Roadmap item #2 — "Criar um backend, para poder sincronizar com a nuvem"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Receive Idempotent Batch from Client (Priority: P1)

As the backend, I want to accept batches of `lesson_collections` from authenticated collectors and persist them idempotently, so that collectors on unstable church Wi-Fi can retry freely without corrupting the aggregated numbers.

**Why this priority**: Core reason the backend exists. Without this, there is no point to the rest of the system.

**Independent Test**: POST a batch of 3 collections with valid JWT. Verify all 3 persist. POST the same batch again. Verify no duplicates and a 200 response.

**Acceptance Scenarios**:

1. **Given** a valid JWT for user `U1` and a batch of 3 collections `[A, B, C]` where none exist on the server, **When** `POST /sync/batch` is called, **Then** all 3 rows are inserted into `lesson_collections`, the response is 200 with `{ accepted: [A,B,C], rejected: [] }`, and affected `LessonInstance.agg*` fields are recomputed.
2. **Given** the same batch is POSTed a second time, **Then** the response is 200 with `{ accepted: [A,B,C], rejected: [] }` but the database row count is unchanged.
3. **Given** the batch contains collection `C` with a newer `client_updated_at` than the stored version, **Then** the stored row is updated (fields that changed), not duplicated.
4. **Given** the batch contains collection `C` with an older `client_updated_at` than the stored version, **Then** the stored row is left alone (older writes are ignored).
5. **Given** the JWT is missing or invalid, **Then** the response is 401 and nothing is persisted.

---

### User Story 2 - Serve Catalog to Clients (Priority: P1)

As a collector app, I want to download the latest list of `series`, `topics` (with ordering), and `professors` from the server so that my dropdowns are always populated with the canonical catalog.

**Why this priority**: Without the catalog, the client falls back to free-text entry, which defeats the whole point of having a central data model.

**Independent Test**: `GET /catalog` with a valid JWT. Verify the response contains the three arrays. Call again with `?since=<timestamp>` and verify only recently-updated items are returned.

**Acceptance Scenarios**:

1. **Given** a valid JWT and no `since` parameter, **When** `GET /catalog` is called, **Then** the response is 200 with `{ series: [...], topics: [...], professors: [...], server_now: "<iso>" }` containing all non-pending catalog entries.
2. **Given** the client calls again with `?since=<the server_now from the previous call>`, **Then** the response contains only items whose `updatedAt` is newer than `since`.
3. **Given** the catalog has items with `isPending: true` (auto-created from sync), **Then** those items are EXCLUDED from the default catalog feed. A coordinator endpoint (`GET /catalog?includePending=true`, coordinator-only) shows them.
4. **Given** topics are returned, **Then** each topic has `sequence_order` and the array is sorted by `series_id, sequence_order ASC`.

---

### User Story 3 - Compute Aggregates Across Collectors (Priority: P1)

As a coordinator looking at a lesson instance, I want to see the median of all accepted collections for that lesson, so that I know the "official" numbers derived from multi-collector consensus.

**Why this priority**: The entire multi-collector model is pointless if the server doesn't compute the aggregate. This is the feature that makes divergent readings valuable instead of confusing.

**Independent Test**: Create 3 collections for the same `(date, series, topic)` with attendance `[10, 12, 15]`. Call `GET /instances/:id`. Verify `aggStart = 12` (median).

**Acceptance Scenarios**:

1. **Given** 3 accepted collections for instance `I` with attendance starts `[10, 12, 15]`, **When** I `GET /instances/I`, **Then** `aggStart = 12`.
2. **Given** one of the collectors has `accepted = false` at the user level, **Then** that collector's collection is EXCLUDED from the aggregate. The response reflects `aggCollectorCount = 2`.
3. **Given** one collection has `includes_professor = true`, **Then** its attendance values are decremented by 1 before entering the aggregate (normalization to "without professor").
4. **Given** a coordinator toggles a collector from `accepted=true` to `accepted=false` via `PATCH /users/:id/accepted`, **Then** all `LessonInstance` aggregates that include any of that collector's collections are recomputed automatically.
5. **Given** `acceptedOverride` is explicitly set on a collection (per-submission moderation, future feature), **Then** it overrides the collector-level `accepted` flag.

---

### User Story 4 - Authenticate Users (Priority: P1)

As the backend, I want to register new users, authenticate them with email + password, and issue JWTs so that the client app can attach collector identity to every sync request.

**Why this priority**: Spec 006 depends on these endpoints existing.

**Independent Test**: `POST /auth/register` with unique email. Verify 201 and JWT. `POST /auth/login` with same credentials. Verify 200 and a new JWT. `GET /me` with the JWT. Verify 200 and user info.

**Acceptance Scenarios**:

1. **Given** an empty user table, **When** the first user calls `POST /auth/register`, **Then** the response is 201 with a JWT AND the user's `role` is automatically set to `COORDINATOR`.
2. **Given** one user already exists, **When** a second user registers, **Then** the second user's `role` is `COLLECTOR` by default.
3. **Given** bad credentials on login, **Then** the response is 401 with a generic "invalid credentials" message (no leak of whether email or password was wrong).
4. **Given** a valid JWT, **When** `GET /me` is called, **Then** the response is the current user's info including `role` and `accepted`.

---

### User Story 5 - Coordinator Moderation Endpoints (Priority: P2)

As a coordinator, I want endpoints to list users and toggle their `accepted` flag, so that I can control which collectors contribute to the aggregated numbers.

**Why this priority**: Ships after P1 core sync is working, because moderation is only useful once there are multiple collectors feeding the system.

**Independent Test**: With a coordinator JWT, `GET /users`. Verify the list. `PATCH /users/:id/accepted` with `{ accepted: false }`. Verify the field updates AND any affected aggregates are recomputed.

**Acceptance Scenarios**:

1. **Given** I am a coordinator and I call `GET /users`, **Then** I get a list of all users with their `accepted` flag.
2. **Given** I am a non-coordinator and call the same endpoint, **Then** I get 403.
3. **Given** I toggle user `U2` to `accepted=false`, **Then** all `LessonInstance` rows that had a collection from `U2` contributing to the aggregate are recomputed in the same transaction.

---

### User Story 6 - Coordinator Manages Catalog (Priority: P2)

As a coordinator, I want endpoints to create, update, and delete items in the catalog (series, topics, professors) so that I can curate the data the collectors see.

**Why this priority**: Catalog quality directly affects collection quality. But it can ship after the initial sync is working, because auto-create from sync (FR-012) gives a baseline catalog from day one.

**Independent Test**: With a coordinator JWT, `POST /catalog/series` with `{ code: "EB357", title: "Nova Série" }`. Verify 201. `GET /catalog` and verify the new series appears.

**Acceptance Scenarios**:

1. **Given** I am a coordinator, **When** I `POST /catalog/series`, `/catalog/topics`, or `/catalog/professors`, **Then** the item is created, `isPending: false`, and `updatedAt` is now.
2. **Given** I `PATCH /catalog/topics/:id` with `{ sequenceOrder: 5 }`, **Then** the topic's order changes and `updatedAt` is refreshed.
3. **Given** I am NOT a coordinator, **When** I try the same endpoints, **Then** I get 403.
4. **Given** I `DELETE /catalog/professors/:id` for a professor referenced by existing `LessonInstance` rows, **Then** the response is 409 with a clear message. Soft delete (marking `archived: true`) is not in MVP.

---

### User Story 7 - Health and Observability (Priority: P3)

As the operator (self-hosting), I want a healthcheck endpoint and structured logs so that I can know the server is alive and debug issues.

**Why this priority**: Nice to have for operations. Can ship after the functional endpoints.

**Independent Test**: `GET /health`. Verify 200 with `{ status: "ok", postgres: "up" }`. Stop Postgres. Verify 503 with `{ status: "degraded", postgres: "down" }`.

**Acceptance Scenarios**:

1. **Given** Postgres is up, `GET /health` returns 200 with `{ status: "ok", postgres: "up" }`.
2. **Given** Postgres is down, `GET /health` returns 503 with `{ status: "degraded", postgres: "down" }`.
3. **Given** any request comes in, **Then** the server logs a structured line via `pino` with request_id, method, path, status, latency.

---

### Edge Cases

- **EC-001 (Missing Catalog Reference)**: A batch contains a collection with `series_id: "nonexistent"`. Response: the server tries the `series_code_fallback` next. If that's also missing, it returns 400 for that specific collection in the `rejected` list. Other collections in the batch are processed normally.
- **EC-002 (Free-Text Auto-Create)**: A collection has `series_id: null` and `series_code_fallback: "EB999"` (not in catalog). The server creates `LessonSeries { code: "EB999", title: "EB999 (auto)", isPending: true }` and uses its id. Same for topic and professor.
- **EC-003 (Partial Batch Failure)**: A batch of 10 collections has 1 with malformed data. The other 9 are accepted. The response is `{ accepted: [9 ids], rejected: [{ id: "X", reason: "..." }] }` with HTTP 200 (partial success is not an error).
- **EC-004 (Race on Aggregation)**: Two batches hit `POST /sync/batch` simultaneously, both affecting the same `LessonInstance`. The server uses a row-level lock or serializable transaction on `LessonInstance` while updating `agg*`. Eventually-consistent is NOT acceptable — readers must always see aggregates consistent with the collections that existed at the time of the last write.
- **EC-005 (Coordinator Registers First)**: First registration becomes coordinator. If the first user later deletes their own account (out of MVP scope), the system does NOT automatically promote a new coordinator — an operator must do it via direct DB edit.
- **EC-006 (Schema Version Mismatch)**: A batch arrives with `schema_version: "1.0"` or missing. Response: 400 with clear "schema version required" error. The server NEVER processes v1 batches.
- **EC-007 (Over-Large Batch)**: A batch with > 500 collections or > 5MB total is rejected with 413. The client is responsible for chunking (spec 005 FR-011 / 008 FR-010).

## Requirements *(mandatory)*

### Functional Requirements

#### Stack & Infrastructure

- **FR-001**: Stack: Node 22 LTS, Fastify 5, TypeScript strict mode, Prisma 7, PostgreSQL 16.
- **FR-002**: Passwords stored as bcrypt hashes with cost factor 12 (or argon2id if the ARM deployment target prefers it).
- **FR-003**: JWT signing uses RS256 or HS256 with a secret/key from environment variables. JWT payload: `{ sub: user_id, role, iat, exp }`. Expiration: 7 days.
- **FR-004**: Prisma 7 migrations are versioned in git under `server/prisma/migrations/`. Every schema change ships as a migration file. Configuration lives in `server/prisma.config.ts`.
- **FR-005**: Docker Compose file at `server/docker-compose.yml` brings up Node + Postgres for local dev and self-hosting.
- **FR-006**: Structured logging via Fastify's default `pino`. Every request gets a `request_id`.

#### Auth Endpoints

- **FR-010**: `POST /auth/register` — body `{ email, password, display_name }`. Returns 201 with `{ jwt, user }`. First user to register in an empty DB is set to `role: COORDINATOR`.
- **FR-011**: `POST /auth/login` — body `{ email, password }`. Returns 200 with `{ jwt, user }` or 401.
- **FR-012**: `GET /me` — Bearer JWT. Returns 200 with `{ id, email, display_name, role, accepted }` or 401.

#### Sync Endpoint

- **FR-020**: `POST /sync/batch` — Bearer JWT, body follows the v2 schema from spec 005. Returns 200 with `{ accepted: [id], rejected: [{id, reason}] }`.
- **FR-021**: Idempotency key is `collections[].id`. Reposting by the **original collector** is a no-op; updates are field-level merges based on `client_updated_at`. A repost referencing a collection ID already owned by a different collector (`existing.collectorUserId !== jwt.sub`) MUST be rejected with `collection_ownership_conflict` (409) — a collector cannot overwrite another collector's row by guessing or replaying its ID.
- **FR-022**: On successful insertion/update, the server recomputes affected `LessonInstance.agg*` inside the same transaction as the write.
- **FR-023**: Auto-create catalog items when `*_id` is null but `*_fallback` is present. Auto-created items have `isPending: true`.

#### Catalog Endpoints

- **FR-030**: `GET /catalog?since=<iso>` — Bearer JWT. Returns `{ series, topics, professors, server_now }`. If `since` is omitted, returns the full non-pending catalog. Topics are sorted by `series_id, sequenceOrder ASC`.
- **FR-031**: `GET /catalog?includePending=true` — coordinator-only. Includes items with `isPending: true`.
- **FR-032**: `POST /catalog/series`, `POST /catalog/topics`, `POST /catalog/professors` — coordinator-only. Body validated against Prisma schema. Returns 201 with the created item.
- **FR-033**: `PATCH /catalog/:resource/:id` — coordinator-only. Supports partial updates. Returns 200.
- **FR-034**: `DELETE /catalog/:resource/:id` — coordinator-only. Returns 409 if the item is referenced by any `LessonInstance`. No soft-delete in MVP.

#### Instance Endpoints

- **FR-040**: `GET /instances?from=<iso>&to=<iso>` — coordinator-only (plain collectors do not see aggregates per roadmap decision #7). Returns an array of `LessonInstance` with expanded `collections[]` and `agg*` fields.
- **FR-041**: `GET /instances/:id` — coordinator-only. Returns a single instance with full expansion.
- **FR-042**: `POST /instances/:id/recompute` — coordinator-only. Forces re-aggregation for debugging. Returns 200.
- **FR-043**: `GET /collections?mine=true&since=<iso>` — any authenticated user. Returns only collections where `collectorUserId = currentUser.id`. Used by spec 008's P6 story (read-back of moderation status).

#### Moderation

- **FR-050**: `GET /users` — coordinator-only. Returns all users with `accepted` flag.
- **FR-051**: `PATCH /users/:id/accepted` — coordinator-only. Body `{ accepted: boolean }`. Recomputes all affected aggregates in the same transaction.

#### Security & Policy

- **FR-060**: All endpoints except `/auth/register`, `/auth/login`, and `/health` require a valid JWT.
- **FR-061**: Role-based access control: `role === 'COORDINATOR'` is required for all catalog mutations, user list, moderation, and instance aggregates reads.
- **FR-062**: CORS is configured to allow the app's origin only (configurable via env).
- **FR-063**: Rate limiting: 60 requests per minute per JWT on mutation endpoints (`POST`, `PATCH`, `DELETE`). Reads are unthrottled within reason.

### Key Entities *(include if feature involves data)*

Prisma 7 schema (authoritative). Configuration in `server/prisma.config.ts`, generated client at `server/src/generated/client/`:

```prisma
// server/prisma/schema.prisma

generator client {
  provider = "prisma-client"
  output   = "../src/generated/client"
}

datasource db {
  provider = "postgresql"
}

enum Role {
  COLLECTOR
  COORDINATOR
}

enum CollectionStatus {
  COMPLETED
  SYNCED
  REJECTED
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  displayName  String
  role         Role     @default(COLLECTOR)
  accepted     Boolean  @default(true)
  createdAt    DateTime @default(now())
  collections  LessonCollection[]
}

model LessonSeries {
  id          String   @id @default(uuid())
  code        String   @unique
  title       String
  description String?
  isPending   Boolean  @default(false)
  updatedAt   DateTime @updatedAt
  topics      LessonTopic[]
}

model LessonTopic {
  id            String       @id @default(uuid())
  seriesId      String
  series        LessonSeries @relation(fields: [seriesId], references: [id])
  title         String
  sequenceOrder Int
  suggestedDate DateTime?
  isPending     Boolean      @default(false)
  updatedAt     DateTime     @updatedAt
  instances     LessonInstance[]
  @@index([seriesId, sequenceOrder])
}

model Professor {
  id        String   @id @default(uuid())
  docId     String   @unique
  name      String
  isPending Boolean  @default(false)
  updatedAt DateTime @updatedAt
  instances LessonInstance[]
}

model LessonInstance {
  id                String   @id @default(uuid())
  date              DateTime @db.Date
  seriesCode        String
  topicId           String?
  topic             LessonTopic? @relation(fields: [topicId], references: [id])
  professorId       String?
  professor         Professor?   @relation(fields: [professorId], references: [id])
  collections       LessonCollection[]
  // aggregate cache — recomputed on collection change
  aggStart          Float?
  aggMid            Float?
  aggEnd            Float?
  aggDist           Float?
  aggCollectorCount Int      @default(0)
  @@unique([date, seriesCode, topicId])
  @@index([date])
}

model LessonCollection {
  id                 String   @id  // client-generated UUID — idempotency key
  lessonInstanceId   String
  lessonInstance     LessonInstance @relation(fields: [lessonInstanceId], references: [id])
  collectorUserId    String
  collector          User     @relation(fields: [collectorUserId], references: [id])
  status             CollectionStatus @default(SYNCED)
  clientCreatedAt    DateTime
  clientUpdatedAt    DateTime
  serverReceivedAt   DateTime @default(now())
  expectedStart      String
  expectedEnd        String
  realStart          String?
  realEnd            String?
  attendanceStart    Int
  attendanceMid      Int
  attendanceEnd      Int
  includesProfessor  Boolean
  uniqueParticipants Int
  weather            String?
  notes              String?
  acceptedOverride   Boolean? // null = inherit User.accepted
  @@index([lessonInstanceId])
  @@index([collectorUserId])
}
```

### Aggregation Algorithm

```typescript
// server/src/services/aggregateService.ts

function isCollectionAccepted(c: LessonCollection, user: User): boolean {
  if (c.acceptedOverride !== null) return c.acceptedOverride;
  return user.accepted;
}

function adjustedAttendance(c: LessonCollection): { start: number; mid: number; end: number } {
  const offset = c.includesProfessor ? -1 : 0;
  return {
    start: c.attendanceStart + offset,
    mid:   c.attendanceMid + offset,
    end:   c.attendanceEnd + offset,
  };
}

async function recompute(instanceId: string, tx: PrismaTransaction): Promise<void> {
  const instance = await tx.lessonInstance.findUnique({
    where: { id: instanceId },
    include: { collections: { include: { collector: true } } },
  });
  if (!instance) return;

  const accepted = instance.collections.filter(c =>
    isCollectionAccepted(c, c.collector)
  );

  if (accepted.length === 0) {
    await tx.lessonInstance.update({
      where: { id: instanceId },
      data: { aggStart: null, aggMid: null, aggEnd: null, aggDist: null, aggCollectorCount: 0 },
    });
    return;
  }

  const adjusted = accepted.map(adjustedAttendance);
  const aggStart = median(adjusted.map(a => a.start));
  const aggMid   = median(adjusted.map(a => a.mid));
  const aggEnd   = median(adjusted.map(a => a.end));
  const aggDist  = median(accepted.map(c => c.uniqueParticipants));

  await tx.lessonInstance.update({
    where: { id: instanceId },
    data: { aggStart, aggMid, aggEnd, aggDist, aggCollectorCount: accepted.length },
  });
}
```

### Folder Structure

```text
server/
├── src/
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── sync.ts
│   │   ├── catalog.ts
│   │   ├── instances.ts
│   │   └── users.ts
│   ├── services/
│   │   ├── aggregateService.ts
│   │   ├── authService.ts
│   │   └── catalogService.ts
│   ├── lib/
│   │   ├── prisma.ts       // PrismaClient singleton with driver adapter
│   │   ├── jwt.ts
│   │   └── roles.ts
│   ├── plugins/
│   │   ├── auth.ts         // JWT verification plugin
│   │   └── rbac.ts         // role checks
│   ├── generated/client/   // Prisma 7 generated client (git-ignored)
│   └── server.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts             // bootstrap + first-user-coordinator logic
├── prisma.config.ts        // Prisma 7 configuration (DATABASE_URL, seed)
├── test/
│   ├── auth.test.ts
│   ├── sync.test.ts
│   ├── aggregation.test.ts
│   └── catalog.test.ts
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
├── tsconfig.json
├── CLAUDE.md               // Server coding standards
└── README.md
```

Note: `server/` lives in the same repo as the app for now (monorepo). A separate repo can be extracted later if desired.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **Idempotency Correctness**: 1000 consecutive reposts of the same batch result in exactly 1 row per collection. Property-tested in CI with randomized batch sizes.
- **SC-002**: **Aggregation Correctness**: For any set of accepted collections, the resulting `agg*` fields equal the median of the `includes_professor`-adjusted attendance arrays. Property-tested with generated collections.
- **SC-003**: **Latency**: `POST /sync/batch` with 50 collections completes in < 500ms p95 on a modest self-hosted VPS (2 vCPU, 2GB RAM).
- **SC-004**: **First Deploy Time**: From a clean VPS with Docker installed, `docker compose up -d` brings the backend online in < 5 minutes.
- **SC-005**: **Zero Data Loss on Concurrent Writes**: 10 parallel `POST /sync/batch` calls affecting the same `LessonInstance` result in a consistent final state — all collections persisted, aggregate correct. Tested with load test.
- **SC-006**: **Moderation Recompute Latency**: `PATCH /users/:id/accepted` affecting ~100 collections recomputes all aggregates in < 1 second.

## Assumptions

- PostgreSQL 16 or newer is available (either managed or self-hosted).
- A single backend instance serves the entire church. Horizontal scaling is NOT a goal for MVP (load is tiny — tens of collectors, hundreds of submissions per month at most).
- Self-hosting is the default deployment target. The spec documents fly.io, Oracle Cloud Free, and Cloudflare Tunnel as fallbacks.
- The client (spec 008) is responsible for splitting large batches. The server rejects overlarge batches with 413 and does not attempt streaming.
- Moderation is a feature for ONE coordinator at a time. There is no workflow for "two coordinators disagree on a user's acceptance".
- Backup and disaster recovery is the operator's responsibility. MVP does not include automated backups.

## Hosting Plan

1. **Self-host (primary)** — Docker Compose on the operator's VPS or mini-PC. Nginx reverse proxy with TLS via Let's Encrypt. Postgres data volume mounted from host.
2. **Fly.io free tier (fallback)** — 3 shared-CPU VMs, up to 3GB persistent volume. Sufficient for the church's volume. Easy deploys via `fly deploy`.
3. **Oracle Cloud always-free (fallback)** — ARM VM with 4 OCPUs and 24GB RAM, generous but occasionally reclaimed by Oracle for inactivity. Monitor carefully.
4. **Cloudflare Tunnel + home mini-PC (fallback)** — A Raspberry Pi or old PC at the church, exposed via Cloudflare Tunnel (free), no firewall changes. Lowest infra cost long-term.

The spec does NOT prescribe one. The operator picks at deploy time.

## Open Questions

- Should email verification be required at registration? **Default: no, for MVP simplicity.** Can be added later.
- Should there be an admin endpoint to promote/demote roles after the first-user rule? **Default: no, for MVP simplicity. Direct DB edit is acceptable.** Flagged for post-MVP.
- Password reset flow? **Out of scope for MVP. Coordinator does it manually via DB.**
- Refresh tokens? **Out of scope for MVP. 7-day JWT is enough.**

## Related Specs

- **005-export-contract-v2** — defines the payload this backend accepts at `POST /sync/batch`.
- **006-auth-identity** — client-side counterpart of the auth endpoints in FR-010 to FR-012.
- **008-offline-sync-client** — consumer of this backend, implements the retry/queue logic on the app side.
