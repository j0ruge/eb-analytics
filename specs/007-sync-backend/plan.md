# Implementation Plan: Cloud Sync Backend

**Branch**: `main` (feature dir `specs/007-sync-backend/`) | **Date**: 2026-04-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification at `specs/007-sync-backend/spec.md`; PRD (technical decisions source) at `specs/007-sync-backend/prd.md`

## Summary

Build a self-hostable REST backend that accepts idempotent batches of collector submissions, aggregates per lesson instance via median (with professor-normalization), serves the canonical catalog, and exposes coordinator moderation. Technical approach: Fastify 5 on Node 22 with Prisma 7 on PostgreSQL 16, JWT-based sessions (HS256, 7-day TTL), bcrypt password hashing, `pino` structured logs, `@fastify/rate-limit` for mutation throttling, and all aggregate recomputes wrapped in Prisma `$transaction` with advisory locks keyed by `lessonInstance.id` to guarantee per-instance serialization (EC-004). Existing scaffold at `server/` (Prisma schema, package.json, empty route/service trees) is the starting point; a migration reconciles the schema with post-clarify decisions (Professor natural key, two-state status + `rejectionReason`).

## Technical Context

**Language/Version**: TypeScript 5.9 strict on Node 22 LTS (ESM — `"type": "module"` in `server/package.json`)
**Primary Dependencies**: Fastify 5.8, Prisma 7.6 (with `@prisma/adapter-pg`), `jsonwebtoken` 9, `bcrypt` 6, `pino` 9, `@fastify/rate-limit`, `@fastify/cors`, `@fastify/sensible`. Schema validation via Fastify JSON Schema (typebox optional).
**Storage**: PostgreSQL 16 (self-hosted via docker-compose for dev; operator-chosen for prod per PRD Hosting Plan). Prisma migrations in `server/prisma/migrations/` (empty today — first migration must include schema revisions below).
**Testing**: Vitest 3 in `server/test/`. Integration tests use a dedicated Postgres test DB (TESTCONTAINERS optional; docker-compose `db-test` service acceptable). Property tests for SC-001 and SC-002 via `fast-check`. Load test for SC-005 via `autocannon` or `k6`.
**Target Platform**: Linux x64 (Docker) + ARM64 (Oracle Cloud / Raspberry Pi fallback). Windows dev host supported via Docker Desktop + WSL2.
**Project Type**: Monorepo web service — `server/` is its own npm package, isolated from mobile code (constitution §V, server CLAUDE §9).
**Performance Goals**: SC-003 (batch of 50 collections accepted + aggregated in <500 ms p95 on 2 vCPU / 2 GB RAM); SC-006 (user-accepted toggle with ~100 affected instances recomputes in <1 s).
**Constraints**: EC-007 caps payload at 500 collections or 5 MB (enforced via Fastify `bodyLimit` + route-level check). EC-006 rejects any batch missing or declaring unsupported `schema_version`. FR-065 mandates error-response shape `{code: snake_case_english, message: pt_BR}` with no `Accept-Language` negotiation.
**Scale/Scope**: One congregation per instance — tens of collectors, low hundreds of submissions per month. Single-node deploy; no horizontal scaling goal for MVP (spec Assumptions).

## Constitution Check

The constitution at `.specify/memory/constitution.md` v1.0.0 is written primarily for the mobile app (React Native + Expo + SQLite). It does not prescribe anything for a backend surface, so there is no direct conflict. Each principle is evaluated below for the backend.

| Principle | Applicability to 007 | Status | Note |
|---|---|---|---|
| I. Local-First Architecture | The mobile app remains source of truth; the server is the secondary/async sink spec 006+008 push into. | **PASS** | Server accepts late-arriving batches (FR-020..024) and never blocks collectors who are offline. |
| II. Zero-Friction UX | Server has no UI. | **N/A** | Coordinator moderation UI lives in a future client, not in this feature. |
| III. Auto-Save & Fail-Safe | Server must accept retries without data loss. | **PASS** | Idempotency (FR-021 + SC-001) guarantees retries are safe. |
| IV. Backward Compatibility | Prisma migrations must preserve data after first deploy. | **PASS (conditional)** | First migration is permitted to rewrite the empty schema (no production data yet). The "no production data" claim is an assumption, not an evidence-backed fact — T008 includes a preflight gate requiring the operator to confirm every `server/` DB is empty before the migration runs; if any DB has rows, a data-preserving alternate migration must be written instead. All subsequent migrations MUST be idempotent and preserve rows. |
| V. Separation of Concerns | Server code splits routes / services / lib / plugins. | **PASS** | Structure enforced by `server/CLAUDE.md` §9; routes never touch Prisma directly. |

