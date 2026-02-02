# Tasks: Migração do Schema para Estrutura Normalizada

**Input**: Design documents from `/specs/003-migrate-schema-structure/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/schema.sql

**Tests**: Not explicitly requested - test tasks not included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Mobile app (Expo)**: `src/` for source, `app/` for screens (expo-router)
- Types: `src/types/`
- Services: `src/services/`
- Components: `src/components/`
- Database: `src/db/`
- Screens: `app/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create base types and schema definitions for new entities

- [x] T001 [P] Create LessonSeries type interface in `src/types/lessonSeries.ts`
- [x] T002 [P] Create LessonTopic type interface in `src/types/lessonTopic.ts`
- [x] T003 Update Lesson type to add `lesson_topic_id` field in `src/types/lesson.ts`
- [x] T004 Add DDL constants for `lesson_series` and `lesson_topics` tables in `src/db/schema.ts`
- [x] T005 Add DDL constants for indexes (series_code, topics_series_id, topics_sequence) in `src/db/schema.ts`

**Checkpoint**: Types and schema definitions ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Add `normalizeText()` utility function in `src/utils/text.ts` (uppercase, trim, collapse spaces)
- [x] T007 Update `initializeDatabase()` to create `lesson_series` and `lesson_topics` tables in `src/db/client.ts`
- [x] T008 Add migration function to check and add `lesson_topic_id` column to `lessons_data` in `src/db/client.ts`
- [x] T009 Insert default "SEM-SERIE" series and "Sem Tópico" topic records in `src/db/client.ts`

**Checkpoint**: Foundation ready - database has new tables and column, user story implementation can begin

---

## Phase 3: User Story 3 - Migração de Dados Existentes (Priority: P1)

**Goal**: Migrate existing lesson records to use normalized series/topics structure

**Independent Test**: Execute migration on database copy, verify all existing records have `lesson_topic_id` populated and display correctly

**Why first**: This story creates the data that US1 and US2 depend on

### Implementation for User Story 3

- [x] T010 [US3] Create `migrateLegacyData()` function to extract unique series from `series_name` in `src/db/migrations.ts`
- [x] T011 [US3] Implement logic to create `lesson_series` records from normalized unique values in `src/db/migrations.ts`
- [x] T012 [US3] Implement logic to create `lesson_topics` records from normalized unique `lesson_title` per series in `src/db/migrations.ts`
- [x] T013 [US3] Implement logic to update `lessons_data.lesson_topic_id` via JOIN on normalized values in `src/db/migrations.ts`
- [x] T014 [US3] Handle empty/null `series_name` by linking to "SEM-SERIE" default in `src/db/migrations.ts`
- [x] T015 [US3] Handle empty/null `lesson_title` by linking to "Sem Tópico" default in `src/db/migrations.ts`
- [x] T016 [US3] Call `migrateLegacyData()` from `initializeDatabase()` after table creation in `src/db/client.ts`
- [x] T017 [US3] Add migration completion flag to prevent re-running migration in `src/db/client.ts`

**Checkpoint**: All existing lessons have `lesson_topic_id` populated, series and topics tables contain migrated data

---

## Phase 4: User Story 1 - Registro de Aula com Estrutura Normalizada (Priority: P1) 🎯 MVP

**Goal**: Coordinator can register a lesson by selecting series and topic from pre-populated lists

**Independent Test**: Create a series with topics, register a new lesson selecting that topic, verify lesson displays series/topic info correctly

### Implementation for User Story 1

- [x] T018 [P] [US1] Create `seriesService.ts` with `getAllSeries()`, `getSeriesById()` in `src/services/seriesService.ts`
- [x] T019 [P] [US1] Create `topicService.ts` with `getTopicsBySeries()`, `getTopicById()` in `src/services/topicService.ts`
- [x] T020 [P] [US1] Create `SeriesPicker` component (dropdown/modal selection) in `src/components/SeriesPicker.tsx`
- [x] T021 [US1] Create `TopicPicker` component (filtered by selected series) in `src/components/TopicPicker.tsx`
- [x] T022 [US1] Update `lessonService.createLesson()` to require `lesson_topic_id` parameter in `src/services/lessonService.ts`
- [x] T023 [US1] Update `lessonService.createLesson()` to auto-populate legacy `series_name` and `lesson_title` from topic in `src/services/lessonService.ts`
- [x] T024 [US1] Update lesson creation flow to show SeriesPicker then TopicPicker in `app/lesson/new.tsx`
- [x] T025 [US1] Update lesson detail screen to display series code and topic title in `app/lesson/[id].tsx`
- [x] T026 [US1] Add query to fetch lesson with joined series/topic info in `src/services/lessonService.ts`

**Checkpoint**: New lessons can be created with series/topic selection, lesson details show normalized data

---

## Phase 5: User Story 2 - Gerenciamento de Séries e Tópicos (Priority: P2)

**Goal**: Administrator can create, edit, view, and list series and their topics

**Independent Test**: Create a new series, add multiple topics with sequence order, verify listing shows topics in correct order

### Implementation for User Story 2

