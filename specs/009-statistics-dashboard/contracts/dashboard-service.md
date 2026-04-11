# Contract — `dashboardService`

**Spec**: [../spec.md](../spec.md) | **Data Model**: [../data-model.md](../data-model.md) | **Plan**: [../plan.md](../plan.md)

This document is the canonical TypeScript contract for the new `dashboardService`. It corresponds to the `Service Layer` rules in CLAUDE.md §5: an object literal, async methods, parameterized SQL, no UI coupling.

The screen `app/(tabs)/dashboard.tsx` and every chart component consume this API. **The contract is stable across MVP, P2, and the eventual P3 rollout** — new functions are added, existing signatures are not changed.

## Location

```text
src/services/dashboardService.ts
```

## Shared Types

Imported from `src/types/dashboard.ts` (see [data-model.md](../data-model.md) for field-level documentation).

```ts
export interface DashboardFilters {
  from?: Date;
  to?: Date;
  currentUserId?: string;
}

export interface DashboardResult<T> {
  data: T[];
  excludedCount: number;
}

export const DASHBOARD_LIMITS = {
  timeSeries: 12,
  trend: 26,
} as const;
```

## Functions

### MVP — P1

#### `getLateArrivalIndex`

```ts
async function getLateArrivalIndex(
  filters?: DashboardFilters
): Promise<DashboardResult<LateArrivalDatum>>;
```

**Behavior**:

- Returns up to `DASHBOARD_LIMITS.timeSeries` (12) most recent lessons, sorted chronologically ascending.
- Filters to `status IN ('COMPLETED', 'EXPORTED', 'SYNCED')`.
- Excludes rows where `attendance_end` is null or 0, or `attendance_start` is null. Exclusion count is returned in `excludedCount`.
- For rows where `attendance_end < attendance_start`, sets `percent = 0` and `isInconsistent = true` (EC-007).
- Percent formula: `((attendance_end - attendance_start) / attendance_end) * 100`, rounded to one decimal place.

**Errors**: throws only if the database is unreachable (propagates the underlying expo-sqlite error with a descriptive message). Never throws for empty result sets — returns `{ data: [], excludedCount: 0 }`.

#### `getAttendanceCurves`

```ts
async function getAttendanceCurves(
  filters?: DashboardFilters
): Promise<DashboardResult<AttendanceCurveDatum>>;
```

**Behavior**:

- Returns up to 12 most recent lessons, chronological ascending.
- Includes a LEFT JOIN on `lesson_topics` to populate `topicTitle`.
- Excludes rows where fewer than 2 of `(attendance_start, attendance_mid, attendance_end)` are non-null.

### P2 (follow-up slice on the same branch, if scope allows)

#### `getAttendanceTrend`

```ts
async function getAttendanceTrend(
  filters?: DashboardFilters
): Promise<DashboardResult<TrendDatum>>;
```

- Returns up to `DASHBOARD_LIMITS.trend` (26) most recent lessons.
- Excludes rows where `attendance_end` is null. Zero is a valid value and IS included.

#### `getPunctuality`

```ts
async function getPunctuality(
  filters?: DashboardFilters
): Promise<DashboardResult<PunctualityDatum>>;
```

- Returns up to 12 most recent lessons.
- Excludes rows where `time_real_start` is null.
- Minutes-late formula: `parseHMM(time_real_start) - parseHMM(time_expected_start)`, where `parseHMM("HH:MM") = H*60 + M`.

#### `getEngagementRate`

```ts
async function getEngagementRate(
  filters?: DashboardFilters
): Promise<DashboardResult<EngagementDatum>>;
```

- Returns up to 12 most recent lessons.
- Excludes rows where `attendance_end` is null or 0.
- Zero `unique_participants` is a valid value and IS included (rate = 0%).

### P3 — DEFERRED

#### `getProfessorInfluence` — NOT IMPLEMENTED

Deferred past MVP. See `research.md` §2 for the schema gap (`notes` column missing) that prevents implementation. When this function ships, its signature will be:

