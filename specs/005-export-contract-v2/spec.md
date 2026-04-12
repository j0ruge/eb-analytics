# Feature Specification: Export Data Contract v2

**Feature Branch**: `005-export-contract-v2`
**Created**: 2026-04-11
**Status**: Ready for Plan
**Input**: Roadmap item #1 — "Ajustar o formato JSON que o eb-insights exporta para poder alinhar com o backend"

## Clarifications

### Session 2026-04-11

- Q: How should `lesson_instance.series_id` be derived in the payload, given that `lessons_data` has no `series_id` column today? → A: Derive at export time via JOIN — `lessons_data.lesson_topic_id → lesson_topics.series_id → lesson_series.id`. Reuse the existing `getAllLessonsWithDetails` JOIN pattern. Do not add a redundant `series_id` column on `lessons_data`. This matches the canonical hierarchy: each `lesson_series` has a `code` (e.g. `Eb334`, `Eb335`) and a `title`, and contains multiple weekly `lesson_topics` (`lesson 1`, `lesson 2`, ...) each with their own `title` and `sequence_order`, all related to the main series theme.
- Q: What is the source of `client.app_version` in the payload? → A: `expo-constants` — `Constants.expoConfig?.version ?? 'unknown'`. `expo-constants` is already transitively available via the Expo SDK 54 setup (no new dependency). The value reflects whatever is manually bumped in `app.json` at each release, and works identically in Expo Go, dev builds, and standalone binaries.
- Q: Does `seedService` need to be updated to write `includes_professor`, `weather`, and `notes` into the new columns? → A: Yes — extend `seedService` in the same commit as the migration to read `c.attendance.includes_professor` and `c.notes` from `seed-collections.json` and persist them into the new columns. `weather` stays NULL because the JSON does not carry it. This preserves the "includes professor" signal (which is the whole motivation for that column — see the divergence between collectors documented in `.claude/rules/google-sheets-sync.md`) so that manual testing of the v2 export via the dev `__DEV__` seed button reflects realistic data.
- Q: Should `attendance.start/mid/end` support a "not counted" state distinct from "zero people counted"? → A: No — keep the existing `INTEGER NOT NULL DEFAULT 0` schema and CounterStepper UI unchanged. Document that `0` means "not counted or zero real people" and accept the ambiguity for the MVP. Rationale: cancelled classes would stay `IN_PROGRESS` and never reach COMPLETED in the first place, so the "0 real people" case is practically vanishingly rare; promoting the columns to nullable would require changing `CounterStepper` (used in 4 places) and is out of scope for 005. A future spec may promote to `number | null` if the demand appears.
- Q: What precision does `client_updated_at` use, and how are same-millisecond collisions handled? → A: ISO 8601 with milliseconds (`new Date().toISOString()`). Millisecond-level collisions between two rapid sequential service calls are accepted as benign: spec 007 (server) will use this timestamp for "last-write-wins" via `>=` comparisons (not strict equality), and spec 009 (dashboard) does not surface an "edited at" label. No extra monotonicity logic is added to `updateLesson` — zero complexity overhead.

## Scope Statement

This spec covers the **client-side export contract only**. It defines:

- The shape of the v2 export envelope (what goes in the JSON).
- The local data model changes needed to populate that envelope.
- The minimal UI changes to capture the new fields (`includes_professor`, `weather`, `notes`).

It explicitly does **not** cover:

- User login, `collector` identity population (→ spec 006). 005 ships with `collector: null` always.
- HTTP POST to any backend, server-side idempotency, partial-success responses (→ spec 007).
- Offline sync queue, batch splitting by size, conflict resolution (→ spec 008).
- Automated weather ingestion via a weather API (→ future spec). 005 only captures a free-text `weather` field.

005 is standalone-deliverable: nothing in 006/007/008 needs to land for 005 to be useful. The JSON file can be shared via the OS share sheet exactly like today, now in a structure the backend will recognize once it exists.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Anonymous Local Export (Priority: P1)

As a Class Secretary not logged in to any backend, I want to export my completed lessons as a JSON file via the device share sheet (WhatsApp, Drive, email), exactly like I do today, so that my data stays portable even without an account.

**Why this priority**: Baseline functionality. The app today works 100% offline; moving to a v2 contract must not regress the anonymous workflow.

**Independent Test**: Open the app fresh (no login), create and complete at least one lesson, tap "Exportar JSON", and verify the OS share sheet opens with a valid v2-schema JSON file whose `collector` field is `null`.

