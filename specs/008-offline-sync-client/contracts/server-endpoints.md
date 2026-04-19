# Contract — Server Endpoints consumed by spec 008

**Purpose**: Pin down exactly which server endpoints this client depends on, with the full authoritative URL at `specs/007-sync-backend/contracts/`. This file is a pointer + client-side delta, not a duplicate of the server spec.

---

## `POST /sync/batch`

Authoritative: `specs/007-sync-backend/contracts/sync.md`.

**Request body** — reuses the v2 export envelope (`specs/005-export-contract-v2/contracts/export-envelope.v2.schema.json`). The client assembles it from `QUEUED` rows via a helper that already exists internally for `exportService.__buildEnvelopeForTest` — factored out and renamed:

- `src/services/exportService.ts` already has `buildEnvelope()` (private) that converts all `COMPLETED` lessons into the envelope.
- Spec 008 factors the per-lesson body-building into an exported `buildCollection(lesson: LessonWithDetails): CollectionSubmission` helper, and `syncService` reuses it, passing only the batch of `QUEUED` lessons.
- `exportService.__buildEnvelopeForTest` keeps its current behavior unchanged; the factor-out is refactor-only.

**Response status codes the client must handle** (see `contracts/sync-service.md` error-classification table for action):

| Status | Meaning | Client action |
|--------|---------|---------------|
| 200 | partial/full success (per-item accepted/rejected) | apply result per sync-service.md table |
| 400 `schema_version_required` / `schema_version_unsupported` | client sent wrong envelope | REJECTED for all; this is a bug, log loudly |
| 401 `unauthenticated` | JWT expired/invalid | clearJwt(); revert sending→QUEUED; toast |
| 413 `batch_too_large` | >500 or >5 MB | revert to QUEUED; reduce next batch cap |
| 429 `rate_limited` | rate-limit hit | revert to QUEUED; honor `Retry-After` (FR-024a) |
| 5xx | server fault | revert to QUEUED; FR-030 backoff |

**Client-observed `Retry-After` contract** (FR-024a): server returns the header on 429. Client parses delta-seconds (integer) or RFC 7231 IMF-fixdate; ignores unrecognized forms and falls back to FR-030.

**Idempotency**: client guarantees `collections[].id` is stable across retries — the field is the row's `lessons_data.id` UUID, generated at row creation and never mutated. The server uses it as the idempotency key per spec 007 FR-021.

---

## `GET /catalog`

Authoritative: `specs/007-sync-backend/contracts/catalog.md`.

**Query the client sends**:

- `since` — ISO-8601 from `AsyncStorage['@eb-insights/last-catalog-sync']` when present. Omitted on first run.
- `include_pending` — **never sent by the mobile client**. That flag is for a future coordinator UI.

**Response the client consumes**:

```json
{
  "series":     [ { "id", "code", "title", "description", "is_pending", "updated_at" } ],
  "topics":     [ { "id", "series_id", "title", "sequence_order", "suggested_date", "is_pending", "updated_at" } ],
  "professors": [ { "id", "name", "email", "is_pending", "updated_at" } ],
  "server_now": "ISO 8601"
}
```

The client ignores `is_pending` on read — the server already filtered pending out unless `include_pending=true` was sent. We never send it, so all rows returned are non-pending.

On a successful upsert transaction, the client advances the cursor to `server_now` (not to any `updated_at` field from the response — using `server_now` avoids clock-skew bugs, matches EC-007 rationale).

---

## Endpoints explicitly NOT consumed in this MVP

- `GET /collections?mine=true&since=…` (spec 007 FR-043). This is for User Story 6 (read-back of moderation). Out of scope for spec 008 MVP — marked P3 in spec.md and punted to a follow-up.
- `POST /auth/login`, `POST /auth/register`, `GET /me`. Already integrated by spec 006; unchanged here.
- All catalog-mutation endpoints (POST/PATCH under `/catalog/*`). Coordinator-only, not part of this client spec.

---

## Versioning note

The client always sends `schema_version: "2.0"` in the envelope body. If the server one day upgrades past `"2.0"`, spec 008's client will start receiving `400 schema_version_unsupported`. That will be a noisy, visible failure — preferable to a silent schema drift — and will force a spec-level bump in the mobile client before the deploy can go out.
