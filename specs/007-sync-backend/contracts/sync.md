# Contracts — Sync

## POST /sync/batch

Maps to US-1, FR-020, FR-021, FR-022, FR-023, FR-024, FR-025, EC-001, EC-002, EC-003, EC-004, EC-006, EC-007.

**Auth**: required (any authenticated user — collectors submit their own, coordinators submit their own; the backend does not allow submitting on behalf of another user).

**Body**: v2 export envelope (schema authoritative: `specs/005-export-contract-v2/contracts/export-envelope.v2.schema.json`). Minimum required top-level keys:
- `schema_version` — MUST equal `"2.0"` (the exact const fixed in `specs/005-export-contract-v2/contracts/export-envelope.v2.schema.json`); anything else → 400 `schema_version_required` or `schema_version_unsupported` (EC-006).
- `collections[]` — array of 1..500 collection objects (EC-007; total body also capped at 5 MB).

Each collection object carries a client-generated `id` (idempotency key, FR-021), a `client_created_at`, a `client_updated_at`, the lesson triple (`date`, `series_id` or `series_code_fallback`, `topic_id` or `topic_title_fallback`), optional `professor_id` or `professor_name_fallback`, the three attendance counts, `includes_professor`, `unique_participants`, `expected_start/end`, optional `real_start/end`, `weather`, `notes`.

**200** — success (partial success is STILL 200; EC-003):

```json
{
  "accepted": ["<collection_id>", "..."],
  "rejected": [
    { "id": "<collection_id>", "code": "missing_catalog_reference", "message": "..." }
  ],
  "server_now": "2026-04-18T13:55:00.000Z"
}
```

**Per-collection rejection codes** (populate the `rejected[].code` field):
- `missing_catalog_reference` — series/topic/professor unresolvable by id or fallback (EC-001).
- `invalid_collection_payload` — malformed fields (numeric out of range, date unparseable, etc.).
- `already_rejected_older` — a newer `clientUpdatedAt` already stored with a different classification (rare, audit only).

**Rejected collections are persisted** with `status = REJECTED` and `rejectionReason = <code>:<message>` per FR-025 so FR-043 can read them back.

**Errors (whole-batch)**:
- 400 `schema_version_required` — missing `schema_version` (EC-006).
- 400 `schema_version_unsupported` — `schema_version ≠ "2"` (EC-006).
- 413 `batch_too_large` — > 500 collections or > 5 MB body (EC-007).
- 401 `unauthenticated` — no/invalid JWT (US-1 scenario 5).
- 429 `rate_limited` — exceeded per-session mutation quota (FR-063).

### Processing algorithm

Implemented in `syncService.ingestBatch(userId, payload)`:

```text
1. Validate schema_version (EC-006); fail fast.
2. Validate payload size (EC-007); fail fast.
3. For each collection in collections[], group by lesson triple (date, seriesCode, topicId-or-title).
4. Start a Prisma $transaction at Serializable isolation.
5. Upsert catalog rows for each referenced fallback (research §10).
6. Upsert lesson instances keyed by (date, seriesCode, topicId).
7. For each affected lessonInstance.id: pg_advisory_xact_lock(hashtext(id)).
8. For each collection in the batch:
     a. Fetch existing row by id (idempotency key).
     b. If absent: INSERT.
     c. If present and clientUpdatedAt newer: UPDATE only changed fields (FR-021).
     d. If present and clientUpdatedAt older-or-equal: SKIP (FR-021).
     e. Classify: validate fields → SYNCED, else → REJECTED + rejectionReason.
9. After all writes, for each touched lessonInstance.id run aggregateService.recompute(tx, id).
10. Commit. Return {accepted, rejected, server_now}.
```

Step 7's advisory lock ensures concurrent batches targeting the same instance serialize (EC-004, SC-005) without forcing serialization across the whole DB.

## GET /collections?mine=true[&since=<iso8601>]

Maps to FR-043 (supports spec 008 P6 read-back of moderation outcomes).

**Auth**: required.

**Query**:
- `mine` — MUST be `true` in MVP (the only allowed value; any other → 400 `invalid_query`). Future expansion (coordinator read-any) reuses this endpoint.
- `since` — optional ISO-8601 timestamp; filters by `clientUpdatedAt > since`.

**200**:

```json
{
  "collections": [
    {
      "id": "...",
      "lesson_instance_id": "...",
      "status": "SYNCED" | "REJECTED",
      "rejection_reason": "..." | null,
      "client_updated_at": "...",
      "server_received_at": "...",
      "attendance_start": 10,
      "attendance_mid": 12,
      "attendance_end": 15,
      "includes_professor": false,
      "unique_participants": 11
    }
  ],
  "server_now": "2026-04-18T13:55:00.000Z"
}
```

Both `SYNCED` and `REJECTED` are returned; the client uses `status` + `rejection_reason` to surface per-submission moderation feedback (spec 008 P6).
