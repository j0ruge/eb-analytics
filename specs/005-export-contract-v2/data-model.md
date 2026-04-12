# Data Model — Export Data Contract v2

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

## Overview

This document describes the two data models that 005 touches:

1. **SQLite local schema** — the `lessons_data` table with four new columns added, plus the read-only JOIN chain through `lesson_topics` and `lesson_series` that resolves the series at export time.
2. **v2 export envelope** — the JSON payload emitted by `exportService.exportData()` to the OS share sheet.

Both models are authoritative for the /speckit.tasks phase: if implementation disagrees with this document, the doc wins.

## SQLite Schema — `lessons_data` (post-005)

### Columns

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | TEXT | NO | — | PK, UUID v4, reused as `collections[].id` in the export |
| `date` | TEXT | NO | — | ISO `YYYY-MM-DD`, lesson occurrence date |
| `coordinator_name` | TEXT | YES | `''` | Legacy (pre-006), free-text collector name; unused after 006 ships |
| `professor_name` | TEXT | YES | `''` | Legacy free-text fallback for professor name; **written only when `professor_id IS NULL`** (XOR enforced by `lessonService`) |
| `professor_id` | TEXT | YES | — | FK → `professors.id`; **mutually exclusive with `professor_name`** |
| `lesson_topic_id` | TEXT | YES | — | FK → `lesson_topics.id`; **mutually exclusive with `lesson_title`** |
| `series_name` | TEXT | YES | `''` | Legacy free-text fallback for series code/name; written only on the free-text topic path (when `lesson_topic_id IS NULL`) |
| `lesson_title` | TEXT | YES | `''` | Legacy free-text fallback for topic title; written only when `lesson_topic_id IS NULL` |
| `time_expected_start` | TEXT | NO | `'10:00'` | `HH:MM` |
| `time_real_start` | TEXT | YES | — | `HH:MM` or NULL |
| `time_expected_end` | TEXT | NO | `'11:00'` | `HH:MM` |
| `time_real_end` | TEXT | YES | — | `HH:MM` or NULL |
| `attendance_start` | INTEGER | NO | `0` | Head count at start; `0` is ambiguous (see EC-007) |
| `attendance_mid` | INTEGER | NO | `0` | Head count mid-lesson; `0` is ambiguous (see EC-007) |
| `attendance_end` | INTEGER | NO | `0` | Head count at end; `0` is ambiguous (see EC-007) |
| `unique_participants` | INTEGER | NO | `0` | Distinct people total for the lesson |
| `status` | TEXT | NO | `'IN_PROGRESS'` | CHECK IN (`'IN_PROGRESS'`, `'COMPLETED'`, `'EXPORTED'`, `'SYNCED'`); 005 stops writing `EXPORTED` but keeps the value legal for backwards compatibility |
| `created_at` | TEXT | NO | `CURRENT_TIMESTAMP` | ISO 8601 UTC, never rewritten |
| **`client_updated_at`** | **TEXT** | **YES** | — | **NEW (005)** — ISO 8601 UTC, ms precision. Touched on every `updateLesson`. Backfilled to `created_at` for pre-existing rows. |
| **`includes_professor`** | **INTEGER** | **NO** | **`0`** | **NEW (005)** — boolean (`0`/`1`) indicating whether attendance counters include the professor. Default comes from `useIncludesProfessorDefault` at creation time. |
| **`weather`** | **TEXT** | **YES** | — | **NEW (005)** — free-text weather note, e.g. `"Ensolarado 28°C"`. NULL when empty. |
| **`notes`** | **TEXT** | **YES** | — | **NEW (005)** — free-text general notes. NULL when empty. |

### Migration (idempotent)

Added to `src/db/client.ts` following the same `PRAGMA table_info` pattern already used for `professor_id` and `lesson_topic_id`:

```sql
-- Pseudocode; actual code uses tableInfo.some(col => col.name === '...') guards
IF NOT EXISTS column 'client_updated_at':
    ALTER TABLE lessons_data ADD COLUMN client_updated_at TEXT;
    UPDATE lessons_data SET client_updated_at = created_at WHERE client_updated_at IS NULL;

IF NOT EXISTS column 'includes_professor':
    ALTER TABLE lessons_data ADD COLUMN includes_professor INTEGER NOT NULL DEFAULT 0;

IF NOT EXISTS column 'weather':
    ALTER TABLE lessons_data ADD COLUMN weather TEXT;

IF NOT EXISTS column 'notes':
    ALTER TABLE lessons_data ADD COLUMN notes TEXT;
```

