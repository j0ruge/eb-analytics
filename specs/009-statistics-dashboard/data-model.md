# Data Model — Statistics Dashboard

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Overview

All types in this document are **derived, in-memory** representations computed from the existing `lessons_data` table. **No new persistent tables and no schema migrations are introduced by this feature.**

Types live in `src/types/dashboard.ts`. The dashboardService (`src/services/dashboardService.ts`) is the single producer of every type; the dashboard screen and chart components are the only consumers.

## Source Data

All datasets are computed from `lessons_data` rows where `status IN ('COMPLETED', 'EXPORTED', 'SYNCED')` (FR-022, see research.md §4). The fields used:

| Field | Type | Source | Used by |
|---|---|---|---|
| `id` | TEXT | `lessons_data.id` | All datums (back-reference for tooltip "Ver aula" link) |
| `date` | TEXT (ISO `YYYY-MM-DD`) | `lessons_data.date` | All datums (X axis) |
| `attendance_start` | INTEGER | `lessons_data.attendance_start` | LateArrival, AttendanceCurve |
| `attendance_mid` | INTEGER | `lessons_data.attendance_mid` | AttendanceCurve |
| `attendance_end` | INTEGER | `lessons_data.attendance_end` | LateArrival, AttendanceCurve, Trend, Engagement |
| `unique_participants` | INTEGER | `lessons_data.unique_participants` | Engagement |
| `time_expected_start` | TEXT (`HH:MM`) | `lessons_data.time_expected_start` | Punctuality |
| `time_real_start` | TEXT (`HH:MM`) or null | `lessons_data.time_real_start` | Punctuality |
| `professor_id` | TEXT or null | `lessons_data.professor_id` | Trend tooltip (professor name via JOIN), deferred FR-037 |
| `lesson_topic_id` | TEXT or null | `lessons_data.lesson_topic_id` | AttendanceCurve (topic title via JOIN), deferred FR-036 |

Joins used by MVP:

- `LEFT JOIN professors p ON p.id = l.professor_id` — to surface the professor name in tooltips.
- `LEFT JOIN lesson_topics t ON t.id = l.lesson_topic_id` — to surface the topic title below each mini-chart in FR-031.

## Derived Entities

### `DashboardFilters`

The filter object accepted by every `dashboardService` function.

```ts
interface DashboardFilters {
  from?: Date;           // inclusive lower bound on lesson.date. Ignored in MVP (see FR-021 + Out of Scope)
  to?: Date;             // inclusive upper bound on lesson.date. Ignored in MVP
  currentUserId?: string;// reserved for spec 006. Ignored in MVP (see EC-005)
}
```

**Notes**:

- MVP ignores all three fields. Their shape exists so the signature is stable across the P2/P3 rollout and across the eventual spec-006 integration. This avoids a breaking change to `dashboardService` later.
- When spec 006 ships, `currentUserId` will map to a `collector_user_id` column and become a mandatory filter when set.

### `LateArrivalDatum` (FR-030, P1)

```ts
interface LateArrivalDatum {
  lessonId: string;          // for tooltip "Ver aula" link
  date: string;              // ISO date; formatted DD/MM at render time
  percent: number;           // ((end - start) / end) * 100, clamped to [0, 100]
  attendanceStart: number;   // raw count for tooltip
  attendanceEnd: number;     // raw count for tooltip
  lateCount: number;         // attendanceEnd - attendanceStart (clamped to 0)
  isInconsistent: boolean;   // true if end < start (EC-007 flag)
}
```

**Exclusion rules** (EC-002, clarifications session 2026-04-11):

- Rows where `attendance_end` is null or `0` → **excluded** from the dataset; contribute to the "N aulas excluídas" footnote count.
- Rows where `attendance_start` is null → **excluded** from the dataset; same footnote.
- Rows where `attendance_end < attendance_start` (data-entry error) → **included** with `percent = 0` and `isInconsistent = true` (EC-07).

### `AttendanceCurveDatum` (FR-031, P1)

```ts
interface AttendanceCurveDatum {
  lessonId: string;
  date: string;             // ISO date
  topicTitle: string | null;// JOIN on lesson_topics; null if the lesson has no topic linked
  start: number;            // attendance_start
  mid: number;              // attendance_mid
  end: number;              // attendance_end
}
```

