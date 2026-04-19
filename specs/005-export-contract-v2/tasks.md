---
description: "Task list for feature 005-export-contract-v2 implementation"
---

# Tasks: Export Data Contract v2

**Input**: Design documents from `/specs/005-export-contract-v2/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/export-envelope.v2.schema.json](./contracts/export-envelope.v2.schema.json), [quickstart.md](./quickstart.md)

**Tests**: INCLUDED. Unit tests are explicitly requested by Success Criteria SC-002 (v1→v2 feature parity), SC-006 (stable IDs on re-export), and SC-007 (migration safety).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. US1 (P1) is the MVP that delivers the core v2 envelope; US2/US4 (P1) layer re-exportability and attendance UI on top; US3/US5 (P2) add professor override semantics and observations fields.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Path Conventions

This is a single-project Expo Router 6 mobile app. Source under `src/`, screens under `app/`, tests under `tests/unit/`. Spec artifacts under `specs/005-export-contract-v2/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm working environment before touching code.

- [X] T001 Confirm working branch is `005-export-contract-v2` (via `git branch --show-current`) and run baseline `npm run lint`, `npm test`, and `npx tsc --noEmit` — all three must exit 0 before any further work. **Outcome**: branch OK; `npm run lint` script does not exist (CLAUDE.md stale — out of scope to fix here); `npx tsc --noEmit` passes; `npm test` reports 66/66 tests passing but 1 suite (`DatePickerInput.test.tsx`) fails at module load because `@react-native-async-storage/async-storage` is not globally mocked — pre-existing baseline flaw, will be fixed as part of Phase 2 setup since new 005 tests need the mock anyway.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema migration, shared types, write-path invariants, dev fixture extension, and the two new helper modules that EVERY user story depends on. No user story can begin until this phase is complete.

**⚠️ CRITICAL**: No Phase 3+ work can start until Phase 2 is done — the data-layer and service-layer primitives must exist first.