**Invariants**:

- Migration is idempotent: running it N times against a DB that already has the columns produces zero mutations (each `ALTER` is gated by a `tableInfo.some(...)` check).
- Backfill of `client_updated_at` is a separate `UPDATE` with a `WHERE client_updated_at IS NULL` guard, so re-running the migration on a partially-migrated DB does not overwrite already-set timestamps.
- No existing column is dropped, renamed, or retyped. No CHECK constraint is rewritten.

### State Transitions (`status` column)

No change in 005. The existing transitions are:

```text
IN_PROGRESS ──(complete)──► COMPLETED
   │                          │
   └──(delete)──► [gone]      └──(legacy v1 export)──► EXPORTED [no longer written in 005]
                                            │
                                            └──(spec 008)──► SYNCED [future]
```

005 removes the `COMPLETED → EXPORTED` transition from the write-path but does not touch the enum definition. Pre-existing `EXPORTED` rows remain legal and are still filtered out of `getCompletedLessons()`; they are simply stuck in that state forever unless a future spec cleans them up.

### XOR Invariants (enforced in `lessonService`)

| Pair | Invariant | Who enforces |
|---|---|---|
| `professor_id` / `professor_name` | Exactly one of them is non-empty (both can be empty on an IN_PROGRESS draft). | `createLesson`, `updateLesson` |
| `lesson_topic_id` / `lesson_title` | Exactly one of them is non-empty (both can be empty on an IN_PROGRESS draft). | `createLesson`, `updateLesson` |
| `lesson_topic_id` / `series_name` | When `lesson_topic_id IS NOT NULL`, `series_name` MUST be empty (series resolved via JOIN). When `lesson_topic_id IS NULL`, `series_name` MAY be non-empty and becomes `series_code_fallback` in the payload. | `createLesson`, `updateLesson` |

A violation is defensively corrected in the service layer (the legacy field is cleared) rather than thrown, to avoid breaking mid-flight drafts.

### Read Path for Export

The export layer reads rows via `lessonService.getCompletedLessons()`. To resolve the catalog-derived fields (`series_id`, `series_code_fallback`, `topic_title`, `professor_name_resolved`) it either (a) calls the existing `getAllLessonsWithDetails()` which already performs the LEFT JOIN, or (b) a new sibling method that applies the same JOIN but filters by status. The plan calls option (a) — reuse `getAllLessonsWithDetails()` and filter in memory by `status === COMPLETED`, because the total number of lessons per installation is small (≤ 50) and the in-memory filter is free.

SQL shape (unchanged from spec 003):

```sql
SELECT
  ld.*,
  lt.title       AS topic_title,
  lt.series_id   AS resolved_series_id,
  ls.code        AS series_code,
  ls.title       AS series_title,
  p.name         AS professor_name_resolved
FROM lessons_data ld
LEFT JOIN lesson_topics lt ON ld.lesson_topic_id = lt.id
LEFT JOIN lesson_series ls ON lt.series_id      = ls.id
LEFT JOIN professors p    ON ld.professor_id   = p.id
WHERE ld.status = 'COMPLETED'
ORDER BY ld.date DESC, ld.created_at DESC;
```

The `resolved_series_id` column is what becomes `lesson_instance.series_id` in the payload. When `lesson_topic_id IS NULL`, `resolved_series_id` is `NULL` and the export layer falls back to `lessons_data.series_name` as `series_code_fallback`.

## v2 Export Envelope

### Top-level shape

```typescript
interface ExportEnvelopeV2 {
  schema_version: "2.0";
  client: ClientInfo;
  collector: null;                  // always null in 005; spec 006 will populate
  exported_at: string;              // ISO 8601 UTC, ms precision
  collections: CollectionSubmission[];
}

interface ClientInfo {
  app_version: string;              // Constants.expoConfig?.version ?? 'unknown'
  device_id: string;                // UUID v4, stable per installation
}
```

### `CollectionSubmission`