**Exclusion rules**: a lesson is included when at least two of `(start, mid, end)` are non-null. Missing points render as gaps in the mini line chart rather than zero (a zero would misrepresent the curve).

### `TrendDatum` (FR-032, P2)

```ts
interface TrendDatum {
  lessonId: string;
  date: string;
  attendanceEnd: number;
}
```

**Exclusion rules**: rows with null `attendance_end` are excluded. Zero `attendance_end` is **included** here (legitimate data point — "a lesson where no one stayed" is meaningful in a trend).

### `PunctualityDatum` (FR-033, P2)

```ts
interface PunctualityDatum {
  lessonId: string;
  date: string;
  minutesLate: number; // signed: positive = late, 0 = on time, negative = early
}
```

**Formula**: `toMinutes(time_real_start) - toMinutes(time_expected_start)` where `toMinutes("HH:MM") = H*60 + M`.

**Exclusion rules**: rows where `time_real_start` is null → excluded (footnote count).

### `EngagementDatum` (FR-034, P2)

```ts
interface EngagementDatum {
  lessonId: string;
  date: string;
  rate: number;               // (unique_participants / attendance_end) * 100
  uniqueParticipants: number;
  attendanceEnd: number;
}
```

**Exclusion rules**: same as LateArrival — rows with null or zero `attendance_end` excluded. `unique_participants = 0` is a legitimate value (bar renders at 0%).

### `ProfessorInfluenceDatum` (FR-037, P3 — DEFERRED)

Not implemented in this branch. See `research.md` §2 for the schema gap that prevents it (missing `notes` column).

When implemented, the shape will be:

```ts
interface ProfessorInfluenceDatum {
  professorId: string;
  professorName: string;
  lessonCount: number;
  avgAttendance: number;
  deltaFromBaseline: number;
  isLowSample: boolean;       // true when lessonCount < 3
  lessonDates: string[];      // for drill-down
}
```

## Computation Rules — Applied By Every Function

1. **Status filter**: `WHERE status IN ('COMPLETED', 'EXPORTED', 'SYNCED')`.
2. **Ordering**: `ORDER BY date DESC` in SQL, then `array.reverse()` in JS so the returned array is chronological (oldest → newest).
3. **Limit**: `LIMIT N` where N comes from `DASHBOARD_LIMITS` constants:
   - `DASHBOARD_LIMITS.timeSeries = 12` — used by LateArrival, AttendanceCurve, Punctuality, Engagement.
   - `DASHBOARD_LIMITS.trend = 26` — used by Trend.
4. **Footnote count**: each function returns not only the datum array but also an `excludedCount: number` so the UI can render the "N aulas excluídas por dados incompletos" footnote without a second query.

The return shape of every function is therefore `{ data: Datum[], excludedCount: number }`. See [contracts/dashboard-service.md](./contracts/dashboard-service.md) for the full signatures.

## Relationships (ER Sketch)

```text
lessons_data (status IN terminal states)
   │
   ├─ LateArrivalDatum         (1:1 per eligible row)
   ├─ AttendanceCurveDatum     (1:1 per eligible row)
   ├─ TrendDatum               (1:1 per eligible row)
   ├─ PunctualityDatum         (1:1 per eligible row, excludes null time_real_start)
   └─ EngagementDatum          (1:1 per eligible row, excludes null/zero attendance_end)

   + JOIN professors           (for tooltip labels)
   + JOIN lesson_topics        (for FR-031 subtitle)
```

No datum aggregates across multiple lessons in MVP. FR-037 (deferred) would be the first per-professor aggregate.

## State Transitions

None. All datums are read-only projections. The dashboard never mutates `lessons_data`.

## Data Volume Assumptions

- Realistic one-year volume: ~52 lessons (one per Saturday). MVP caps rendering at 12 or 26 rows, so the visible dataset never grows with time.
- SQLite query with limit + index on `date` returns in <10ms even at 1000+ rows.
- In-memory datum array at MVP limits: at most 26 objects × ~120 bytes ≈ 3 KB. Negligible.