- [X] T002 [P] Extend the `Lesson` interface in `src/types/lesson.ts` to add the 4 new fields: `client_updated_at: string | null`, `includes_professor: boolean`, `weather: string | null`, `notes: string | null`. Also extend `LessonWithDetails` with `resolved_series_id: string | null` for the JOIN-derived series UUID used by the export layer.
- [X] T003 [P] Extend `CREATE_LESSONS_TABLE` in `src/db/schema.ts` with the 4 new columns (`includes_professor INTEGER NOT NULL DEFAULT 0`, `client_updated_at TEXT`, `weather TEXT`, `notes TEXT`) so that fresh installs ship with the final shape.
- [X] T004 Add an idempotent migration block in `src/db/client.ts` following the existing `PRAGMA table_info` pattern used for `professor_id` and `lesson_topic_id`: guard each `ALTER TABLE lessons_data ADD COLUMN ...` with a `tableInfo.some(col => col.name === '...')` check, then run a one-shot `UPDATE lessons_data SET client_updated_at = created_at WHERE client_updated_at IS NULL` backfill. Depends on T002/T003 for type/schema alignment.
- [X] T005 [P] Create `src/services/deviceIdService.ts` — exports `async function getDeviceId(): Promise<string>` that reads AsyncStorage key `@eb-insights/device-id`, generates a UUID v4 via `uuid.v4()` (with the existing `react-native-get-random-values` polyfill) on first miss, writes it back, and caches the result in module-level state for subsequent calls in the same session. Reference pattern: `src/services/lessonService.ts` for `uuid` usage, `src/hooks/useThemePreference.ts` for AsyncStorage conventions.
- [X] T006 [P] Create `src/hooks/useIncludesProfessorDefault.ts` — mirrors the structure of `src/hooks/useThemePreference.ts`. AsyncStorage key: `@eb-insights/include-professor-default`. Default value when absent: `false`. Exports both a React hook for UI consumption AND a plain async getter (`getIncludesProfessorDefault(): Promise<boolean>`) for `lessonService.createLesson()` to call without React context.
- [X] T007 Update `lessonService.createLesson()` in `src/services/lessonService.ts` to: (a) enforce XOR by clearing `professor_name` when `professor_id` is non-null, clearing `lesson_title` and `series_name` when `lesson_topic_id` is non-null; (b) initialize `client_updated_at` to the same ISO string used for `created_at` (use an explicit `const now = new Date().toISOString()` passed to both `created_at` and `client_updated_at` in the INSERT, overriding the SQLite `DEFAULT CURRENT_TIMESTAMP`); (c) when `partialLesson.includes_professor` is undefined, call `getIncludesProfessorDefault()` from T006 and use the result. Depends on T005-not-needed, T006, T002.
- [X] T008 Update `lessonService.updateLesson()` in `src/services/lessonService.ts` to: (a) always set `client_updated_at = new Date().toISOString()` on every call, regardless of which fields the caller passes in `updates` — the touch MUST happen even if `updates` is empty; (b) enforce the XOR invariant per FR-017 on every update — before building the SET clause, if `updates.professor_id` is non-null inject `updates.professor_name = ''`; if `updates.professor_name` is non-empty inject `updates.professor_id = null`; mirror the same logic for `lesson_topic_id`/`lesson_title` and `lesson_topic_id`/`series_name`. Same-file dependency on T007 — do in sequence, not parallel.
- [X] T009 Update `lessonService.getAllLessonsWithDetails()` in `src/services/lessonService.ts` to add `lt.series_id AS resolved_series_id` to the SELECT alongside the existing JOIN aliases. Same-file dependency on T008 — sequential.
- [X] T010 Extend `seedService.seed()` in `src/services/seedService.ts` to: (a) update the `SeedCollection` TypeScript interface and `assertSeedPayload` guard to include `weather: string | null` if present (tolerate missing), (b) extend the `INSERT OR IGNORE INTO lessons_data` statement to write `includes_professor` from `c.attendance.includes_professor` and `notes` from `c.notes`, (c) respect the XOR invariant by leaving `professor_name` empty when `professor_id` is present (currently the seed writes both, violating FR-017). `weather` stays NULL because seed JSON does not yet carry that field.
- [X] T011 [P] Create `tests/unit/lessonService.test.ts` covering: (a) `createLesson` clears `professor_name` when `professor_id` is given, (b) `createLesson` clears `lesson_title`/`series_name` when `lesson_topic_id` is given, (c) `createLesson` reads the default `includes_professor` from `useIncludesProfessorDefault` getter when caller does not specify, (d) `updateLesson` always updates `client_updated_at` even when the caller passes unrelated fields or an empty update, (e) `getAllLessonsWithDetails` exposes `resolved_series_id`, (f) `updateLesson` clears `professor_name` when `updates.professor_id` is non-null (FR-017 write-path symmetry with createLesson), (g) `updateLesson` clears `professor_id` when `updates.professor_name` is non-empty, (h) the same clearing behavior for `lesson_topic_id`/`lesson_title`/`series_name`. Mock `expo-sqlite` following the existing pattern in `tests/unit/seedService.test.ts`. Mock `@react-native-async-storage/async-storage` for the default-preference read.
- [X] T011a [P] Create `tests/unit/dbMigration.test.ts` covering SC-007 (migration safety). Using the existing `expo-sqlite` mock pattern from `tests/unit/seedService.test.ts`: (a) set up an in-memory SQLite representing the pre-005 schema — execute the old `CREATE_LESSONS_TABLE` DDL without the four new columns; (b) INSERT fixture rows simulating specs 001–004 data (at least one IN_PROGRESS, one COMPLETED, one EXPORTED, one SYNCED row, each with distinct `created_at` values); (c) invoke the migration function from `src/db/client.ts` against the populated DB; (d) assert post-migration invariants — total row count is unchanged, every row's `client_updated_at` equals its `created_at` (backfill), every row's `includes_professor === 0` (default), every row's `weather === null` and `notes === null`, every pre-existing `status` value is preserved verbatim (especially EXPORTED rows stay EXPORTED, not silently downgraded). This may require exposing the migration step(s) from `src/db/client.ts` as a standalone exported function if they are currently inlined inside `getDatabase()` — if so, refactor the client to expose `async function applyMigrations(db: SQLiteDatabase)` as a named export while keeping `getDatabase()` as the production entry point.

