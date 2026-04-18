# Contracts — Users & Moderation

Coordinator-only. Maps to US-5, FR-050, FR-051.

## GET /users

Maps to FR-050.

**Auth**: required, coordinator.

**200**:

```json
{
  "users": [
    { "id": "...", "email": "...", "display_name": "...", "role": "COLLECTOR" | "COORDINATOR", "accepted": true, "created_at": "..." }
  ]
}
```

**Errors**:
- 403 `forbidden` — non-coordinator (US-5 scenario 2).

## PATCH /users/:id/accepted

Maps to FR-051, US-5 scenario 3, SC-006.

**Auth**: required, coordinator.

**Body**: `{ "accepted": true | false }`.

Behavior: the flag is toggled AND every `LessonInstance` with at least one collection from `:id` is recomputed inside the same transaction as the flag change (US-5 scenario 3). The transaction takes an advisory lock per affected instance (research §9) so concurrent sync ingests cannot interleave a stale aggregate.

**200**: updated user object (same fields as `GET /users[].users[]`).

**Errors**:
- 403 `forbidden`.
- 404 `not_found`.
- 400 `invalid_payload` — `accepted` missing or not boolean.