**Acceptance Scenarios**:

1. **Given** I have completed lessons, **When** I navigate to `/sync` and tap "Exportar JSON", **Then** the app generates a v2-schema payload with `"collector": null` and opens the share sheet.
2. **Given** the file is generated, **When** I inspect it, **Then** it contains `schema_version: "2.0"`, a `client` object with `app_version` and `device_id`, an `exported_at` ISO timestamp, and an array `collections[]` with at least one item.
3. **Given** I re-export the same set of completed lessons, **Then** each `collections[].id` is identical to the previous export (stable, not regenerated).

---

### User Story 2 - Re-exportable Completed Lessons (Priority: P1)

As a Collector, I want completed lessons to stay available for export every time I tap "Exportar JSON", so that I can re-share a file after a failed WhatsApp upload or after realizing I sent it to the wrong person.

**Why this priority**: Current v1 behavior marks lessons as `EXPORTED` and hides them from the next export batch, which makes re-sharing impossible. That was acceptable for offline-only, but once a backend exists (007/008) the client will need to resend the same collection if the first upload fails. 005 is where we stop burning the data after the first send.

**Independent Test**: Complete a lesson, export it, then immediately export again without modifying anything. Both exports succeed, both contain the lesson, both show the same `collections[].id`.

**Acceptance Scenarios**:

1. **Given** a lesson in status `COMPLETED` has been exported once, **When** I tap "Exportar JSON" again, **Then** the lesson appears in the new export with the same `id` and unchanged `client_created_at`/`client_updated_at`.
2. **Given** I edit a previously-exported lesson (e.g., fix a typo in notes), **When** I tap "Exportar JSON" again, **Then** `client_updated_at` is newer than `client_created_at` and the content reflects my edit.
3. **Given** I exported a lesson yesterday, **Then** the lesson is still listed in the /sync tab's "Aulas finalizadas" counter today — the export did not consume it.

---

### User Story 3 - Topic and Professor Override at Collection Time (Priority: P2)

As a Collector, I want to override the scheduled professor or topic when a substitution happens (e.g., the planned preacher is replaced at the last minute), so that my reading reflects what actually happened. The export payload must be clear about whether I chose a catalog entry or typed free text.

**Why this priority**: Substitutions are common in church contexts. The payload must distinguish "catalog item selected" from "free-text entered on the fly". P2 because the write-path already supports both modes today; 005 only needs to enforce the XOR invariant so that the payload is unambiguous.

**Independent Test**: Create a lesson picking "Alex Tolomei" from the catalog; export; verify payload has `professor_id: "<uuid>"` and `professor_name_fallback: null`. Then edit the lesson to free-text "Jefferson Pedro" (not in catalog); re-export; verify payload now has `professor_id: null` and `professor_name_fallback: "Jefferson Pedro"`.

**Acceptance Scenarios**:

1. **Given** the collector picks a catalog professor, **When** the export runs, **Then** the payload has `professor_id: "<uuid>"` and `professor_name_fallback: null`.
2. **Given** the collector overrides to a name not in the catalog, **When** the export runs, **Then** the payload has `professor_id: null` and `professor_name_fallback: "<typed name>"`.
3. **Given** the UI write-path attempts to set both `professor_id` and `professor_name`, **Then** the service layer clears the fallback before persisting (XOR is enforced at write, not at export).

**Implementation note (005 scope limitation)**: The current `ProfessorPicker` is catalog-only, and the Lesson Detail screen treats `COMPLETED` lessons as read-only (the `status !== IN_PROGRESS` guard disables all fields). As a result, the free-text override UI path described in Acceptance Scenario 2 is **not exercisable via the UI in 005** — it can only be triggered by direct service calls (or by a future spec that introduces a free-text picker mode and/or allows editing `COMPLETED` lessons). 005 still delivers US3 because the data layer, service layer, and export layer all handle the free-text branch correctly (enforced by T007, T008, T019, T020 unit tests); the missing piece is purely the UI trigger, which is deferred to a future spec. The quickstart manual verification (§2) reflects this via an explicit escape hatch.

---

### User Story 4 - Attendance Semantics Clarification (Priority: P1)

As a Collector, I want to explicitly state whether I counted the professor in my attendance numbers, so that future aggregation can normalize readings from different collectors who use different conventions.