- [x] T027 [P] [US2] Add `createSeries()` method to `src/services/seriesService.ts`
- [x] T028 [P] [US2] Add `updateSeries()` method to `src/services/seriesService.ts`
- [x] T029 [P] [US2] Add `deleteSeries()` method with lesson count check (prevent if lessons exist) to `src/services/seriesService.ts`
- [x] T030 [P] [US2] Add `createTopic()` method to `src/services/topicService.ts`
- [x] T031 [P] [US2] Add `updateTopic()` method to `src/services/topicService.ts`
- [x] T032 [P] [US2] Add `deleteTopic()` method to `src/services/topicService.ts`
- [x] T033 [US2] Create series list screen with navigation to create/edit in `app/series/index.tsx`
- [x] T034 [US2] Create new series screen with code, title, description fields in `app/series/new.tsx`
- [x] T035 [US2] Create series detail/edit screen with topics list in `app/series/[id].tsx`
- [x] T036 [US2] Create new topic screen (receives seriesId param) in `app/topics/new.tsx`
- [x] T037 [US2] Create topic detail/edit screen in `app/topics/[id].tsx`
- [x] T038 [US2] Add navigation link to series management from main menu/settings in `app/_layout.tsx` or `app/index.tsx`

**Checkpoint**: Full CRUD for series and topics available, topics display in sequence order

---

## Phase 6: User Story 4 - Compatibilidade com Funcionalidades Existentes (Priority: P1)

**Goal**: All existing functionality continues working after migration

**Independent Test**: Run through all existing flows (register attendance, select professor, view reports) and verify no regressions

### Implementation for User Story 4

- [x] T039 [US4] Verify attendance counters work with updated lesson model in `app/lesson/[id].tsx`
- [x] T040 [US4] Verify professor selection works with updated lesson model in `app/lesson/[id].tsx`
- [x] T041 [US4] Update lesson list to show series/topic instead of legacy text fields in `app/index.tsx`
- [x] T042 [US4] Verify export/sync functionality works with updated lesson structure in `src/services/exportService.ts`
- [x] T043 [US4] Update any report queries to use JOIN with series/topics for display in `src/services/lessonService.ts`

**Checkpoint**: All existing features work correctly with new schema

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T044 [P] Add code normalization validation on series creation (prevent duplicates) in `src/services/seriesService.ts`
- [x] T045 [P] Add title normalization validation on topic creation within same series in `src/services/topicService.ts`
- [x] T046 Review and clean up any unused legacy code references
- [x] T047 Verify quickstart.md scenarios work end-to-end
- [x] T048 Update README or documentation with new schema information

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup ─────────────┐
                            ├──► Phase 2: Foundational ──► Phase 3-6 (User Stories)
                            │
Phase 2: Foundational ──────┘
         │
         ▼
Phase 3: US3 (Migração) ────► Provides data for US1, US2
         │
         ├──► Phase 4: US1 (Registro) ──► MVP Complete
         │
         ├──► Phase 5: US2 (Gerenciamento) ──► Can run parallel to US1
         │
         └──► Phase 6: US4 (Compatibilidade) ──► After US1 complete
                            │
                            ▼
                    Phase 7: Polish
```

### User Story Dependencies

| Story | Depends On | Can Start After |
|-------|------------|-----------------|
| US3 (Migração) | Phase 2 | Foundational complete |
| US1 (Registro) | US3 | Migration data exists |
| US2 (Gerenciamento) | Phase 2 | Foundational complete (parallel to US1) |
| US4 (Compatibilidade) | US1 | Registro flow complete |

### Parallel Opportunities

**Phase 1 (all parallel):**

```
T001 ─┬─► T003 (after types ready)
T002 ─┘
T004 ─┬─► T005 (same file, sequential)
```

**Phase 4 - US1 (parallel models/services):**

```
T018 (seriesService) ─┬─► T020 (SeriesPicker)
T019 (topicService) ──┴─► T021 (TopicPicker) ──► T022-T026 (sequential)
```

**Phase 5 - US2 (parallel service methods):**

```
T027, T028, T029 (series methods) ─┬─► T033-T035 (series screens)
T030, T031, T032 (topic methods) ──┴─► T036-T037 (topic screens)
```

---

## Parallel Example: User Story 1

```bash
# Launch services in parallel:
Task: "Create seriesService.ts in src/services/seriesService.ts"
Task: "Create topicService.ts in src/services/topicService.ts"

# Then launch pickers in parallel:
Task: "Create SeriesPicker component in src/components/SeriesPicker.tsx"
Task: "Create TopicPicker component in src/components/TopicPicker.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 + Migration)

1. Complete Phase 1: Setup (T001-T005)
2. Complete Phase 2: Foundational (T006-T009)
3. Complete Phase 3: US3 Migration (T010-T017)
4. Complete Phase 4: US1 Registro (T018-T026)
5. **STOP and VALIDATE**: Test new lesson creation with series/topic selection
6. Deploy/demo if ready - this is functional MVP

### Incremental Delivery

1. **Setup + Foundational + US3** → Database ready with migrated data
2. **Add US1** → Test lesson creation → Deploy (MVP!)
3. **Add US2** → Test series/topic management → Deploy
4. **Add US4** → Verify all existing features → Deploy
5. **Polish** → Documentation and cleanup → Final release

### Single Developer Order

```
T001 → T002 → T003 → T004 → T005 (Setup)
T006 → T007 → T008 → T009 (Foundational)
T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017 (US3)
T018 → T019 → T020 → T021 → T022 → T023 → T024 → T025 → T026 (US1) ← MVP
T027-T038 (US2)
T039-T043 (US4)
T044-T048 (Polish)
```

---

## Notes

- [P] tasks = different files, no dependencies within phase
- [Story] label maps task to specific user story for traceability
- Legacy fields (`series_name`, `lesson_title`) are preserved for compatibility
- Migration is idempotent (flag prevents re-running)
- Normalization: `UPPER(TRIM(value)).replace(/\s+/g, ' ')`
- Default series "SEM-SERIE" has fixed UUID: `00000000-0000-0000-0000-000000000001`
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
