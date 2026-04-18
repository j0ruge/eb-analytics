# Contracts — Catalog

## GET /catalog

Maps to US-2, FR-030, FR-031.

**Auth**: required.

**Query**:
- `since` — optional ISO-8601. Filters by `updatedAt > since`.
- `include_pending` — optional boolean. When `true`, endpoint requires coordinator role (FR-031); pending items are included. Default `false`.

**200**:

```json
{
  "series": [
    { "id": "...", "code": "EB354", "title": "...", "description": "...", "is_pending": false, "updated_at": "..." }
  ],
  "topics": [
    { "id": "...", "series_id": "...", "title": "...", "sequence_order": 1, "suggested_date": null, "is_pending": false, "updated_at": "..." }
  ],
  "professors": [
    { "id": "...", "name": "...", "email": "prof@example.com" | null, "is_pending": false, "updated_at": "..." }
  ],
  "server_now": "2026-04-18T13:55:00.000Z"
}
```

`topics` is pre-sorted by `(series_id ASC, sequence_order ASC)` (FR-030, US-2 scenario 4).

**Errors**:
- 403 `forbidden` — non-coordinator passed `include_pending=true` (FR-031).

## POST /catalog/series | /catalog/topics | /catalog/professors

Maps to US-6, FR-032.

**Auth**: required, coordinator role.

**Body** (per resource):
- Series: `{ code, title, description? }`.
- Topics: `{ series_id, title, sequence_order, suggested_date? }`.
- Professors: `{ name, email? }`.

**201**: returns the created item with `is_pending: false` and a fresh `updated_at`.

**Errors**:
- 403 `forbidden` — non-coordinator (FR-032, US-6 scenario 3).
- 409 `code_already_exists` / `email_already_exists` — unique-constraint violation.
- 400 `invalid_payload` — required field missing.

## PATCH /catalog/:resource/:id

Maps to US-6, FR-033. `:resource` ∈ `{series, topics, professors}`.

**Auth**: required, coordinator role.

**Body**: any subset of mutable fields for the resource. Unknown fields → 400.

**200**: updated item with refreshed `updated_at`.

**Errors**:
- 403 `forbidden`.
- 404 `not_found`.
- 400 `invalid_payload`.

## DELETE /catalog/:resource/:id

Maps to US-6, FR-034.

**Auth**: required, coordinator role.

**204** — success.

**Errors**:
- 403 `forbidden`.
- 404 `not_found`.
- 409 `series_referenced` / `topic_referenced` / `professor_referenced` — item still referenced by at least one `LessonInstance` (US-6 scenario 4; soft-delete is out of scope).