**Checkpoint**: Foundation ready — schema migrated, types extended, lessonService enforces XOR and timestamps, seedService preserves signal, helpers exist. User stories can now begin in parallel (if staffed).

---

## Phase 3: User Story 1 — Anonymous Local Export (Priority: P1) 🎯 MVP

**Goal**: Ship the core v2 export envelope. Tapping "Exportar Dados (JSON)" on the `/sync` tab produces a JSON file with `schema_version: "2.0"`, `client { app_version, device_id }`, `collector: null`, `exported_at`, and a `collections[]` array where every field from [data-model.md](./data-model.md) is populated. The share sheet opens as today.

**Independent Test**: Seed the DB via `__DEV__` → "Carregar dados de exemplo" → Sync tab → tap "Exportar Dados (JSON)" → save the file → open it in a text editor → assert the envelope matches [contracts/export-envelope.v2.schema.json](./contracts/export-envelope.v2.schema.json). Concretely: `schema_version === "2.0"`, `collector === null`, `client.device_id` is a UUID v4, `client.app_version` is non-empty, every `collections[].id` is a UUID v4, every `client_created_at`/`client_updated_at` is valid ISO 8601. Corresponds to [quickstart.md §1](./quickstart.md).

### Implementation for User Story 1

- [X] T012 [US1] Rewrite `src/services/exportService.ts` to produce the v2 envelope. Replace the body of `exportData()`: (1) call `lessonService.getAllLessonsWithDetails()` and filter in-memory by `status === 'COMPLETED'`; (2) if the filtered array is empty, throw an error matching the existing pt-BR message so the empty guard stays (FR-008); (3) build `ClientInfo` with `app_version: Constants.expoConfig?.version ?? 'unknown'` (import `Constants` from `expo-constants`) and `device_id: await getDeviceId()` (import from T005); (4) build each `CollectionSubmission` mapping the LessonWithDetails row into `LessonInstanceRef` with XOR fallbacks (see T013 for the XOR details), `TimesBlock`, `AttendanceBlock` (including `includes_professor`), `weather`, `notes`, and coerce empty strings to `null`; (5) set `exported_at` to `new Date().toISOString()`; (6) serialize with `JSON.stringify(envelope, null, 2)`, write to cache via `expo-file-system`, open share sheet via `expo-sharing`; (7) **DO NOT** call `lessonService.markLessonsAsExported()` — leave the method in place but stop calling it from here (US2 will handle the follow-up cleanup). Define the internal types (`ExportEnvelopeV2`, `CollectionSubmission`, `LessonInstanceRef`, `TimesBlock`, `AttendanceBlock`, `ClientInfo`) inline at the top of the file, NOT in `src/types/`.
- [X] T013 [US1] Inside the `exportService.exportData()` mapping function from T012, implement the XOR resolution for `lesson_instance`: if `row.lesson_topic_id` is non-null, emit `topic_id = row.lesson_topic_id`, `topic_title_fallback = null`, `series_id = row.resolved_series_id`, `series_code_fallback = null`; otherwise emit `topic_id = null`, `topic_title_fallback = row.lesson_title || null`, `series_id = null`, `series_code_fallback = row.series_name || null`. For professor: if `row.professor_id` is non-null, emit `professor_id = row.professor_id`, `professor_name_fallback = null`; otherwise emit `professor_id = null`, `professor_name_fallback = row.professor_name || null`. Empty-string coercion to `null` is mandatory. Same-file dependency on T012 — sequential.
- [X] T014 [P] [US1] Create `tests/unit/exportService.test.ts` covering: (a) envelope shape — `schema_version === "2.0"`, `collector === null`, `client` present with `app_version` + `device_id`; (b) empty guard — calling with zero completed lessons throws the expected error; (c) stable re-export — calling `exportData()` twice against the same mocked DB returns two envelopes whose `collections[].id`, `client_created_at`, and `client_updated_at` match entry-for-entry (SC-006); (d) `device_id` persistence — first call writes to AsyncStorage mock, second call reads from the cache; (e) v1→v2 parity — a fixture in the old v1 shape maps into v2 without losing any field (SC-002). Mock `lessonService.getAllLessonsWithDetails`, `expo-constants.Constants`, `expo-file-system`, `expo-sharing`, `@react-native-async-storage/async-storage`.

