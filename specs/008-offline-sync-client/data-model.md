# Data Model — Offline-First Sync Client (008)

**Phase**: 1 — Design & Contracts
**Date**: 2026-04-18
**Scope**: local SQLite changes + the derived `SyncQueue` query. No server-side model changes — the server contract is spec 007's.

---

## 1. `lessons_data` — new columns (migration 008)

### Current shape (post-006)

```sql
CREATE TABLE lessons_data (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL,
    coordinator_name TEXT DEFAULT '',
    professor_name TEXT DEFAULT '',
    professor_id TEXT,
    lesson_topic_id TEXT,
    series_name TEXT DEFAULT '',
    lesson_title TEXT DEFAULT '',
    time_expected_start TEXT DEFAULT '10:00',
    time_real_start TEXT,
    time_expected_end TEXT DEFAULT '11:00',
    time_real_end TEXT,
    attendance_start INTEGER DEFAULT 0,
    attendance_mid INTEGER DEFAULT 0,
    attendance_end INTEGER DEFAULT 0,
    unique_participants INTEGER DEFAULT 0,
    status TEXT CHECK(status IN ('IN_PROGRESS','COMPLETED','EXPORTED','SYNCED'))
      DEFAULT 'IN_PROGRESS',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    client_updated_at TEXT,
    includes_professor INTEGER NOT NULL DEFAULT 0,
    weather TEXT,
    notes TEXT,
    collector_user_id TEXT                       -- added by 006
);
```

### Columns added by migration 008

| Column | Type | Nullable | Default | Spec | Notes |
|---|---|---|---|---|---|
| `sync_status` | TEXT | NO | `'LOCAL'` | FR-001 | CHECK constraint: `sync_status IN ('LOCAL','QUEUED','SENDING','SYNCED','REJECTED')`. |
| `sync_error` | TEXT | YES | NULL | FR-002 | Populated on `REJECTED`; either the per-item `rejected[].message` from `POST /sync/batch` (FR-025) or `<code>:<message>` when the server distinguishes. |
| `sync_attempt_count` | INTEGER | NO | `0` | FR-003 | Reset to 0 on successful send (FR-023) and on "Retry agora" (FR-031). |
| `sync_next_attempt_at` | TEXT | YES | NULL | FR-004 | ISO 8601. NULL = ready to send on next loop tick. Populated by `parseRetryAfter(...)` for 429 or by FR-030 schedule for 5xx / timeouts. |
| `synced_at` | TEXT | YES | NULL | FR-004a | ISO 8601. Written once at `SENDING → SYNCED`. Used to filter the 7-day history window on `/sync` (FR-016). |

### Constitution IV — Backward Compatibility

The migration:

1. Runs once (guarded by `_migration_flags.key = '008_offline_sync_complete'`).
2. Uses `PRAGMA table_info('lessons_data')` to confirm each new column is absent before `ALTER TABLE ADD COLUMN` (idempotent, FR-006, spec 003 pattern).
3. Sets `sync_status = 'LOCAL'` for all existing rows (by the `DEFAULT 'LOCAL'` on ADD COLUMN with NOT NULL — SQLite back-fills atomically).
4. No row rewriting, no type migrations. Anonymous (`collector_user_id IS NULL`) and pre-login rows stay `'LOCAL'` forever unless the user logs in and hits "Enviar pra Nuvem".

### New indexes

```sql
CREATE INDEX IF NOT EXISTS idx_lessons_sync_status
  ON lessons_data(sync_status);

CREATE INDEX IF NOT EXISTS idx_lessons_sync_next_attempt
  ON lessons_data(sync_next_attempt_at)
  WHERE sync_status = 'QUEUED';
```

The partial index on `sync_next_attempt_at` keeps the hot query (FR-020 foreground tick: "which QUEUED items are due?") fast without bloating writes to LOCAL/SYNCED rows.

### Reconciliation on boot (EC-001)

Immediately after migrations:

```sql
UPDATE lessons_data
   SET sync_status = 'QUEUED'
 WHERE sync_status = 'SENDING';
```

Runs in `src/db/client.ts` before `SyncProvider` ever mounts. Safe because server idempotency (via `collections[].id`) neutralizes accidental resends (EC-001 rationale).