**Why this priority**: The manual collection runs in 2026 Q1 proved that collectors disagree systematically about whether to include the professor (documented in `.claude/rules/google-sheets-sync.md`). Making it explicit eliminates the ambiguity at the source instead of re-deriving it from field notes.

**Independent Test**: Create two lessons, one with "Contei o professor" toggled ON and one with it OFF; export; verify both payloads have the correct `attendance.includes_professor` boolean.

**Acceptance Scenarios**:

1. **Given** the Lesson Detail form has a "Contei o professor nestas contagens" toggle, **When** I leave it off, **Then** `attendance.includes_professor: false` in the exported payload.
2. **Given** I toggle it on, **Then** the value persists to SQLite and exports as `true`.
3. **Given** the migration runs over lessons created before this spec, **Then** existing rows default to `includes_professor: false`.
4. **Given** Settings has a "Incluir professor nas contagens por padrão" preference, **When** I toggle it on and create a new lesson, **Then** the lesson is initialized with `includes_professor: true` and the Lesson Detail toggle shows it checked.

---

### User Story 5 - Observations Field (weather + notes) (Priority: P2)

As a Collector, I want a "Clima" field and a free "Observações" field on the Lesson Detail screen so that I can record context the numeric counters can't express (substitutions, weather disruptions, special events).

**Why this priority**: These are captured today as informal notes in the secretary's head and lost by the time the data reaches the coordinator. Surfacing them in the payload is cheap and enables the coordinator UI in future specs to display richer context. P2 because the app is still usable without them.

**Independent Test**: Open a lesson, type "Ensolarado 28°C" in Clima and "Trocou de professor às 10:15" in Observações, export, verify the payload reflects both.

**Acceptance Scenarios**:

1. **Given** the Lesson Detail has a text input "Clima" (short) and a multi-line "Observações", **When** I fill both and the debounced autosave fires, **Then** the values persist to SQLite.
2. **Given** I leave both fields empty, **Then** the exported `weather` and `notes` are `null`, not empty strings.
3. **Given** a future spec adds automated weather ingestion via a weather API, **Then** the schema of the `weather` field does not need to change — a string remains a string.

---

### Edge Cases

- **EC-001 (Empty Export)**: If user taps export with 0 completed lessons, show "Não há aulas finalizadas para exportar" alert and do NOT open share sheet. Guard is enforced at both the Sync screen level and inside `exportService.exportData()`.
- **EC-002 (Free-text Topic/Professor)**: When `topic_id`/`professor_id` is null, the export carries `topic_title_fallback`/`professor_name_fallback`. Future backend (007) will try fuzzy-matching. 005 just emits the fields correctly.
- **EC-003 (Large Batch)**: Not addressed in 005. A single file can grow arbitrarily large via the share sheet — the OS will handle it. Batch splitting for HTTP upload is a concern for spec 008.
- **EC-004 (Legacy Rows Without updated_at)**: Lessons created before this spec have no `client_updated_at`. The migration backfills them to match `created_at`. After migration, every row has a valid `client_updated_at`.
- **EC-005 (Re-completing an Edited Lesson)**: A completed lesson that gets edited (e.g., counter corrected) has its `client_updated_at` bumped on every mutation via `lessonService.updateLesson`. The next export reflects the edit.
- **EC-006 (Device Storage Wiped)**: If AsyncStorage is cleared (user clears app data), the next export generates a new `device_id`. Old exports still carry the previous ID — this is expected and not a bug. Correlating exports across a wipe is not a 005 concern.
- **EC-007 (Zero Counted vs Not Counted)**: `attendance.start/mid/end` are always `number` in the payload. A value of `0` is ambiguous — it can mean either "counted, zero people present" or "did not count this window". 005 accepts this ambiguity for MVP simplicity (see Clarifications Q4). The server-side aggregation in spec 007 MUST NOT assume `0` is always meaningful; coordinators reviewing raw files SHOULD treat `0` as "uncertain" unless cross-referenced with `notes`.

## Requirements *(mandatory)*

### Functional Requirements

**Payload shape**

