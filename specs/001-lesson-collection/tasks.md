# Tasks: Lesson Data Collection Flow

**Input**: Design documents from `specs/001-lesson-collection/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Tests**: Tests are included as unit/integration tests for logic and components where appropriate, matching the Constitution's quality requirements.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure.

- [X] T001 Initialize Expo project structure with TypeScript and Expo Router
- [X] T002 Install dependencies: `expo-sqlite`, `expo-file-system`, `expo-sharing`, `uuid`
- [X] T003 Configure minimal theme (colors, spacing) in `src/theme/index.ts`
- [X] T004 [P] Setup Expo Router root layout in `app/_layout.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented.

- [X] T005 Create `LessonStatus` enum and `Lesson` interface in `src/types/lesson.ts` (mapped from data-model.md)
- [X] T006 Implement SQLite client wrapper in `src/db/client.ts` (using `expo-sqlite` modern API)
- [X] T007 Define database schema SQL in `src/db/schema.ts` matching `lessons_data` table definition
- [X] T008 Implement DB initialization logic (create table if not exists) in `src/db/client.ts`
- [X] T009 Implement base CRUD service in `src/services/lessonService.ts` (create, getById, update)
- [X] T010 [P] Create `useDebounce` hook (or equivalent utility) in `src/hooks/useDebounce.ts` for auto-save

**Checkpoint**: Database is initialized, schema is ready, and service layer has basic CRUD.

---

## Phase 3: User Story 1 - Start New Lesson (Priority: P1)

**Goal**: Create a new lesson and navigate to the form.
**Independent Test**: Tap "Nova Aula", verify new record in DB and navigation to form.

### Implementation for User Story 1

- [X] T011 [US1] Implement `createLesson` method in `src/services/lessonService.ts` (Status: IN_PROGRESS, Default Times, Fetch previous lesson metadata for pre-fill)
- [X] T012 [US1] Create "Nova Aula" button on Home Screen in `app/index.tsx`
- [X] T013 [US1] Implement "New Lesson" controller action in `app/lesson/new.tsx` (calls service, redirects to `[id]`)
- [X] T014 [US1] Create basic Lesson Form layout in `app/lesson/[id].tsx` (displays Lesson Title/Date for verification)
- [ ] T015 [US1] Add unit test for `createLesson` logic in `tests/unit/lessonService.test.ts` (DEFERRED)

**Checkpoint**: User can start a lesson and see the form.

---

## Phase 4: User Story 2 - Collect Lesson Data (Priority: P1)

**Goal**: Record attendance and times with "Zero Typing" and Auto-Save.
**Independent Test**: Modify counters, restart app, verify persistence.

### Implementation for User Story 2

- [X] T016 [P] [US2] Create `CounterStepper` component in `src/components/CounterStepper.tsx` (Props: value, onIncrement, onDecrement)
- [X] T017 [P] [US2] Create `TimeCaptureButton` component in `src/components/TimeCaptureButton.tsx` (Props: value, onCapture)
- [X] T018 [US2] Implement `updateLesson` method in `src/services/lessonService.ts` (supports partial updates)
- [X] T019 [US2] Integrate `CounterStepper` into `app/lesson/[id].tsx` for attendance fields
- [X] T020 [US2] Integrate `TimeCaptureButton` into `app/lesson/[id].tsx` for start/end times
- [X] T021 [US2] Implement Auto-Save logic in `app/lesson/[id].tsx` using `useDebounce` and `lessonService.updateLesson`
- [X] T022 [US2] Add manual text inputs for Coordinator/Professor names in `app/lesson/[id].tsx` (debounced save)
- [X] T023 [US2] Verify state restoration on mount (useEffect -> `lessonService.getById`) in `app/lesson/[id].tsx`

**Checkpoint**: Full data collection form is functional and persists data.

---

## Phase 5: User Story 3 - Export & Sync Data (Priority: P2)

**Goal**: Export completed lessons to JSON.
**Independent Test**: Mark completed, export, verify JSON content.

### Implementation for User Story 3

- [X] T024 [US3] Implement "Finalizar Aula" button in `app/lesson/[id].tsx` (Updates status to COMPLETED)
- [X] T025 [US3] Implement `getCompletedLessons` in `src/services/lessonService.ts`
- [X] T026 [US3] Create Export Screen UI in `app/sync/index.tsx`
- [X] T027 [US3] Implement JSON generation (Array of Lesson objects) and FileSystem write logic in `src/services/exportService.ts`
- [X] T028 [US3] Connect `Sharing.shareAsync` to "Export Data" button in `app/sync/index.tsx`
- [ ] T029 [US3] Add integration test for JSON payload structure in `tests/integration/export.test.ts` (DEFERRED)

**Checkpoint**: End-to-end flow complete (Start -> Collect -> Complete -> Export).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: UX refinements and code quality.

- [X] T030 Add simple loading states/spinners during DB operations
- [X] T031 Refine styling of Steppers and Buttons to match "Minimalism" constitution
- [X] T032 Verify "Offline" mode (Turn off WiFi/Data and test full flow)
- [X] T033 Run `tsc` and fix any strict mode type errors
- [X] T034 Verify `quickstart.md` steps manually

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 & 2 (Setup/Foundation)**: BLOCKS all user stories.
- **Phase 3 (US1)**: BLOCKS Phase 4 (US2) - Cannot collect data without a lesson.
- **Phase 4 (US2)**: BLOCKS Phase 5 (US3) - Cannot export empty/non-existent data.

### Parallel Opportunities
- **Within Phase 2**: T010 (Hook) can run parallel to T006-T009 (DB/Service).
- **Within Phase 4**: T016 (Stepper) and T017 (TimeButton) are independent UI components.
- **Within Phase 5**: T025 (Service) and T026 (UI) can be started in parallel.

## Implementation Strategy

### MVP Delivery
1.  **Foundation**: DB + Service Layer.
2.  **MVP**: US1 (Start) + US2 (Collect). This allows the class secretary to use the app in class immediately, even if Export (US3) comes later (data remains safe in SQLite).
3.  **Release 1.0**: Add US3 (Export) to complete the loop for the coordinator.