---

## 2. `sync_status` state machine

```
              create/save
 (nothing) ─────────────────► LOCAL
                                │
                                │ user taps "Enviar pra Nuvem" (FR-010)
                                ▼
                              QUEUED ◄─────────────────────────────┐
                                │                                   │
                                │ syncService claim (FR-022)        │
                                ▼                                   │
                              SENDING                                │
                                │                                   │
         ┌──────────────────────┼──────────────────────────┐        │
         │ accepted[] contains id│ rejected[] contains id  │ network/5xx/429/timeout
         ▼                      ▼                          ▼        │
       SYNCED                REJECTED                   (revert) ───┘
         │                      │
         │                      │ permanent — no retry (FR-025, User Story 5 scenario 4)
         │                      │
         ▼                      ▼
    (read-only)            (read-only, red banner — FR-013)
```

### Legal transitions

| From | To | Trigger | Writer |
|------|-----|---------|--------|
| (new row) | `LOCAL` | lesson creation | `lessonService.createLesson` |
| `LOCAL` | `QUEUED` | user tap "Enviar pra Nuvem" | `syncService.enqueue(lessonId)` |
| `QUEUED` | `SENDING` | loop claim (in a single transaction per batch, FR-022) | `syncService` |
| `SENDING` | `SYNCED` | id present in `POST /sync/batch` → `accepted[]` | `syncService.applyResult` |
| `SENDING` | `REJECTED` | id present in `rejected[]` (not 401/429) | `syncService.applyResult` |
| `SENDING` | `QUEUED` | network error / 5xx / 429 / timeout / 401 (FR-024, FR-024a, FR-026) | `syncService.applyResult` |
| `SENDING` | `QUEUED` | app boot (stuck from prior crash — EC-001) | `client.ts` reconciliation |
| `QUEUED` | `QUEUED` | "Retry agora" tap resets `sync_attempt_count = 0` and `sync_next_attempt_at = NULL` (FR-031) | `syncService.retryNow` |

### Illegal transitions (enforced by code + CHECK constraint)

- `SYNCED → anything` — row is read-only (FR-012).
- `REJECTED → anything` — permanent for MVP (FR-013, Out of Scope line 3).
- `LOCAL → SYNCED` directly — must pass through QUEUED/SENDING.

---

## 3. `SyncQueue` — derived, not a table

Per spec §Key Entities. The "queue" is just a query:

```sql
SELECT id, date, lesson_topic_id, series_name, lesson_title, professor_name,
       sync_status, sync_error, sync_attempt_count, sync_next_attempt_at
  FROM lessons_data
 WHERE sync_status IN ('QUEUED','SENDING')
   AND collector_user_id = ?                             -- multi-account safety (EC-002)
 ORDER BY sync_next_attempt_at ASC NULLS FIRST,
          client_created_at ASC
 LIMIT 20;                                               -- FR-021 batch cap
```

For the `/sync` screen (FR-016), append `REJECTED` so those rows stay visible:

```sql
SELECT ... FROM lessons_data
 WHERE sync_status IN ('QUEUED','SENDING','REJECTED')
   AND collector_user_id = ?
 ORDER BY
   CASE sync_status
     WHEN 'SENDING' THEN 0
     WHEN 'QUEUED'  THEN 1
     WHEN 'REJECTED' THEN 2
   END,
   client_created_at DESC;
```

For the 7-day history (FR-016, second block), separate query:

```sql
SELECT ... FROM lessons_data
 WHERE sync_status = 'SYNCED'
   AND collector_user_id = ?
   AND synced_at >= datetime('now','-7 days')
 ORDER BY synced_at DESC
 LIMIT 20;
```

---

## 4. `AsyncStorage` — `last_catalog_sync` cursor

| Key | Type | Written by | Read by |
|-----|------|------------|---------|
| `@eb-insights/last-catalog-sync` | ISO-8601 string | `catalogSyncService.pullNow` on success | `catalogSyncService.pullNow` to form `?since=...` |

