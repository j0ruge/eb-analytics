# Quickstart — Cloud Sync Backend

Target: **from zero to a running API in under 5 minutes** (SC-004). Assumes the host has Docker (with Compose v2) and Node 22 installed.

## 1. Prepare environment (once)

```bash
cd server/
cp .env.example .env
# Edit .env and set at minimum:
#   DATABASE_URL=postgresql://eb:eb@db:5432/eb_insights
#   JWT_SECRET=<generate 32+ bytes: `openssl rand -base64 48`>
#   CORS_ORIGIN=http://localhost:8081
```

## 2. Start services

```bash
docker compose up -d         # brings up Postgres + server
docker compose logs -f server
# Wait for: "listening at http://0.0.0.0:3000"
```

First boot runs `npx prisma migrate deploy` (inside the container's entrypoint), applying `0001_sync_backend_schema`. The server boots with an empty database and no seed data.

## 3. Bootstrap the first coordinator

Pick a throwaway password (≥8 chars) and export it — avoids baking the value into
the document:

```bash
export EB_PW='<choose-8+-chars>'
curl -sS -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"coord@example.com\",\"password\":\"$EB_PW\",\"display_name\":\"Coord\"}"
```

Expected response (FR-013):

```json
{ "jwt": "eyJhbGciOi...", "user": { "role": "COORDINATOR", "accepted": true, ... } }
```

Save the JWT for the next steps. The first successful register gets `COORDINATOR` automatically; anyone who registers afterward is a plain `COLLECTOR`.

## 4. Smoke-test the core flows

```bash
JWT=eyJhbGciOi...

# Health (no auth)
curl -sS http://localhost:3000/health

# Catalog (empty — expected on a fresh DB)
curl -sS -H "Authorization: Bearer $JWT" http://localhost:3000/catalog

# Submit a minimal batch (US-1 happy path) — the server auto-creates pending
# catalog entries from the free-text fallbacks per FR-023 / EC-002.
curl -sS -X POST http://localhost:3000/sync/batch \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $JWT" \
  -d '{
    "schema_version": "2.0",
    "client": { "app_version": "quickstart", "device_id": "11111111-1111-1111-1111-111111111112" },
    "collector": null,
    "exported_at": "2026-04-11T10:07:30Z",
    "collections": [{
      "id": "11111111-1111-1111-1111-111111111111",
      "client_created_at": "2026-04-11T10:00:00Z",
      "client_updated_at": "2026-04-11T10:07:00Z",
      "status": "COMPLETED",
      "lesson_instance": {
        "date": "2026-04-11",
        "series_id": null,
        "series_code_fallback": "EB354",
        "topic_id": null,
        "topic_title_fallback": "Lição 1",
        "professor_id": null,
        "professor_name_fallback": "Prof Teste"
      },
      "times": { "expected_start": "10:00", "expected_end": "11:00", "real_start": null, "real_end": null },
      "attendance": { "start": 10, "mid": 12, "end": 11, "includes_professor": false },
      "unique_participants": 13,
      "weather": null,
      "notes": null
    }]
  }'
```

Expected: 200 with `accepted: ["11111111-…"]` and `rejected: []`.

## 5. Re-run the same batch (US-1 scenario 2 — idempotency)

Run step 4's `POST /sync/batch` a second time. The response is identical but the database row count is unchanged (SC-001).

```bash
docker compose exec db psql -U eb -d eb_insights \
  -c 'SELECT COUNT(*) FROM "LessonCollection";'
# → 1
```

## 6. Inspect the aggregate (US-3)

```bash
curl -sS -H "Authorization: Bearer $JWT" \
  "http://localhost:3000/instances?from=2026-04-11&to=2026-04-11"
```

Expected: one instance with `agg_start: 10`, `agg_mid: 12`, `agg_end: 11`, `agg_dist: 13`, `agg_collector_count: 1`.

## 7. Stop / clean up

```bash
docker compose down           # keeps the data volume
docker compose down -v        # wipes the DB — use for a fresh start
```

## Development loop (no Docker for the server)

If you want hot reload on the server while Postgres runs in Docker:

```bash
docker compose up -d db       # just Postgres
cd server/
npm install
npm run db:migrate            # apply migrations to the local DB
npm run dev                   # tsx watch
```

Run tests:

```bash
npm test                      # Vitest once
npm run test:watch            # Vitest watch mode
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `ECONNREFUSED 5432` on first `npm run dev` | Postgres container not ready | `docker compose logs db`; wait for `database system is ready to accept connections` |
| `PrismaClientInitializationError: P1001` | `DATABASE_URL` still points at `db:5432` from .env but you run outside Docker | Switch host to `localhost:5432` when running `npm run dev` locally |
| `jwt malformed` on every request | Wrong Authorization header | `Authorization: Bearer <jwt>` — mind the space |
| 413 `batch_too_large` | Batch over 500 rows or 5 MB | Split into chunks (client's job — spec 008) |
| 400 `schema_version_required` | Client forgot the envelope field | Add `"schema_version": "2.0"` at the top level |