```ts
async function getProfessorInfluence(opts?: {
  includeSpecialEvents?: boolean;
  metric?: 'attendance' | 'engagement';
}): Promise<DashboardResult<ProfessorInfluenceDatum>>;
```

## Invariants Enforced by the Service

1. **No SQL in screens or components.** Every SQL statement lives in this file.
2. **Parameterized queries only.** No string interpolation of filter values into SQL.
3. **Status filter is mandatory.** Every query includes `WHERE status IN ('COMPLETED', 'EXPORTED', 'SYNCED')`. No public function bypasses it.
4. **Limits are constants, not magic numbers.** Every `LIMIT` uses `DASHBOARD_LIMITS.*`.
5. **Exclusion counts are authoritative.** `excludedCount` is computed from a `SELECT COUNT(*)` with the same base filters minus the chart-specific exclusion, so the UI footnote never lies.
6. **Functions are pure w.r.t. the filesystem and network.** They touch only SQLite. No HTTP, no file I/O, no timers.

## Sketch: `getLateArrivalIndex` Implementation

Illustrative only — the actual implementation is a `/speckit.tasks` output.

```ts
async getLateArrivalIndex(
  filters: DashboardFilters = {},
): Promise<DashboardResult<LateArrivalDatum>> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{
    id: string;
    date: string;
    attendance_start: number;
    attendance_end: number;
  }>(
    `SELECT id, date, attendance_start, attendance_end
       FROM lessons_data
      WHERE status IN ('COMPLETED', 'EXPORTED', 'SYNCED')
        AND attendance_start IS NOT NULL
        AND attendance_end IS NOT NULL
        AND attendance_end > 0
      ORDER BY date DESC
      LIMIT ?`,
    [DASHBOARD_LIMITS.timeSeries],
  );

  const excludedRow = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) as n
       FROM lessons_data
      WHERE status IN ('COMPLETED', 'EXPORTED', 'SYNCED')
        AND (attendance_start IS NULL
             OR attendance_end IS NULL
             OR attendance_end = 0)`,
  );

  const data: LateArrivalDatum[] = rows.reverse().map((r) => {
    const isInconsistent = r.attendance_end < r.attendance_start;
    const percent = isInconsistent
      ? 0
      : Math.round(
          ((r.attendance_end - r.attendance_start) / r.attendance_end) * 1000,
        ) / 10;
    return {
      lessonId: r.id,
      date: r.date,
      percent,
      attendanceStart: r.attendance_start,
      attendanceEnd: r.attendance_end,
      lateCount: Math.max(0, r.attendance_end - r.attendance_start),
      isInconsistent,
    };
  });

  return { data, excludedCount: excludedRow?.n ?? 0 };
}
```

## Test Surface (for `/speckit.tasks`)

`tests/unit/dashboardService.test.ts` MUST cover, at minimum:

1. **Status filter**: a lesson with `status = 'IN_PROGRESS'` is NEVER returned. A lesson with `COMPLETED`, `EXPORTED`, or `SYNCED` IS returned.
2. **Percent formula**: `(7, 25) → 72.0`, `(10, 28) → 64.3`, `(16, 26) → 38.5`, `(4, 24) → 83.3`. Matches US1 acceptance scenario 1.
3. **Zero `attendance_end`**: excluded, increments `excludedCount`.
4. **Null `attendance_end`**: excluded, increments `excludedCount`.
5. **Null `attendance_start`**: excluded, increments `excludedCount`.
6. **Inconsistent (`end < start`)**: included with `percent = 0` and `isInconsistent = true`.
7. **Limit**: with 20 valid lessons in the table, the result contains exactly 12 rows, being the 12 most recent by `date`.
8. **Chronological order**: returned array is sorted oldest → newest.
9. **Empty DB**: returns `{ data: [], excludedCount: 0 }` without throwing.

Similar tests for each P2 function when that slice ships.
