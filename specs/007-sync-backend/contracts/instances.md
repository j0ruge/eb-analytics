# Contracts — Lesson Instances

All endpoints require coordinator role per FR-061 (plain collectors do not see aggregates — FR-040).

## GET /instances?from=<iso>&to=<iso>

Maps to US-3, FR-040.

**Auth**: required, coordinator.

**Query**:
- `from`, `to` — ISO-8601 dates (`YYYY-MM-DD`). Filter `date ∈ [from, to]` inclusive.

**200**:

```json
{
  "instances": [
    {
      "id": "...",
      "date": "2026-04-11",
      "series_code": "EB354",
      "topic_id": "...",
      "professor_id": "...",
      "agg_start": 12,
      "agg_mid": 11,
      "agg_end": 10,
      "agg_dist": 14,
      "agg_collector_count": 3,
      "collections": [
        { "id": "...", "collector_user_id": "...", "status": "SYNCED", "attendance_start": 10, "attendance_mid": 11, "attendance_end": 9, "includes_professor": false, "unique_participants": 13 }
      ]
    }
  ]
}
```

**Errors**:
- 403 `forbidden`.
- 400 `invalid_query` — missing/invalid `from`/`to`.

## GET /instances/:id

Maps to FR-041, US-3.

**Auth**: required, coordinator.

**200**: one instance with full expansion (same shape as array entry above).

**404** `not_found`.

## POST /instances/:id/recompute

Maps to FR-042. Operator-debug tool; runs `aggregateService.recompute(id)` out-of-band.

**Auth**: required, coordinator.

**204** — success (aggregates updated).

**Errors**:
- 404 `not_found`.
