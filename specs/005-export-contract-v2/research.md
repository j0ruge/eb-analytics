# Research — Export Data Contract v2

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-04-11

## Context

This document consolidates the design decisions taken before implementation. It is the output of Phase 0 of `/speckit.plan`. Every `NEEDS CLARIFICATION` marker from Technical Context was resolved during `/speckit.clarify` (see the Clarifications section of `spec.md`); this file captures the reasoning, alternatives considered, and the trade-off each decision accepts.

## Decisions

### D-01 — Source of truth for `series_id` in the payload

- **Decision**: Derive `lesson_instance.series_id` at export time via LEFT JOIN on `lesson_topics` → `lesson_series`, reusing the existing `lessonService.getAllLessonsWithDetails()` pattern. No new `series_id` column is added to `lessons_data`.
- **Rationale**:
  - `lessons_data` already carries `lesson_topic_id` (added in spec 003). The canonical series identity lives on `lesson_topics.series_id`, so any lesson with a catalog topic has a resolvable series without touching the data layer.
  - Adding a redundant `series_id` column would force `createLesson`/`updateLesson` to keep two fields in sync and would require a second backfill migration — net negative maintenance cost for zero gain.
  - The read-time JOIN is hot-path-cheap: the `/sync` export already loads every completed lesson into memory, and `lesson_topics` plus `lesson_series` together contain a handful of rows. Overhead is under 1 ms.
- **Alternatives considered**:
  - **B — Add `series_id` column to `lessons_data`**: rejected because it duplicates the FK chain and doubles the migration surface area for zero runtime benefit.
  - **C — Omit `series_id` from the payload entirely**: rejected because downstream specs 007/008 will rely on the UUID for referential integrity on the backend; emitting only `series_code_fallback` would force re-matching by string on every upload.
