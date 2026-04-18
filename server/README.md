# EB Insights — Server (spec 007)

Self-hostable REST backend for the EB Insights multi-collector cloud sync pipeline.

## Quickstart

Bring-up in under five minutes is [`specs/007-sync-backend/quickstart.md`](../specs/007-sync-backend/quickstart.md).

TL;DR:

```bash
cd server/
cp .env.example .env           # set JWT_SECRET
docker compose up -d           # Postgres 16 + server on :3000
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"change-me-8","display_name":"You"}'
```

The first registered user is auto-promoted to `COORDINATOR` (FR-013).

## Contracts

Endpoint contracts live in [`specs/007-sync-backend/contracts/`](../specs/007-sync-backend/contracts/):

| File | Covers |
|------|--------|
| `auth.md` | `POST /auth/register`, `POST /auth/login`, `GET /me` |
| `sync.md` | `POST /sync/batch`, `GET /collections?mine=true` |
| `catalog.md` | `GET /catalog`, catalog mutations |
| `instances.md` | `GET /instances`, `POST /instances/:id/recompute` |
| `users.md` | `GET /users`, `PATCH /users/:id/accepted` |
| `error-codes.md` | Full registry of `code` values (FR-065) |

The v2 export envelope consumed by `/sync/batch` is
[`specs/005-export-contract-v2/contracts/export-envelope.v2.schema.json`](../specs/005-export-contract-v2/contracts/export-envelope.v2.schema.json)
(`schema_version: "2.0"` required).

## Local dev loop

```bash
npm install
docker compose up -d db                # just Postgres
DATABASE_URL=postgresql://eb:eb@localhost:5432/eb_insights \
  npx prisma migrate deploy            # apply 0001_sync_backend_schema
DATABASE_URL=... JWT_SECRET=dev-secret npm run dev   # tsx watch
```

## Tests

Unit + integration + property tests (Vitest + fast-check):

```bash
DATABASE_URL=postgresql://eb:eb@localhost:5432/eb_insights npm test
```

The test helper in `test/helpers/buildTestApp.ts` provisions a Fastify instance
against the same Postgres configured by `DATABASE_URL`. Tests run serially
(`fileParallelism: false`) so they can share a single DB without racing on
`TRUNCATE`.

## Load tests (SC-003, SC-005, SC-006)

Load scripts live under `test/load/` and use [autocannon](https://github.com/mcollina/autocannon)
so they need no extra binary. They expect a running server reachable at
`SERVER_URL` (default `http://localhost:3000`).

```bash
# Reference rig: 2 vCPU / 2 GB RAM (SC-003 target)
docker compose up -d

# SC-003 — p95 < 500 ms for 50-collection batches
JWT=<coordinator-jwt> node test/load/sync-latency.k6.js

# SC-005 — 10 parallel batches on the same instance
JWT=<coordinator-jwt> node test/load/concurrent-writes.k6.js

# SC-006 — moderation PATCH completes in < 1 s for 100 affected instances
COORD_JWT=<coord> COLLECTOR_JWT=<collector> COLLECTOR_ID=<id> \
  node test/load/moderation-recompute.k6.js
```

## Project rules

Server-specific coding standards are in [`CLAUDE.md`](./CLAUDE.md). The mobile
app (`src/`, `app/` at repo root) is a completely independent package — never
import across the boundary.