```typescript
interface CollectionSubmission {
  id: string;                       // reused from lessons_data.id (stable across re-exports)
  client_created_at: string;        // ISO 8601 UTC
  client_updated_at: string;        // ISO 8601 UTC
  status: "COMPLETED";              // constant for 005 — only COMPLETED is exportable
  lesson_instance: LessonInstanceRef;
  times: TimesBlock;
  attendance: AttendanceBlock;
  unique_participants: number;      // integer ≥ 0
  weather: string | null;
  notes: string | null;
}
```

### `LessonInstanceRef`

```typescript
interface LessonInstanceRef {
  date: string;                     // ISO YYYY-MM-DD
  series_id: string | null;         // resolved via JOIN; null iff lesson_topic_id is null
  series_code_fallback: string | null;  // populated from lessons_data.series_name iff series_id is null
  topic_id: string | null;
  topic_title_fallback: string | null;  // populated from lessons_data.lesson_title iff topic_id is null
  professor_id: string | null;
  professor_name_fallback: string | null;  // populated from lessons_data.professor_name iff professor_id is null
}
```

**XOR invariants** (mirrored from the SQLite XOR invariants above):

- Exactly one of `series_id` / `series_code_fallback` is non-null (can both be null only in pathological pre-005 data).
- Exactly one of `topic_id` / `topic_title_fallback` is non-null.
- Exactly one of `professor_id` / `professor_name_fallback` is non-null.

### `TimesBlock`

```typescript
interface TimesBlock {
  expected_start: string;           // "HH:MM"
  expected_end:   string;           // "HH:MM"
  real_start:     string | null;    // "HH:MM" or null
  real_end:       string | null;    // "HH:MM" or null
}
```

### `AttendanceBlock`

```typescript
interface AttendanceBlock {
  start: number;                    // integer ≥ 0; see EC-007 on the 0 ambiguity
  mid:   number;
  end:   number;
  includes_professor: boolean;      // required, default false on migrated rows
}
```

### Example (fully populated)

```json
{
  "schema_version": "2.0",
  "client": {
    "app_version": "1.0.0",
    "device_id": "8a1b4c7e-2f3d-4a5b-9c1d-0e2f3a4b5c6d"
  },
  "collector": null,
  "exported_at": "2026-04-11T13:22:10.123Z",
  "collections": [
    {
      "id": "c2a5f6e9-1234-4b67-9e01-abcdef012345",
      "client_created_at": "2026-04-11T13:05:00.000Z",
      "client_updated_at": "2026-04-11T13:18:42.456Z",
      "status": "COMPLETED",
      "lesson_instance": {
        "date": "2026-04-11",
        "series_id": "b1a2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
        "series_code_fallback": null,
        "topic_id": "a9b8c7d6-5432-4321-9876-543210fedcba",
        "topic_title_fallback": null,
        "professor_id": null,
        "professor_name_fallback": "Jefferson Pedro"
      },
      "times": {
        "expected_start": "10:00",
        "expected_end":   "11:00",
        "real_start":     "10:07",
        "real_end":       "11:03"
      },
      "attendance": {
        "start": 22,
        "mid":   28,
        "end":   25,
        "includes_professor": false
      },
      "unique_participants": 31,
      "weather": "Ensolarado 28°C",
      "notes":   "Trocou de professor às 10:15 — Jefferson substituiu Alex"
    }
  ]
}
```

## TypeScript Type Locations

| Type | File | Notes |
|---|---|---|
| `Lesson` (existing, extended) | `src/types/lesson.ts` | Add `client_updated_at`, `includes_professor`, `weather`, `notes` |
| `LessonWithDetails` (existing) | `src/types/lesson.ts` | Already extends Lesson; inherits new fields automatically |
| `ExportEnvelopeV2` | `src/services/exportService.ts` | New internal type; not exported since nothing else needs it |
| `CollectionSubmission`, `LessonInstanceRef`, `TimesBlock`, `AttendanceBlock`, `ClientInfo` | `src/services/exportService.ts` | Same — local types private to the service |

Rationale for keeping the envelope types inside `exportService.ts` instead of promoting them to `src/types/`: the envelope shape is a **contract**, not a domain entity, and it is only produced in one place. Putting it in `src/types/` would suggest it is consumed by multiple modules, which is not the case in 005 (spec 008 will introduce a separate HTTP client that may or may not share the type — that's a decision for 008).