- **Trade-off accepted**: a future schema where `lesson_topic_id` becomes nullable for some reason would silently drop `series_id` to `null` on affected rows. EC-005 already documents this path ("free-text topic → `series_code_fallback` populated from legacy `lessons_data.series_name`").
- **Cross-references**: [spec.md Clarifications Q1](./spec.md#clarifications), FR-009, FR-009a, FR-017.

---

### D-02 — Source of `client.app_version`

- **Decision**: Read `Constants.expoConfig?.version ?? 'unknown'` from `expo-constants`.
- **Rationale**:
  - `expo-constants` is already transitively available through the Expo SDK 54 dependency graph (verified in `package.json`). Zero new dependencies to install.
  - The value reflects whatever is manually bumped in `app.json` at release time, which is the process the team already follows.
  - Works identically in Expo Go, dev builds, and standalone binaries, so dev and prod exports stay consistent.
- **Alternatives considered**:
  - **B — Static import of `package.json.version`**: simpler but the two version fields (`app.json` vs `package.json`) can drift, causing confusion when a coordinator reads the exported file.
  - **C — `expo-application.nativeApplicationVersion`**: returns the "true" binary version from the store, but requires installing `expo-application` as a new dependency and returns `null` in Expo Go, which would force dev exports to emit `'unknown'` or break.
  - **D — Hybrid helper combining (A) and (C)**: solves nothing the single-source (A) doesn't already solve, and adds a module to maintain.
- **Trade-off accepted**: if the developer forgets to bump `app.json` at release, the `app_version` in the payload stays stale. Mitigated by release hygiene, not by code.
- **Cross-references**: [spec.md Clarifications Q2](./spec.md#clarifications), FR-010a.

---

### D-03 — `seedService` extension for new columns

- **Decision**: Extend `seedService.seed()` in the same commit as the SQLite migration to read `c.attendance.includes_professor` and `c.notes` from `src/data/seed-collections.json` and persist them into the newly-added columns. `weather` stays `NULL` on seed-loaded rows because the seed JSON does not carry that field. Update the `SeedCollection` TypeScript interface and the `assertSeedPayload` type guard accordingly.
- **Rationale**:
  - The seed JSON already emits schema v2 and already carries `includes_professor` per collection — the signal exists in the data but today's `seedService` silently drops it.
  - `includes_professor` is exactly the datum that motivated this spec (documented in `.claude/rules/google-sheets-sync.md` as the systematic disagreement between collectors). Losing it in the seed defeats the purpose of having a dev-loadable realistic dataset.
  - The extension is cheap: five lines added to the `INSERT OR IGNORE` statement, plus two TypeScript interface fields.
- **Alternatives considered**:
  - **B — Leave `seedService` as-is**: rejected because testing the v2 export manually would always see `includes_professor: false` for every seed-loaded row, masking real-world behavior.
  - **C — Also add `weather` to the seed JSON manually**: rejected because the weather values would be invented, not observed, and would create false data integrity in tests. Future specs can add weather when the weather-API integration lands.
  - **D — Reflection-based mapping**: overkill; the column list is fixed and small.
- **Trade-off accepted**: the seed JSON and the seed loader are coupled — if a future migration adds yet another column, the loader must be extended again. Acceptable because migrations are rare in this project.
- **Cross-references**: [spec.md Clarifications Q3](./spec.md#clarifications), FR-014a.

---

### D-04 — `attendance.start/mid/end` numeric semantics

- **Decision**: Keep `INTEGER NOT NULL DEFAULT 0` for the three attendance columns and the matching `CounterStepper` UI. Document that the value `0` in the payload is ambiguous — it can mean either "counted, zero people present" or "did not count this window". Coordinators and spec 007 (server aggregation) must treat `0` as "uncertain" unless cross-referenced with `notes`.
- **Rationale**:
  - Cancelled classes never reach `COMPLETED` status in the first place (they stay `IN_PROGRESS` and get deleted or ignored), so the "counted zero real people" case is practically vanishingly rare — I can find zero instances of it in the 2026 Q1 collection data.
  - Promoting the columns to `INTEGER NULL` would force changing `CounterStepper` (used in four places) to handle a `number | undefined` state, plus every consumer of the `Lesson` type. That is scope creep for 005.
  - The constitution's Principle II (Zero-Friction UX) favors the existing `+`/`−` stepper over any new "clear" control.
- **Alternatives considered**:
  - **A — Make columns nullable, emit `null` when not counted**: the rigorous answer, but requires touching `CounterStepper` and every read site; rejected as out-of-scope.
  - **C — Add parallel boolean flags (`attendance_start_counted`, etc.)**: doubles the column count, introduces six new state bits; rejected.
  - **D — Single `attendance.counted_all: boolean`**: less granular than C but still requires UI coordination; rejected.
- **Trade-off accepted**: the payload can emit `0` for an uncounted window and the coordinator cannot distinguish it from a counted zero. EC-007 documents this explicitly and flags it as a future-spec concern.
- **Cross-references**: [spec.md Clarifications Q4](./spec.md#clarifications), EC-007.

---

### D-05 — `client_updated_at` precision and monotonicity

- **Decision**: Use `new Date().toISOString()` (ISO 8601, millisecond precision) for `client_updated_at`. Accept same-millisecond collisions as benign; no extra monotonicity logic is layered on top.
- **Rationale**:
  - Spec 007 will use `client_updated_at` as a "last-write-wins" key on the server, compared with `>=` rather than strict equality. Two writes in the same millisecond are semantically equivalent for the reconciler.
  - Spec 009 (dashboard) does not surface an "editado em" label anywhere, so the UI will never render two updates as simultaneous and confusing.
  - Adding monotonicity (auto-increment sequence, `performance.now()` offset, or 1 ms lock-bump) is gold-plating the MVP.
- **Alternatives considered**:
  - **B — Auto-increment `client_sequence` column**: rigorous, but forces a new column, a new write-path concern, and a new test surface for zero observable benefit.
  - **C — `performance.now()` nanoseconds**: not serializable as ISO 8601, would force a custom format.
  - **D — 1 ms lock bump on collision**: simple but is a hack that leaks an implementation detail into the timestamp value.
- **Trade-off accepted**: two rapid-sequence writes can produce identical `client_updated_at` values. No downstream consumer currently relies on strict ordering within 1 ms.
- **Cross-references**: [spec.md Clarifications Q5](./spec.md#clarifications), FR-016.

---

### D-06 — Lesson re-exportability (sunset of `EXPORTED` status writes)

- **Decision**: Stop calling `lessonService.markLessonsAsExported()` from `exportService`. Lessons remain in `COMPLETED` status after export and can be re-exported indefinitely. The `EXPORTED` enum value is preserved in the SQLite `CHECK` constraint and the TypeScript `LessonStatus` union for backwards compatibility with any pre-existing rows, but no code path writes it from 005 onward. Full removal of the enum is deferred to spec 008, which will introduce a dedicated `sync_status` column.
- **Rationale**:
  - Current v1 behavior burns data on first export: a lesson marked `EXPORTED` disappears from `getCompletedLessons()`, which filters on `status = COMPLETED` only. That was acceptable for offline-only but breaks the "failed WhatsApp upload, retry" flow that 005 User Story 2 documents.
  - Preserving the enum value avoids a CHECK-constraint-rewrite migration (SQLite requires a full table recreation to change a CHECK) for zero runtime gain; pre-existing `EXPORTED` rows are still legal.
- **Alternatives considered**:
  - **A — Remove `EXPORTED` from the enum and rewrite the CHECK constraint**: spec-level cleaner but requires a full table recreation migration just to delete one legal value; excessive for 005.
  - **C — Add a boolean `is_exported` column**: duplicates state that is already represented by the status enum and introduces a third "has been exported at least once" flag that nothing in 005 needs.
- **Trade-off accepted**: the `LessonStatus` enum retains a value that no code writes, which is mild deadweight until 008 cleans it up.
- **Cross-references**: FR-018, User Story 2.

---

### D-07 — XOR enforcement location (write-path vs export-path)

- **Decision**: Enforce the `*_id` ↔ `*_name` XOR invariant in `lessonService.createLesson()` and `lessonService.updateLesson()`. The export layer trusts the invariant and does not re-validate.
- **Rationale**:
  - Write-path enforcement catches violations at the earliest possible moment — the moment the user selects a catalog entry or types a free-text name — and makes the SQLite row itself the single source of truth for "which branch did the user take".
  - Validating at export time would require duplicating the same logic in two places (write and export) and leave a window where the SQLite row violates the invariant but is never visible until export.
  - The service layer already owns business-rule validation (see the constitution's Principle V), so this is a natural home.
- **Alternatives considered**:
  - **B — Validate at export time only**: rejected because the inconsistency can exist on disk between writes and exports, and because it duplicates logic.
  - **C — Use SQLite CHECK constraint**: rejected because CHECK on conditional column pairs requires `CHECK ((a IS NULL) <> (b IS NULL))` on every affected pair and is awkward to migrate; the service-layer check is simpler.
- **Trade-off accepted**: the invariant lives in TypeScript rather than in the schema. Any direct SQL that bypasses the service (e.g., future dev-tools) could violate it. Mitigated by having only one service touching the table.
- **Cross-references**: FR-009, FR-017.

---

### D-08 — `device_id` generation point and persistence

- **Decision**: Create a dedicated `src/services/deviceIdService.ts` helper that reads `@eb-insights/device-id` from AsyncStorage, lazily generates a UUID v4 via the existing `uuid.v4()` + `react-native-get-random-values` polyfill on first miss, writes it back, and caches the result in module-level state for subsequent calls within the same session. The helper is invoked by `exportService` on first export.
- **Rationale**:
  - Delaying generation to the first export (instead of the first app boot) keeps app startup paths clean and avoids writing storage for users who never export.
  - Module-level cache eliminates repeated AsyncStorage reads on every export.
  - Using the already-imported `uuid.v4()` keeps the dependency surface flat.
- **Alternatives considered**:
  - **B — Generate at app boot in `_layout.tsx`**: adds a startup side-effect and pollutes root layout code with a concern that is only relevant at export time.
  - **C — Use the device's hardware identifier from `expo-device`**: rejected because hardware IDs are privacy-sensitive and the point of `device_id` is installation-level correlation, not device fingerprinting.
- **Trade-off accepted**: if the user clears app data, the next export generates a fresh `device_id` and old exports retain the previous value. EC-006 documents this as expected behavior.
- **Cross-references**: FR-010, FR-015.

---

### D-09 — Default `includes_professor` preference: location and pattern

- **Decision**: Create a new hook `src/hooks/useIncludesProfessorDefault.ts` that mirrors the structure of the existing `src/hooks/useThemePreference.ts`. AsyncStorage key: `@eb-insights/include-professor-default`. Default value when the key is absent: `false`. Settings exposes a `Switch` that writes through the hook; `lessonService.createLesson()` reads the hook-exported async getter to seed new lessons.
- **Rationale**:
  - Following the `useThemePreference` pattern keeps the hook layer consistent and saves re-inventing a persistence shape.
  - Default `false` preserves the pre-spec behavior for collectors who never touch the setting (the field simply defaults to the legacy "excludes professor" interpretation).
  - Putting the read in `createLesson` (not in the UI component) means the preference is honored even for lessons created via any future code path, not only via the "Nova Aula" button.
- **Alternatives considered**:
  - **B — Store the preference inline in `AsyncStorage` without a dedicated hook**: works but breaks consistency with `useThemePreference` and would force every consumer to repeat the read logic.
  - **C — Store in a React context provider**: heavier and provides no benefit given a single read point.
- **Trade-off accepted**: `createLesson` becomes async-dependent on an AsyncStorage read (it already is async). Latency overhead is negligible (< 1 ms).
- **Cross-references**: FR-019, FR-021.

## Unknowns

None remain. All `NEEDS CLARIFICATION` items from the spec have been resolved, and no new questions emerged during plan drafting.

## References

- [spec.md](./spec.md) — feature specification
- [plan.md](./plan.md) — implementation plan
- `CLAUDE.md` — project conventions and patterns
- `.claude/rules/google-sheets-sync.md` — source of the "collectors disagree about including the professor" observation that motivates the `includes_professor` column
- `src/hooks/useThemePreference.ts` — reference pattern for `useIncludesProfessorDefault`
- `src/services/seedService.ts` — target of the D-03 extension
- `src/services/lessonService.ts` — target of the D-07 write-path XOR changes
- `src/db/client.ts` — reference pattern for the D-08 migration steps