Absent on first run. Cleared on logout (so a new user on the same device starts from a clean pull). Written transactionally with the upsert batch: server response parsed → upserts applied → cursor advanced to `server_now`. If the upsert partially fails, the cursor is not advanced.

---

## 5. `SyncResult` (client mirror of server payload)

Shape authoritative on the server at `specs/007-sync-backend/contracts/sync.md`. Client-side TypeScript mirror:

```typescript
export interface SyncResultRejection {
  id: string;
  code: string;
  message: string;
}

export interface SyncResult {
  accepted: string[];             // collection ids
  rejected: SyncResultRejection[];
  server_now: string;             // ISO 8601 — source for synced_at if not using client clock
}
```

**Field-to-state mapping** when `applyResult(result, sentIds)` runs:

- For every `id ∈ result.accepted`: `UPDATE ... SET sync_status = 'SYNCED', sync_error = NULL, sync_attempt_count = 0, sync_next_attempt_at = NULL, synced_at = :server_now WHERE id = ?`. The existing `status` column (LessonStatus) is **not** touched — FR-005 mandates the two columns remain distinct. The read-only lock on synced rows comes from `sync_status = 'SYNCED'` alone (FR-012), not from any change to LessonStatus.
- For every `id ∈ result.rejected` (and its `code` is not `rate_limited` or `unauthenticated`): `UPDATE ... SET sync_status = 'REJECTED', sync_error = ? WHERE id = ?`, where `sync_error = "{code}: {message}"`.
- For every `id ∈ sentIds` that is in neither list (should never happen per contract; log and treat as retryable): `UPDATE ... SET sync_status = 'QUEUED'` and schedule via FR-030.

---

## 6. Catalog upsert shape

Server returns per `specs/007-sync-backend/contracts/catalog.md` (GET /catalog). Upserts:

```sql
INSERT INTO lesson_series (id, code, title, description, updated_at)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  code = excluded.code,
  title = excluded.title,
  description = excluded.description,
  updated_at = excluded.updated_at;

INSERT INTO lesson_topics (id, series_id, title, sequence_order, suggested_date, updated_at)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  series_id = excluded.series_id,
  title = excluded.title,
  sequence_order = excluded.sequence_order,
  suggested_date = excluded.suggested_date,
  updated_at = excluded.updated_at;

INSERT INTO professors (id, name, email, updated_at)
VALUES (?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  email = excluded.email,
  updated_at = excluded.updated_at;
```

Items with `is_pending = true` are filtered out by the server (spec 007 FR-030, and FR-043 here). The client does **no** client-side `is_pending` check — trust the server.

Delete detection is **not** implemented in MVP (FR-042). Local rows referencing deleted server entities remain visible until a future spec introduces tombstone sync.

---

## 7. Invariants (checked in unit tests)

- **I1**: For every row, `sync_status` ∈ `{LOCAL, QUEUED, SENDING, SYNCED, REJECTED}`. Enforced by CHECK constraint.
- **I2**: `sync_status = 'SYNCED' ⟹ synced_at IS NOT NULL`.
- **I3**: `sync_status IN ('LOCAL','QUEUED','SENDING') ⟹ synced_at IS NULL`.
- **I4**: `sync_status = 'REJECTED' ⟹ sync_error IS NOT NULL`.
- **I5**: After every `applyResult` call, no row remains in `SENDING` (every id is classified).
- **I6**: `sync_attempt_count` monotonically non-decreasing while in `QUEUED|SENDING`; drops to 0 on `SYNCED` or on user-invoked "Retry agora".
- **I7**: `synced_at` is written exactly once; never updated after. Enforced by guarded UPDATE (`WHERE synced_at IS NULL` in `applyResult`).

---

## 8. Migration acceptance test (unit)

```ts
test('008 migration is idempotent', async () => {
  const db = await openTestDb();
  await migrateAddSyncStatus(db);
  const snapshot1 = await pragmaTableInfo(db, 'lessons_data');
  await migrateAddSyncStatus(db);      // run twice
  const snapshot2 = await pragmaTableInfo(db, 'lessons_data');
  expect(snapshot1).toEqual(snapshot2);
  expect(await getFlag(db, '008_offline_sync_complete')).toBe(true);
});
```
