# Phase 0 — Research: Cloud Sync Backend

Decisions resolved before Phase 1 design. Each entry answers a "NEEDS CLARIFICATION" that would otherwise leak into data-model.md or contracts/.

## 1. Request validation library

- **Decision**: JSON Schema via Fastify's built-in Ajv (no Zod, no Typebox).
- **Rationale**: Fastify validates `body`/`params`/`query` natively from JSON Schema with zero runtime cost. Spec 005 already publishes `export-envelope.v2.schema.json` — reusing that schema for the sync endpoint is the shortest path and matches FR-020 verbatim. Avoids adding Zod/Typebox dependencies.
- **Alternatives considered**: Zod (nicer DX, but a second schema language to maintain and an extra runtime dep); Typebox (fits Fastify's compile-time types, but still duplicate of the v2 schema we already ship).

## 2. Authentication library

- **Decision**: `jsonwebtoken` (already in `server/package.json`) wrapped by thin `lib/jwt.ts` helpers; no `@fastify/jwt`.
- **Rationale**: We only need sign + verify with HS256. `lib/jwt.ts` decouples tests from Fastify and matches the service-layer discipline in `server/CLAUDE.md` §5. `@fastify/jwt` is overkill for a single-secret HS256 flow.
- **Alternatives considered**: `@fastify/jwt` (convenient decorators, but pulls route-level concerns into the plugin); PASETO (stronger guarantees, not needed for MVP risk profile).

## 3. Password hashing

- **Decision**: `bcrypt` cost factor 12. Pin in `server/src/lib/hash.ts`.
- **Rationale**: PRD FR-002 picked this; no reason to diverge. bcrypt cost 12 remains within OWASP 2026 guidance for server-side hashing on 2 vCPU hardware (~250 ms per hash — acceptable for registration/login at this scale).
- **Alternatives considered**: argon2id (stronger, but `argon2` native module has documented ARM build friction on Oracle Cloud free tier — flagged as a fallback in PRD FR-002; defer).

## 4. Rate limiting

- **Decision**: `@fastify/rate-limit` at 60 requests/minute per session (FR-063) on `POST`, `PATCH`, `DELETE`. Key by `request.user?.sub ?? request.ip`. Reads are not rate-limited in MVP.
- **Rationale**: Plugin is Fastify-native, supports per-route overrides, and exports the headers (`X-RateLimit-*`) the client can surface.
- **Alternatives considered**: Custom middleware (reinvents the plugin); Redis-backed limiting (needs extra infra — overkill for single-node MVP).

## 5. CORS

- **Decision**: `@fastify/cors`, origin whitelist sourced from `CORS_ORIGIN` env var (comma-separated list for multi-env, default `*` in dev only).
- **Rationale**: FR-062. Keeping it env-configurable means the same binary ships to self-host and to the fallback Fly.io/OCI deploys in PRD §Hosting Plan.

## 6. Error-response contract

- **Decision**: Single custom error class `HttpError` in `lib/errors.ts` with `{code, message, statusCode}` properties. Centralized `errorHandler` plugin translates every thrown error to `{code, message}` JSON (FR-065). The full registry of `code` values lives in `specs/007-sync-backend/contracts/error-codes.md` so tests and client can key off it.
- **Rationale**: FR-065 mandates stable `code` + pt-BR `message`. Keeping both in one class avoids scattering the translations.
- **Alternatives considered**: `@fastify/error` `createError` (does not produce the `{code,message}` body; produces `{error,message,statusCode}` by default and requires overrides anyway).

## 7. Schema-version enforcement (EC-006)

- **Decision**: A single constant `SUPPORTED_SCHEMA_VERSION = "2.0"` in `lib/schemaVersion.ts`. The sync route validates `body.schema_version` against this before any persistence. Missing or unsupported → `HttpError({code: 'schema_version_required' | 'schema_version_unsupported', status: 400})`.
- **Rationale**: EC-006 is explicit; the server "never processes pre-v2 batches". The value is the exact string literal `"2.0"` because that is the `const` fixed in `specs/005-export-contract-v2/contracts/export-envelope.v2.schema.json`. Any drift (e.g., `"2"`) would reject every valid client payload.
- **Alternatives considered**: Middleware that inspects `Content-Type` parameters (non-standard; harder to test).

## 8. Payload limits (EC-007)

- **Decision**: Global Fastify `bodyLimit: 5 * 1024 * 1024` (5 MB) plus a post-parse check `body.collections.length <= 500`. Both limits emit the same top-level `code: 'batch_too_large'` so the client has a single branch to handle.
- **Rationale**: EC-007 explicit two-axis limit. Fastify's `bodyLimit` handles bytes; the collection-count check catches tiny-payload-but-many-rows edge cases.

## 9. Per-instance aggregation serialization (EC-004, SC-005)

- **Decision**: Wrap the sync ingest + recompute in `prisma.$transaction(async (tx) => { ... })` **at the Serializable isolation level**, and before reading/writing aggregates for an instance, take a Postgres advisory lock: `SELECT pg_advisory_xact_lock(hashtext($1))` where `$1` is the lesson instance id. The lock is released at transaction end.
- **Rationale**: Serializable alone would make Postgres retry on conflict — OK but raises the server's error rate. Advisory locks keyed by instance are lightweight, serialize only *same-instance* conflicts, and keep the common path (different instances in flight) fully concurrent.
- **Alternatives considered**: `SELECT ... FOR UPDATE` on `LessonInstance` row (requires instance to exist first — fine for recompute of existing rows, awkward for the insert path that creates the instance on demand); single global mutex in Node (kills throughput at scale, even MVP scale).

## 10. Auto-create pending catalog items (FR-023, EC-002)

- **Decision**: Within the same sync transaction, upsert each referenced catalog item by natural key: series by `code`, topic by `(seriesId, title)`, professor by `name` (not `email` — the free-text path has no email). Upsert sets `isPending: true` only on **create**; subsequent re-syncs must not flip a curated (`isPending: false`) row back to pending. Professor auto-created with `email: null` per EC-002.
- **Rationale**: FR-023. Prisma's `upsert` handles the create-or-reuse in one round-trip. The "insert-only pending flag" rule prevents a re-sync from un-curating an item a coordinator has already cleaned up.

## 11. First-user-coordinator bootstrap (FR-013, EC-005)

- **Decision**: `authService.register` opens a transaction, counts users; if count is zero the new user's role is `COORDINATOR`, otherwise default `COLLECTOR`. No seed file. No auto-promotion on deletion — EC-005 is explicit.
- **Rationale**: Simpler than a seed script and avoids the problem of "what if someone deletes the first user before the app starts". EC-005 accepts operator-via-DB-edit as the recovery path.

## 12. Observability / logs (US-7)

- **Decision**: Fastify default logger (`pino`) enabled with `level: env.LOG_LEVEL ?? 'info'` and `genReqId` set to `crypto.randomUUID()`. No request-body logging (passwords!). Pretty output only in dev (`NODE_ENV !== 'production'`).
- **Rationale**: Meets US-7 scenario 3 and keeps prod logs JSON-structured for ingestion. Avoids leaking `password` fields by default (Fastify redacts `req.headers.authorization` out-of-the-box; we extend `redact` to cover common body fields).

## 13. Health endpoint (US-7 scenarios 1–2)

- **Decision**: `GET /health` runs `SELECT 1` through Prisma with a 500 ms timeout. Returns 200 `{status:"ok", postgres:"up"}` on success; 503 `{status:"degraded", postgres:"down"}` on timeout or error. No auth required (FR-060 exempts `/health`).
- **Rationale**: US-7. Keeps the endpoint cheap enough for load balancer polling without consuming a Prisma connection for more than a fraction of a second.

## 14. Testing strategy

- **Decision**: Vitest with three layers:
  - **Unit**: pure helpers (`median`, `adjustedAttendance`, `isCollectionAccepted`) — no DB.
  - **Integration**: route-level via `app.inject()` against a real Postgres (docker-compose test service or CI-provided container). Each test truncates within a `beforeEach` using `prisma.$executeRaw` on a narrow whitelist of tables.
  - **Property**: `fast-check` generates collection batches for SC-001 (idempotency) and SC-002 (aggregation correctness). 1000 iterations per property in CI.
  - **Load**: `autocannon` or `k6` script for SC-003 and SC-005, run manually / in a nightly job — not on every PR.
- **Rationale**: Layered pyramid matches server CLAUDE §7 and keeps fast feedback loops for PR CI (<2 min) while moving expensive load scenarios off the PR path.

## 15. Docker image strategy

- **Decision**: Multi-stage Dockerfile. Stage 1: `node:22-alpine` + `npm ci` + `npx prisma generate` + `tsc`. Stage 2: `node:22-alpine` with only `dist/`, `node_modules/`, and `src/generated/client/` copied. Non-root `node` user. `HEALTHCHECK` → `/health`.
- **Rationale**: Alpine images compile bcrypt cleanly on both x64 and arm64 (Oracle Cloud free tier). Multi-stage keeps the final image under 200 MB, which matters for the Cloudflare Tunnel / home-server fallback.
- **Alternatives considered**: `node:22-slim` (bigger but avoids musl edge cases) — acceptable fallback if Alpine bcrypt ever regresses.

## 16. Client timestamp source of truth (FR-021 "newer wins")

- **Decision**: `clientUpdatedAt` (ISO 8601, UTC) is the arbiter. Stored as `DateTime`, compared with `>` on update. Server's `serverReceivedAt` is recorded for audit but never used for ordering.
- **Rationale**: FR-021 explicit ("client's last-update timestamp"). Consistent with spec 005's export envelope schema.

## 17. Prisma schema delta vs. current scaffold

Tracked here so Phase 1 data-model.md can focus on the final shape without re-explaining the rationale.

| Change | Reason |
|---|---|
| `Professor.docId` → `Professor.email String? @unique` (nullable, unique-when-present) | Clarification Q2 — natural key is email, nullable for auto-created pending professors per EC-002. |
| `enum CollectionStatus` reduced to `{SYNCED, REJECTED}` (drop `COMPLETED`) | FR-025 — MVP is two-state only. `COMPLETED` was a leftover from a pre-clarify draft. |
| Add `LessonCollection.rejectionReason String?` | FR-025 — required when status = `REJECTED`, null otherwise. Enforced in service layer (Postgres cannot express conditional NOT NULL cleanly; check constraint added via raw SQL in the migration). |
| Add `LessonInstance` aggregate nullability invariant | FR-011 empty rule — when `aggCollectorCount = 0`, all `agg*` columns must be NULL. Enforced in `aggregateService.recompute`. |

## Open — non-blocking for Phase 1

These are acknowledged in spec.md Open Questions and acceptable to defer to post-MVP planning; they do not block Phase 1 design:

- Email verification at registration (default: no).
- Role-change admin endpoint (default: direct DB edit).
- Refresh tokens (7-day JWT sufficient).
- Public setter for `acceptedOverride` (field shipped unset; post-MVP endpoint can use it without migration).
- LGPD data retention / right-to-erasure (deferred; no PII beyond email + displayName is persisted in MVP).
- Exact numeric rate-limit tuning (FR-063 says "for example 60/min"; 60/min is what we will ship — reconsider after first real load).