**Technology Stack table in constitution**: lists only mobile tech. The backend stack (Fastify / Prisma / Postgres / Node / bcrypt / jsonwebtoken) is authoritative per `server/CLAUDE.md` and the PRD. No amendment needed unless the constitution is later extended with a server section.

**Result**: no gate violations. No Complexity Tracking entry needed.

## Project Structure

### Documentation (this feature)

```text
specs/007-sync-backend/
├── spec.md              # WHAT / WHY (regenerated from PRD in /speckit-specify)
├── prd.md               # Original hybrid spec — source of stack decisions
├── plan.md              # This file
├── research.md          # Phase 0 — resolved unknowns
├── data-model.md        # Phase 1 — entities, fields, migrations vs. current scaffold
├── quickstart.md        # Phase 1 — 5-min bring-up (SC-004)
├── contracts/           # Phase 1 — endpoint contracts (one per domain)
│   ├── auth.md
│   ├── sync.md
│   ├── catalog.md
│   ├── instances.md
│   ├── users.md
│   └── error-codes.md   # Registry of `code` values per FR-065
└── checklists/
    └── requirements.md  # Spec quality checklist (already green)
```

### Source Code (repository root)

The backend lives under `server/`, independent of the mobile code. Existing empty directories are kept; new files fill them.

```text
server/
├── src/
│   ├── routes/
│   │   ├── auth.ts              # POST /auth/register, /auth/login, GET /me
│   │   ├── sync.ts              # POST /sync/batch
│   │   ├── catalog.ts           # GET /catalog, catalog mutations
│   │   ├── instances.ts         # GET /instances, /instances/:id, POST /instances/:id/recompute
│   │   ├── users.ts             # GET /users, PATCH /users/:id/accepted
│   │   ├── collections.ts       # GET /collections?mine=true (FR-043)
│   │   └── health.ts            # GET /health (US-7)
│   ├── services/
│   │   ├── authService.ts       # register/login/me (first-user-coordinator in register)
│   │   ├── syncService.ts       # batch ingest, partial-accept, auto-create pending
│   │   ├── catalogService.ts    # CRUD for series/topics/professors
│   │   ├── aggregateService.ts  # recompute() — median + normalization + lock
│   │   └── moderationService.ts # toggleAccepted → cascade recompute
│   ├── lib/
│   │   ├── prisma.ts            # PrismaClient singleton with PrismaPg adapter
│   │   ├── jwt.ts               # sign/verify helpers (HS256, 7d)
│   │   ├── hash.ts              # bcrypt wrappers
│   │   ├── errors.ts            # createHttpError({code, message, status})
│   │   ├── median.ts            # pure numeric median helper
│   │   └── schemaVersion.ts     # accepted v2; reject otherwise (EC-006)
│   ├── plugins/
│   │   ├── auth.ts              # onRequest JWT decoder → request.user
│   │   ├── rbac.ts              # requireRole() helper
│   │   ├── cors.ts              # @fastify/cors with env-configured origin (FR-062)
│   │   ├── rateLimit.ts         # @fastify/rate-limit on mutating verbs (FR-063)
│   │   └── errorHandler.ts      # maps thrown errors → {code,message} JSON (FR-065)
│   ├── generated/client/        # Prisma output (gitignored)
│   └── server.ts                # buildApp() factory + main()
├── prisma/
│   ├── schema.prisma            # updated: Professor.email, drop COMPLETED, add rejectionReason
│   ├── migrations/              # first migration lands the corrected schema
│   └── seed.ts                  # (optional) creates no seed data — first user is created via /auth/register (EC-005)
├── test/
│   ├── auth.test.ts             # US-4 + FR-015
│   ├── sync.test.ts             # US-1 + SC-001 property test
│   ├── aggregation.test.ts      # US-3 + SC-002 property test
│   ├── catalog.test.ts          # US-2 + US-6
│   ├── moderation.test.ts       # US-5 + SC-006
│   ├── instances.test.ts        # FR-040..042
│   ├── collections.mine.test.ts # FR-043 (includes REJECTED)
│   └── health.test.ts           # US-7
├── prisma.config.ts             # already present
├── docker-compose.yml           # NEW — pg + server for dev & self-host (SC-004)
├── Dockerfile                   # NEW — multi-stage build
├── .env.example                 # NEW — DATABASE_URL, JWT_SECRET, CORS_ORIGIN
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

**Structure Decision**: Monorepo with isolated `server/` package. The mobile app (`src/`, `app/`) and the backend (`server/`) share only this repository's git history; they never import each other (server CLAUDE §9). The backend is a single Fastify service with a conventional layered layout (routes → services → lib). Docker artifacts (`docker-compose.yml`, `Dockerfile`, `.env.example`) land at `server/` root so SC-004's 5-minute bring-up can be driven by `docker compose up -d` from that directory alone.

## Complexity Tracking

> No gate violations — no entries required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