**Checkpoint**: US1 complete — the MVP envelope is produced end-to-end. Re-running the seed and exporting produces a valid v2 file. Stop here and run [quickstart.md §1 and §3](./quickstart.md) to validate before moving on.

---

## Phase 4: User Story 2 — Re-exportable Completed Lessons (Priority: P1)

**Goal**: Completed lessons stay available for export on every subsequent tap. The UI no longer claims "status atualizado para EXPORTED" because that transition is gone. Re-exporting the same lesson yields the same `collections[].id`.

**Independent Test**: After the US1 export, tap "Exportar Dados (JSON)" a second time without touching anything. Both files save successfully; both contain the lesson; both share the same `collections[].id`. The lesson does NOT disappear from the "Aulas finalizadas" counter between exports. Corresponds to [quickstart.md §3](./quickstart.md).

### Implementation for User Story 2

- [X] T015 [US2] Update the success alert in `app/(tabs)/sync.tsx` (around line 49 — the `"${completedCount} aula(s) exportada(s) com sucesso! O status foi atualizado para EXPORTED."` string) to remove the "O status foi atualizado para EXPORTED" clause. New message: `"${completedCount} aula(s) exportada(s) com sucesso!"` (or similar pt-BR). Also remove any subsequent `loadStats()` call that was specifically there to refresh the counter after the status mutation, if it exists.
- [X] T016 [US2] Mark `lessonService.markLessonsAsExported()` in `src/services/lessonService.ts` as deprecated: add a JSDoc block `@deprecated since spec 005 — lessons stay COMPLETED after export. Method kept for schema backwards compatibility and may be removed in spec 008.` Do NOT delete the method — existing callers outside 005 (if any) would break, and the method is harmless when not called.

**Checkpoint**: US2 complete — re-exportability stable, UI message consistent with the new lifecycle. The SC-006 unit test from T014 continues to pass.

---

## Phase 5: User Story 4 — Attendance Semantics Clarification (Priority: P1)

**Goal**: The Lesson Detail screen exposes a "Contei o professor nestas contagens" toggle immediately below the attendance counters. Settings exposes a "Padrões" section where the collector can set the default for new lessons. The value round-trips from UI → SQLite → exported `attendance.includes_professor`.

**Independent Test**: In Settings, toggle "Incluir professor nas contagens por padrão" ON. Create a new lesson via "+ Nova Aula". Open the new lesson — the per-lesson toggle is already ON. Toggle it OFF. Wait 1s for debounced save. Export. Verify the payload `attendance.includes_professor === false` for that lesson. Repeat with default OFF, verify the new lesson starts with the toggle OFF. Corresponds to [quickstart.md §7](./quickstart.md) and partially §1.

### Implementation for User Story 4

- [X] T017 [US4] In `app/lesson/[id].tsx`, inside the "Frequência (Attendance)" card (around line 336-397), add a React Native `Switch` component immediately after the `unique_participants` CounterStepper (around line 396, before the card closes). Label: `"Contei o professor nestas contagens"`. Wire the Switch `value` to `lesson.includes_professor` and `onValueChange` to `updateField('includes_professor', value)` so it flows through the existing `useDebounce(lesson, 500)` autosave pipeline. Respect the theme (label uses `theme.typography.body` and `theme.colors.text`; Switch uses `theme.colors.primary` for `trackColor.true`).
- [X] T018 [US4] In `app/settings.tsx`, add a new "Padrões" section between the existing "Aparência" section (ends ~line 137) and the `__DEV__` block (starts ~line 139). The section contains a single row with label `"Incluir professor nas contagens por padrão"` and a `Switch`. Wire via `useIncludesProfessorDefault()` from T006 — reading the current value and writing new values through the hook's setter. Follow the visual pattern of the existing theme preference row.