- **FR-001**: The exported JSON MUST include a top-level `schema_version` field with the value `"2.0"`.
- **FR-002**: The `collector` field MUST be `null` in every export produced by 005. Spec 006 will populate it with a real object `{ user_id, display_name }` after login lands; until then, 005 hard-codes it to `null`. The field MUST be present (not omitted) so that the schema is stable.
- **FR-003**: Each `collections[].id` MUST be a client-generated UUID v4, stable across edits and re-exports of the same underlying lesson record (the existing `lessons_data.id` is reused directly).
- **FR-004**: Each collection MUST have `attendance.includes_professor` as a required boolean.
- **FR-005**: Only lessons with status `COMPLETED` are eligible for export. `IN_PROGRESS` lessons MUST be excluded.
- **FR-006**: Each `collections[].id` is a stable client UUID. The payload is designed so that a future backend can deduplicate by this id; 005 itself does not make any server call and does not enforce server-side idempotency.
- **FR-007**: Each collection MUST carry `client_created_at` and `client_updated_at` ISO 8601 UTC timestamps, used for ordering and future last-write-wins reconciliation.
- **FR-008**: An empty export (no completed lessons) MUST show a "Não há aulas finalizadas para exportar" alert and MUST NOT open the share sheet. The guard is enforced both at the UI (`app/(tabs)/sync.tsx`) and at the service (`exportService.exportData()`) so that no code path can bypass it.
- **FR-009**: For each of `topic`, `professor`, the collection MUST carry either an `*_id` (selected from catalog) OR an `*_fallback` string (free text). Never both non-null. The write-path (`lessonService`) enforces this invariant at save time; the export layer trusts it. **Series is a derived case** (see FR-009a): `series_id` comes from resolving `lessons_data.lesson_topic_id → lesson_topics.series_id → lesson_series.id`; there is no direct `lessons_data.series_id` column, so the XOR pair is effectively between "topic found in catalog (→ series_id resolvable via JOIN)" and "topic typed as free text (→ `series_code_fallback` populated from `lessons_data.series_name`, `series_id: null`)".
- **FR-009a**: The export layer MUST resolve `lesson_instance.series_id` via LEFT JOIN on `lesson_topics`/`lesson_series`, reusing the same pattern as `lessonService.getAllLessonsWithDetails()`. No new `series_id` column is added to `lessons_data` in 005. When `lesson_topic_id` is null (free-text topic path), `series_id` is `null` and `series_code_fallback` MUST be populated from the legacy `lessons_data.series_name` if non-empty, otherwise `null`.
- **FR-010**: The payload MUST include `client.device_id` — a UUID v4 persisted in AsyncStorage at first export (or first app boot, whichever happens first) and stable across sessions on the same installation.
- **FR-010a**: The payload MUST include `client.app_version`, read from `expo-constants` via `Constants.expoConfig?.version ?? 'unknown'`. This reflects the manually-versioned `app.json` and works in all build modes (Expo Go, dev build, standalone) without requiring a new dependency.
- **FR-011**: The export MUST include `exported_at` as an ISO 8601 UTC timestamp, distinct from individual collection timestamps.
- **FR-012**: The v1 export format MUST be fully replaced in the same release that ships v2. No runtime toggle — v2 is the only format from day one.

**Standalone scope & future compatibility**

- **FR-013**: 005 is standalone-deliverable. No part of this spec requires 006/007/008 to be merged or deployed. `collector` is `null`, `exportService.exportData()` only writes a local file and opens the share sheet, and there is no HTTP call anywhere in the 005 code path.

**Local data model**

- **FR-014a**: In the same commit as the migration, `seedService.seed()` MUST be extended to read `c.attendance.includes_professor` and `c.notes` from each collection in `seed-collections.json` and persist them into the new `includes_professor` and `notes` columns. The `weather` column is left NULL for seed-loaded rows (the JSON does not carry that field). The `SeedCollection` TypeScript interface and the `assertSeedPayload` type guard MUST be updated accordingly so that the seed pipeline fails loudly if the JSON drifts from the expected shape.
- **FR-014**: A database migration MUST add the following columns to `lessons_data` (idempotent via `PRAGMA table_info`):
    - `includes_professor INTEGER NOT NULL DEFAULT 0`
    - `client_updated_at TEXT`
    - `weather TEXT`
    - `notes TEXT`
  After the ALTER statements, the migration MUST run a one-shot `UPDATE lessons_data SET client_updated_at = created_at WHERE client_updated_at IS NULL` backfill so every pre-existing row has a valid timestamp.
