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

## Exercising the API (end-to-end curl walkthrough)

Once the server is up (`docker compose up -d`) and reachable at
`http://localhost:3000`, these curl commands cover every user-visible
scenario. Run them in order in one shell — the `$COORD_JWT` / `$COLLECTOR_JWT`
/ `$COLLECTOR_ID` / `$INSTANCE_ID` env vars are reused across steps.

The examples keep payloads ASCII-only; pt-BR strings like `Galatas` instead of
`Gálatas` avoid a Git-Bash / curl quirk where UTF-8 bytes are miscounted when
passed via `-d` (send multi-byte JSON with `--data-binary @file.json` instead).

```bash
API=http://localhost:3000
# Helper: pull a field from a JSON response on stdin. jq works too — use
# whichever you have: `jq -r '.jwt'`.
jp() { node -e 'let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s)'"$1"'))'; }
```

### 1. Register the first user → auto COORDINATOR (FR-013)

```bash
COORD_JWT=$(curl -s -X POST $API/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"coord@example.com","password":"change-me-8","display_name":"Coord"}' \
  | jp '.jwt')
```

### 2. Login to refresh the JWT (7-day TTL)

```bash
COORD_JWT=$(curl -s -X POST $API/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"coord@example.com","password":"change-me-8"}' | jp '.jwt')
```

### 3. Current user

```bash
curl -s -H "Authorization: Bearer $COORD_JWT" $API/me
# → {"id":"...","email":"coord@example.com","display_name":"Coord","role":"COORDINATOR","accepted":true}
```

### 4. Register a second user → defaults to COLLECTOR

```bash
COLL=$(curl -s -X POST $API/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"collector@example.com","password":"other-pw-1","display_name":"Collector"}')
COLLECTOR_JWT=$(echo "$COLL" | jp '.jwt')
COLLECTOR_ID=$(echo "$COLL" | jp '.user.id')
```

### 5. Coordinator curates a series

```bash
curl -s -X POST $API/catalog/series \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $COORD_JWT" \
  -d '{"code":"EB400","title":"Galatas"}'
# 201 {"id":"...","code":"EB400","title":"Galatas","is_pending":false,...}
```

### 6. Collector syncs a batch

Save the payload to a file (avoids shell/UTF-8 pitfalls):

```bash
cat > /tmp/batch.json <<'JSON'
{
  "schema_version": "2.0",
  "client": {"app_version": "demo", "device_id": "11111111-1111-1111-1111-111111111111"},
  "collector": null,
  "exported_at": "2026-04-18T18:00:00.000Z",
  "collections": [{
    "id": "aaaa0000-0000-4000-8000-000000000001",
    "client_created_at": "2026-04-11T10:00:00.000Z",
    "client_updated_at": "2026-04-11T10:07:00.000Z",
    "status": "COMPLETED",
    "lesson_instance": {
      "date": "2026-04-11",
      "series_id": null, "series_code_fallback": "EB400",
      "topic_id": null, "topic_title_fallback": "Licao 1",
      "professor_id": null, "professor_name_fallback": "Prof Teste"
    },
    "times": {"expected_start":"10:00","expected_end":"11:00","real_start":null,"real_end":null},
    "attendance": {"start":10,"mid":12,"end":11,"includes_professor":false},
    "unique_participants": 13,
    "weather": null,
    "notes": null
  }]
}
JSON

curl -s -X POST $API/sync/batch \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $COLLECTOR_JWT" \
  --data-binary @/tmp/batch.json
# 200 {"accepted":["aaaa...001"],"rejected":[],"server_now":"..."}
```

### 7. Collector reads their own history (FR-043)

```bash
curl -s -H "Authorization: Bearer $COLLECTOR_JWT" "$API/collections?mine=true"
# Also supports ?since=<ISO8601> for incremental reads.
```

### 8. Catalog reads

```bash
# Default — pending rows hidden.
curl -s -H "Authorization: Bearer $COORD_JWT" $API/catalog

# Coordinator inspects the pending-catalog backlog (topics/professors
# auto-created by step 6 land here).
curl -s -H "Authorization: Bearer $COORD_JWT" "$API/catalog?include_pending=true"

# A collector calling include_pending=true gets 403 forbidden.
curl -s -H "Authorization: Bearer $COLLECTOR_JWT" "$API/catalog?include_pending=true"
```

### 9. Coordinator reads aggregates (FR-040)

```bash
INSTANCE_ID=$(curl -s -H "Authorization: Bearer $COORD_JWT" \
  "$API/instances?from=2026-04-01&to=2026-04-30" | jp '.instances[0].id')

# Single instance with its contributing collections + agg_* values.
curl -s -H "Authorization: Bearer $COORD_JWT" "$API/instances/$INSTANCE_ID"

# Force a recompute (debug / after a manual DB edit).
curl -s -o /dev/null -w "status: %{http_code}\n" \
  -X POST "$API/instances/$INSTANCE_ID/recompute" \
  -H "Authorization: Bearer $COORD_JWT"
# → status: 204
```

### 10. Moderation: list users and flip acceptance (FR-051, SC-006)

```bash
curl -s -H "Authorization: Bearer $COORD_JWT" $API/users

# Dropping a collector triggers cascade recompute of every instance they
# contributed to — returns when all aggregates are consistent.
curl -s -X PATCH "$API/users/$COLLECTOR_ID/accepted" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $COORD_JWT" \
  -d '{"accepted":false}'

# GET /instances again — agg_collector_count drops, agg_* clear to null
# when no contributor remains.
curl -s -H "Authorization: Bearer $COORD_JWT" \
  "$API/instances?from=2026-04-01&to=2026-04-30"
```

### 11. Error-envelope examples (FR-065)

```bash
# Missing JWT
curl -si $API/me | head -5
# HTTP/1.1 401
# {"code":"unauthenticated","message":"Credencial ausente ou inválida."}

# Wrong schema_version
curl -s -X POST $API/sync/batch \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $COLLECTOR_JWT" \
  -d '{"schema_version":"2","collections":[]}'
# 400 {"code":"schema_version_unsupported",...}

# Coordinator-only endpoint as collector
curl -s -H "Authorization: Bearer $COLLECTOR_JWT" \
  "$API/instances?from=2026-04-01&to=2026-04-30"
# 403 {"code":"forbidden",...}
```

## Testing with the mobile app

The mobile app (`/app`, `/src` at repo root) is **offline-first** and does not
yet call this backend. The sync client is spec **008-offline-sync-client**,
which has not been implemented. Until then, these are the practical options:

### Option A — Exercise the contract manually

The mobile app already emits the v2 export envelope via spec 005. Trigger an
export from the app (saves a `.json` file), then push that file to the
backend:

```bash
# Copy the exported JSON from the device, then:
curl -s -X POST http://localhost:3000/sync/batch \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $COLLECTOR_JWT" \
  --data-binary @/path/to/exported-batch.json
```

This validates the full round-trip: app generates the envelope → backend
accepts it → aggregates populate. It does not exercise retry/queue/incremental
catalog pulls (those live in spec 008).

### Option B — Run them separately

Neither side depends on the other for day-to-day work:

- **Mobile app**: `npm start` (at repo root) — uses local SQLite.
- **Backend**: `docker compose up -d` (in `server/`) — uses Postgres only.

Each has its own test suite; running them together is Option A above.

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