**Checkpoint**: US4 complete — the toggle and the default preference work end-to-end. The round-trip test from T011 (foundational) can be extended with a manual Settings-to-Lesson-Detail walkthrough if desired.

---

## Phase 6: User Story 3 — Topic and Professor Override at Collection Time (Priority: P2)

**Goal**: When a lesson uses a catalog-selected professor/topic, the payload emits `*_id` and `*_fallback: null`. When the underlying row uses a free-text name (legacy data or a future UI path), the payload emits `*_id: null` and the fallback string. The XOR invariant is enforced at the write-path in T007 and respected by T013; US3 adds the explicit verification layer.

**Independent Test**: Load the seed → verify an exported lesson has `professor_id !== null` and `professor_name_fallback === null`. Then, via a direct SQLite write OR a unit test, craft a row with `professor_id = null` and `professor_name = 'Jefferson Pedro'` and verify the payload emits `professor_id: null` and `professor_name_fallback: "Jefferson Pedro"`. The current UI does not yet expose a free-text override path for professor/topic — that is deferred to a future spec; [quickstart.md §2](./quickstart.md) step 16 documents the escape hatch.

### Implementation for User Story 3

- [X] T019 [US3] Extend `tests/unit/exportService.test.ts` (created in T014) with three new test cases: (a) given a mock lesson with `professor_id='<uuid>'` and `professor_name=''`, the emitted `professor_id` is the UUID and `professor_name_fallback` is `null`; (b) given a mock lesson with `professor_id=null` and `professor_name='Jefferson Pedro'`, the emitted `professor_id` is `null` and `professor_name_fallback === 'Jefferson Pedro'`; (c) given a mock lesson with `lesson_topic_id=null`, `lesson_title='A Graça'`, `series_name='Eb356'`, the emitted `topic_id`/`series_id` are `null` and `topic_title_fallback`/`series_code_fallback` carry the free-text values. Same file as T014 — sequential, not parallel.
- [X] T020 [US3] Extend `tests/unit/lessonService.test.ts` (created in T011) with one additional test case: given `createLesson({ professor_id: 'abc', professor_name: 'Should Be Cleared' })`, after the INSERT the persisted `professor_name` column is the empty string and `professor_id` is `'abc'`. Same file as T011 — sequential.

**Checkpoint**: US3 complete — XOR emission verified at the unit-test level. Manual UI verification is limited by the current ProfessorPicker (catalog-only); free-text UI is out of scope.

---

## Phase 7: User Story 5 — Observations Field (weather + notes) (Priority: P2)

**Goal**: Lesson Detail exposes a "Observações" card with a short single-line `Clima` text input and a multiline `Observações` text input. Both are nullable (empty → `null` in the payload). The exportService (from T012) already emits these fields from the DB row, so this story is UI-only.

**Independent Test**: Open any lesson, type `"Ensolarado 28°C"` in Clima and `"Teste quickstart 005"` in Observações, wait 1s for autosave, export, verify the payload has `weather === "Ensolarado 28°C"` and `notes === "Teste quickstart 005"`. Leave both empty on another lesson and verify `weather === null`, `notes === null`. Corresponds to [quickstart.md §1](./quickstart.md) checkbox steps for weather/notes.

### Implementation for User Story 5