- **FR-016**: `lessonService.updateLesson()` MUST set `client_updated_at = new Date().toISOString()` on every call, regardless of which fields the caller is updating. `lessonService.createLesson()` MUST initialize `client_updated_at` to the same value it uses for `created_at`. Precision is ISO 8601 milliseconds; same-millisecond collisions between rapid sequential calls are accepted (server-side "last-write-wins" uses `>=`, not strict equality), and no extra monotonicity logic is layered on top.
- **FR-017**: Both `lessonService.createLesson()` AND `lessonService.updateLesson()` MUST enforce the XOR invariant on the catalog-vs-fallback field pairs. The invariant is applied defensively in the service layer (not by throwing — by clearing the losing side) so that the row on disk is always consistent regardless of how the UI caller batched the update.

    Concrete rules applied on every write:
    - If `professor_id` is being set to a non-null value → force `professor_name = ''` in the same statement.
    - If `professor_name` is being set to a non-empty value → force `professor_id = null`.
    - If `lesson_topic_id` is being set to a non-null value → force `lesson_title = ''` AND `series_name = ''` (series is resolved via JOIN at export time, so the legacy field becomes dead weight).
    - If `lesson_topic_id` is being set to null AND `lesson_title` or `series_name` is being set to a non-empty value → force `lesson_topic_id = null` (already the caller's intent, but asserted defensively).

    Rationale: US3 Acceptance Scenario 2 describes switching a lesson from a catalog professor to a free-text professor, which goes through `updateLesson`. Without XOR enforcement on the update path, a row could end up with both `professor_id` and `professor_name` populated and the export layer would emit an inconsistent payload.

**Device identity**

- **FR-015**: `device_id` generation lives in a dedicated helper (`deviceIdService`) that reads `@eb-insights/device-id` from AsyncStorage. If the key is missing, it generates a UUID v4 via `uuid.v4()` (the `react-native-get-random-values` polyfill is already imported at the top of the existing services), writes it, and returns it. The helper is idempotent and cached in memory for subsequent calls within the same session.

**Export lifecycle**

- **FR-018**: After a successful export, lessons MUST remain in status `COMPLETED`. The v1 behavior of promoting them to `EXPORTED` is removed in this release: `exportService` no longer calls `lessonService.markLessonsAsExported()`. The `EXPORTED` enum value stays in the schema and the TypeScript `LessonStatus` union for backwards compatibility with any existing rows, but no code writes it. Removal of the enum value is deferred to spec 008, which will replace `status` with a dedicated `sync_status` column.

**UI (minimal)**

- **FR-019**: The Lesson Detail screen MUST expose a toggle labeled "Contei o professor nestas contagens" immediately below the attendance counters. The initial state of the toggle is read from the `useIncludesProfessorDefault` hook (backed by AsyncStorage key `@eb-insights/include-professor-default`). Changing the toggle persists through the existing debounced autosave pattern.
- **FR-020**: The Lesson Detail screen MUST expose two new text inputs in a new "Observações" card below the Attendance card:
    - `weather` — short single-line input, placeholder `"Ex: Ensolarado 28°C"`.
    - `notes` — multi-line input, placeholder `"Observações livres sobre a aula"`.
  Both fields are nullable; empty input is stored as `null`, not `""`.
- **FR-021**: The Settings screen MUST expose a new "Padrões" section with a toggle "Incluir professor nas contagens por padrão". The toggle persists its state via `useIncludesProfessorDefault` and is read by `createLesson` to initialize new lessons' `includes_professor` field.

### Payload schema (reference)

```jsonc
{
  "schema_version": "2.0",
  "client": {
    "app_version": "1.x.y",          // Constants.expoConfig?.version ?? 'unknown' (expo-constants)
    "device_id": "<uuid>"             // stable per installation (AsyncStorage @eb-insights/device-id)
  },
  "collector": null,                  // always null in 005; 006 populates
  "exported_at": "2026-04-11T13:22:10.000Z",
  "collections": [
    {
      "id": "<lessons_data.id>",      // reused directly; stable across re-exports
      "client_created_at": "2026-04-11T13:05:00.000Z",
      "client_updated_at": "2026-04-11T13:18:42.000Z",
      "status": "COMPLETED",
      "lesson_instance": {
        "date": "2026-04-11",
        "series_id": "<uuid|null>",
        "series_code_fallback": "Eb356" | null,
        "topic_id": "<uuid|null>",
        "topic_title_fallback": "A Graça" | null,
        "professor_id": "<uuid|null>",
        "professor_name_fallback": "Jefferson Pedro" | null
      },
      "times": {
        "expected_start": "10:00",
        "expected_end":   "11:00",
        "real_start":     "10:07" | null,
        "real_end":       "11:03" | null
      },
      "attendance": {
        "start": 22,
        "mid":   28,
        "end":   25,
        "includes_professor": false
      },
      "unique_participants": 31,
      "weather": "Ensolarado 28°C" | null,
      "notes":   "Trocou de professor às 10:15" | null
    }
  ]
}
```

### Key Entities *(include if feature involves data)*

- **ExportBatch**: Envelope for a single export operation. Fields: `schema_version`, `client`, `collector`, `exported_at`, `collections[]`.
- **ClientInfo**: Stable metadata about the installation. Fields: `app_version`, `device_id`.
- **CollectorInfo**: Always `null` in 005. Reserved for 006 to populate as `{ user_id, display_name }`.
- **CollectionSubmission**: A single reading of a lesson by a collector. Fields: `id`, `client_created_at`, `client_updated_at`, `status`, `lesson_instance`, `times`, `attendance`, `unique_participants`, `weather`, `notes`.
- **LessonInstanceRef**: Identifies the canonical lesson event this reading belongs to. Fields: `date`, `series_id` + `series_code_fallback`, `topic_id` + `topic_title_fallback`, `professor_id` + `professor_name_fallback`. Exactly one of each `*_id`/`*_fallback` pair is non-null.
- **AttendanceReading**: Fields: `start`, `mid`, `end`, `includes_professor`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-002**: **Feature Parity with v1**: Every field present in the v1 export is representable (with equal or richer semantics) in v2. Verified by a unit test that takes a v1-shape lesson fixture and maps it into v2 without information loss.
- **SC-003**: **Anonymous Export Still Works**: An installation with no login can export a JSON file via share sheet without any error, 100% of the time. Verified by running the baseline spec 001 acceptance flow against the 005 code.
- **SC-004**: **Coordinator Readability**: A coordinator opening a v2 export file in a text editor can identify, within 30 seconds, (a) when it was exported, (b) how many lessons it contains, (c) whether each lesson counted the professor in its attendance, and (d) any free-text observations. Verified by showing a generated file to a non-developer and asking them to answer the four questions.
- **SC-006**: **Stable IDs on Re-export**: Re-exporting the same completed lesson twice in a row produces two files with the same `collections[0].id`, same `client_created_at`, and same `client_updated_at`. Verified by a unit test that calls `exportService.exportData()` twice and diffs the two payloads.
- **SC-007**: **Migration Safety**: Running the 005 migration on a database populated by specs 001–004 produces zero row loss and zero null `client_updated_at` values. Verified by a service-level test that seeds the old schema, runs the migration, and asserts row count + timestamp invariants.

## Assumptions

- The client device has a working clock (same assumption as spec 001). ISO timestamps are trustworthy within ±5 minutes.
- The `lesson_series` / `lesson_topics` / `professors` tables are authoritative for the catalog — the export layer resolves IDs to code/title/name at read time via LEFT JOIN (reusing the existing `getAllLessonsWithDetails` pattern).
- UUID v4 generation is available via `react-native-get-random-values` + `uuid` (already installed and used by `lessonService`/`professorService`).
- `@react-native-async-storage/async-storage` is available (already installed and used by `useThemePreference`).
- `expo-file-system` and `expo-sharing` are available (already used by the v1 `exportService`).
- The current app bundles `package.json` with a `version` field that `expo-constants` or a direct JSON import can read for `client.app_version`.

## Decided Questions

- **Delivery order vs. 006**: 005 ships standalone. `collector` is hard-coded to `null`. 006 will flip the field to a real object without touching the schema version.
- **UI for `includes_professor` toggle**: in scope for 005. A toggle lives on Lesson Detail and a default preference lives in Settings.
- **UI for `weather` and `notes`**: in scope for 005 as minimal free-text fields. Automated weather ingestion via a weather API is deferred to a future spec and will not require a schema change.

## Related Specs

- **006-auth-identity** — will populate `collector.user_id` / `collector.display_name` once login lands.
- **007-sync-backend** — will consume this payload format at `POST /sync/batch` and own server-side idempotency, dedup, and partial-success responses.
- **008-offline-sync-client** — will use this format for HTTP send, introduce `sync_status` to replace the legacy `EXPORTED` enum, and handle batch splitting for oversized uploads.