- [X] T021 [US5] In `app/lesson/[id].tsx`, add a new "Observações" card immediately after the "Frequência" card closes (around line 397, before the action buttons at ~line 399). The card contains two fields: (a) `TextInput` single-line labeled `"Clima"` with placeholder `"Ex: Ensolarado 28°C"`, bound to `lesson.weather ?? ''` and wired via `updateField('weather', text || null)` (empty string → `null`); (b) `TextInput multiline` labeled `"Observações"` with placeholder `"Observações livres sobre a aula"`, bound to `lesson.notes ?? ''` and wired via `updateField('notes', text || null)`. Style using the same card pattern already used by the "Frequência" card (theme tokens for padding, border radius, colors). Both inputs flow through the existing `useDebounce(lesson, 500)` autosave pipeline. Respect the read-only state when `lesson.status !== LessonStatus.IN_PROGRESS` (same guard already in place at around line 251 — reuse it).
- [X] T022 [US5] Extend `tests/unit/exportService.test.ts` with a test case: given a mock lesson with `weather = 'Ensolarado 28°C'` and `notes = 'Trocou de professor'`, the emitted payload has the values verbatim. Given a mock lesson with both fields as empty strings, the payload has both as `null` (empty-string → `null` coercion). Same file as T014/T019 — sequential.

**Checkpoint**: US5 complete — all three new fields are captured, persisted, and exported end-to-end.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup before PR.

- [X] T023 Run the full [quickstart.md](./quickstart.md) manual validation end-to-end (CLOSED 2026-04-19 by Playwright spec `tests/e2e/export-v2-payload.spec.ts`: seeds a completed lesson, calls `exportService.__buildEnvelopeForTest` via the `window.__e2e` harness, and asserts every v2 contract field — schema_version 2.0, client.app_version, client.device_id (UUID), exported_at (ISO), collector (both authenticated and null cases), collections XOR between catalog id and fallback, includes_professor boolean, and the Portuguese empty-guard message. Unit tests in `tests/unit/exportService.test.ts` continue to cover the raw contract shape. The OS share-sheet leg (`expo-sharing`) remains a native-only manual step — crashes on web per CLAUDE.md §12.)
- [X] T024 [P] Run `npm run lint` — zero new warnings introduced. **Update 2026-04-19**: the `lint` script was added in the 008 polish pass (eslint + eslint-config-expo flat config). Reran — 0 errors across the spec 005 surface.
- [X] T025 [P] Run `npm test` — all tests (existing + new) pass.
- [X] T026 [P] Run `npx tsc --noEmit` — zero TypeScript errors in strict mode.
- [X] T027 Delete `bash.exe.stackdump` from the repo root if present (unrelated artifact from a prior shell crash) and verify `.gitignore` covers it for the future.
- [X] T028 Update the `LessonStatus` enum comment in `src/types/lesson.ts` to note that `EXPORTED` is a legacy value preserved for backwards compatibility but no longer written by the application code as of spec 005 (pointer to spec 008 for eventual removal).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Story 1 (Phase 3, MVP)**: Depends on Foundational (needs `deviceIdService`, extended types, extended `getAllLessonsWithDetails`).
- **User Story 2 (Phase 4)**: Depends on User Story 1 (the exportService rewrite must exist before the "remove EXPORTED mention" cleanup makes sense).
- **User Story 4 (Phase 5)**: Depends on Foundational only. Can run in parallel with US1/US2 (different files: `app/lesson/[id].tsx`, `app/settings.tsx` vs `src/services/exportService.ts`).
- **User Story 3 (Phase 6)**: Depends on User Story 1 (the test cases extend `tests/unit/exportService.test.ts` created in T014).
- **User Story 5 (Phase 7)**: Depends on User Story 1 (the test case extends the same test file; the UI change is independent but the verification is not).
- **Polish (Phase 8)**: Depends on all desired user stories being complete.

### Within Each User Story

- Services modified in foundational (T007–T009) are sequential within `lessonService.ts` — same-file lock.
- Tests in T011, T014, T019, T020, T022 all extend two test files (`lessonService.test.ts` and `exportService.test.ts`); the [P] marker only applies to the INITIAL creation (T011, T014), not the extensions.
- `app/lesson/[id].tsx` is touched by T017 (US4) and T021 (US5) — sequential, not parallel, same-file lock.

### Parallel Opportunities

- **Foundational parallel set**: T002, T003, T005, T006 can all run in parallel (different files, no cross-deps).
- **Foundational sequential chain**: T007 → T008 → T009 (all in `lessonService.ts`) → T010 (different file, can parallelize with T011 test creation).
- **US1/US4 parallel**: Once Foundational is done, a team of two could take US1 (T012-T014, all in `exportService.ts` + `exportService.test.ts`) and US4 (T017-T018, in `app/lesson/[id].tsx` + `app/settings.tsx`) at the same time.
- **Polish parallel**: T024, T025, T026 are three independent lint/test/typecheck commands and run in parallel.

---

## Parallel Example: Foundational

```bash
# Terminal A — types and schema (no cross-deps):
Task: "T002 Extend Lesson interface in src/types/lesson.ts"
Task: "T003 Extend CREATE_LESSONS_TABLE in src/db/schema.ts"

# Terminal B — new helper files (no cross-deps):
Task: "T005 Create src/services/deviceIdService.ts"
Task: "T006 Create src/hooks/useIncludesProfessorDefault.ts"

# Sequentially after the above (same file: lessonService.ts):
Task: "T007 createLesson XOR enforcement + includes_professor default read"
Task: "T008 updateLesson client_updated_at touch"
Task: "T009 getAllLessonsWithDetails resolved_series_id"

# In parallel with T007-T009 (different file: seedService.ts):
Task: "T010 seedService extension for includes_professor + notes + XOR"

# After T007-T009 exist (test file depends on them):
Task: "T011 Create tests/unit/lessonService.test.ts"
```

## Parallel Example: User Story 1 and User Story 4

```bash
# Developer A (Story US1):
Task: "T012 Rewrite exportService.ts v2 envelope"
Task: "T013 exportService XOR emission inside T012"
Task: "T014 Create tests/unit/exportService.test.ts"

# Developer B (Story US4, in parallel — different files):
Task: "T017 Add includes_professor Switch to app/lesson/[id].tsx"
Task: "T018 Add Padrões section to app/settings.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete **Phase 1 (T001)** — baseline verification.
2. Complete **Phase 2 (T002–T011)** — foundational schema, types, services, helpers, seed extension, foundational tests.
3. Complete **Phase 3 (T012–T014)** — the v2 envelope.
4. **STOP and VALIDATE**: Run [quickstart.md §1 and §5](./quickstart.md) (smoke test + empty guard). If both pass, the MVP is shippable — pre-existing users can export in v2 format, even though the new UI fields are not yet visible.
5. Commit and demo. Decide whether to continue the same PR or merge the MVP first.

### Incremental Delivery

1. **Foundation + US1** → MVP merged. The v2 envelope is live even though users don't yet have a way to set `includes_professor` / `weather` / `notes` (they stay at their migration defaults).
2. **+ US2** → re-exportability cleanup. Small PR, safe.
3. **+ US4** → attendance semantics UI. Users can now set the `includes_professor` toggle.
4. **+ US5** → weather + notes UI. Users can now capture all three new fields.
5. **+ US3** → XOR unit test coverage for the payload emission layer. No user-visible change, just test safety.
6. **Polish (Phase 8)** → final lint/test/typecheck sweep and PR.

### Single-PR Strategy (recommended for 005)

Given the small overall scope and the tight coupling between the user stories (they all touch the same handful of files), a single commit-per-task PR is cleanest. The phase boundaries still serve as natural review checkpoints.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] label maps each task to its user story for traceability.
- Each user story above is independently **testable** even though it is not independently **deployable** — the MVP (US1) is the smallest unit that adds user-visible value.
- Verify tests pass after each task in a [Story] phase; foundational tests (T011) must pass before any US phase begins.
- Commit after each task or logical group; the `git log` becomes the final audit trail for what went into the PR.
- Do NOT skip the quickstart validation (T023) before opening the PR — the unit tests cover contract shape but not end-to-end user flow.
- Avoid: touching `expo-application`, `expo-device`, or any new runtime dependency. Everything needed is already in `package.json`.
