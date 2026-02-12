# Tasks: Improve App Design

**Input**: Design documents from `/specs/004-improve-app-design/`
**Prerequisites**: plan.md (loaded), spec.md (loaded), research.md (loaded), data-model.md (loaded), contracts/theme-api.md (loaded)

**Tests**: Not explicitly requested in spec — test tasks omitted. Use quickstart.md verification checklist for manual QA.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install new dependencies and configure the project for the design overhaul

- [x] T001 Install new dependencies: run `npx expo install react-native-reanimated @react-native-async-storage/async-storage`
- [x] T002 Update `userInterfaceStyle` from `"light"` to `"automatic"` in app.json
- [x] T003 Verify babel.config.js has `babel-preset-expo` preset (Reanimated plugin is auto-configured)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the complete design system and theme infrastructure that ALL user stories depend on. No screen or component work can begin until this phase is complete.

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 [P] Create light and dark color palettes with all semantic tokens per data-model.md in src/theme/colors.ts
- [x] T005 [P] Create typography scale (h1, h2, h3, body, bodySmall, caption, label) per data-model.md in src/theme/typography.ts
- [x] T006 [P] Create cross-platform shadow presets (sm, md, lg, xl) with Platform.select for iOS/Android in src/theme/shadows.ts
- [x] T007 Create unified Theme interface and export lightTheme/darkTheme objects combining colors, typography, spacing, borderRadius, and shadows in src/theme/index.ts
- [x] T008 [P] Create useThemePreference hook with AsyncStorage persistence (read/write `@eb-insights/theme-preference`, values: light|dark|system, default: system) in src/hooks/useThemePreference.ts
- [x] T009 Create ThemeProvider component: combine useColorScheme + useThemePreference to resolve active theme, provide via React Context, wrap children in src/theme/ThemeProvider.tsx
- [x] T010 Create useTheme hook to consume ThemeContext and return the active Theme object in src/hooks/useTheme.ts
- [x] T011 Wrap root layout with ThemeProvider in app/_layout.tsx (keep existing Stack structure for now; tab restructuring is US2)

**Checkpoint**: Design system foundation ready — all token files, ThemeProvider, and useTheme hook functional. Screens can now consume theme tokens.

---

## Phase 3: User Story 1 — Consistent Visual Identity (Priority: P1) MVP

**Goal**: Replace all hardcoded color, spacing, and font values across all 13 screens and 7 components with design tokens from the theme system.

**Independent Test**: Navigate every screen in the app and verify that typography, colors, spacing, and card styling are consistent. Grep codebase for hardcoded hex values in screen/component files — expect zero results.

### Implementation for User Story 1

- [x] T012 [P] [US1] Update CounterStepper to use theme tokens (colors, spacing, typography) via useTheme hook in src/components/CounterStepper.tsx
- [x] T013 [P] [US1] Update DatePickerInput to use theme tokens (colors, spacing, typography) via useTheme hook in src/components/DatePickerInput.tsx
- [x] T014 [P] [US1] Update ProfessorPicker to use theme tokens (colors, spacing, typography) via useTheme hook in src/components/ProfessorPicker.tsx
- [x] T015 [P] [US1] Update SeriesPicker to use theme tokens (colors, spacing, typography) via useTheme hook in src/components/SeriesPicker.tsx
- [x] T016 [P] [US1] Update StatusFilterBar to use theme tokens (colors, spacing, typography, borderRadius) via useTheme hook in src/components/StatusFilterBar.tsx
- [x] T017 [P] [US1] Update TimeCaptureButton to use theme tokens (colors, spacing, typography) via useTheme hook in src/components/TimeCaptureButton.tsx
- [x] T018 [P] [US1] Update TopicPicker to use theme tokens (colors, spacing, typography) via useTheme hook in src/components/TopicPicker.tsx
- [x] T019 [P] [US1] Update lessons list screen to use theme tokens (colors, spacing, typography, shadows) via useTheme hook in app/index.tsx
- [x] T020 [P] [US1] Update lesson detail screen to use theme tokens via useTheme hook in app/lesson/[id].tsx
- [x] T021 [P] [US1] Update lesson create screen to use theme tokens via useTheme hook in app/lesson/new.tsx
- [x] T022 [P] [US1] Update series list screen to use theme tokens via useTheme hook in app/series/index.tsx
- [x] T023 [P] [US1] Update series detail screen to use theme tokens via useTheme hook in app/series/[id].tsx
- [x] T024 [P] [US1] Update series create screen to use theme tokens via useTheme hook in app/series/new.tsx
- [x] T025 [P] [US1] Update professors list screen to use theme tokens via useTheme hook in app/professors/index.tsx
- [x] T026 [P] [US1] Update professor edit screen to use theme tokens via useTheme hook in app/professors/[id].tsx
- [x] T027 [P] [US1] Update professor create screen to use theme tokens via useTheme hook in app/professors/new.tsx
- [x] T028 [P] [US1] Update sync screen to use theme tokens via useTheme hook in app/sync/index.tsx
- [x] T029 [P] [US1] Update topic detail screen to use theme tokens via useTheme hook in app/topics/[id].tsx
- [x] T030 [P] [US1] Update topic create screen to use theme tokens via useTheme hook in app/topics/new.tsx
- [x] T031 [US1] Update root layout headerStyle to use theme tokens (replace hardcoded #007AFF, #fff) via useTheme hook in app/_layout.tsx
- [x] T032 [US1] Verify SC-003: grep all screen and component files for hardcoded hex/rgb values — fix any remaining instances

**Checkpoint**: All 13 screens and 7 components use design tokens. No hardcoded color/spacing/font values remain. App looks consistent in light mode.

---

## Phase 4: User Story 2 — Tab-Based Navigation (Priority: P1)

**Goal**: Restructure navigation from flat Stack with header text links to bottom tab bar with 4 labeled icons (Aulas, Séries, Professores, Sincronizar).

**Independent Test**: Tap each bottom tab — correct section loads, active tab highlighted. From a detail screen, tap a different tab — navigates to that section's root. Tap same tab — returns to root.

### Implementation for User Story 2

- [x] T033 [US2] Create tab navigator layout with 4 tabs (Aulas, Séries, Professores, Sincronizar) using Ionicons (book/library/people/cloud-upload outline/filled pairs) in app/(tabs)/_layout.tsx
- [x] T034 [US2] Move lessons list screen content from app/index.tsx to app/(tabs)/index.tsx as Aulas tab root
- [x] T035 [P] [US2] Create Séries tab root screen in app/(tabs)/series.tsx (move content from app/series/index.tsx)
- [x] T036 [P] [US2] Create Professores tab root screen in app/(tabs)/professors.tsx (move content from app/professors/index.tsx)
- [x] T037 [P] [US2] Create Sincronizar tab root screen in app/(tabs)/sync.tsx (move content from app/sync/index.tsx)
- [x] T038 [US2] Restructure root layout: Stack wraps (tabs) group as initial route + all detail/create screens as pushed routes in app/_layout.tsx
- [x] T039 [US2] Remove header text navigation links (Séries, Profs, Sinc TouchableOpacity buttons) from root layout since tabs replace them in app/_layout.tsx
- [x] T040 [US2] Style tab bar using theme tokens (tabBarBackground, tabBarBorder, tabBarActive, tabBarInactive) in app/(tabs)/_layout.tsx
- [x] T041 [US2] Verify all detail/create routes still navigate correctly from tab screens (lesson/[id], series/[id], professors/[id], topics/[id], */new)
- [x] T042 [US2] Remove old app/series/index.tsx, app/professors/index.tsx, app/sync/index.tsx (now served by tab screens) — clean up unused files

**Checkpoint**: Bottom tab navigation fully functional. 4 tabs with icons. All detail/create screens accessible from tabs. Header text links removed.

---

## Phase 5: User Story 3 — Dark Mode Support (Priority: P1)

**Goal**: App automatically matches device theme (or user's manual override). All screens render correctly in both light and dark modes. Settings screen provides Light/Dark/System toggle.

**Independent Test**: Toggle device dark mode — app switches theme. Open settings — toggle to "Dark" while device is light — app renders dark. Toggle to "System" — app follows device again. Restart app — preference persists.

### Implementation for User Story 3

- [x] T043 [US3] Create settings screen with theme toggle (Light/Dark/System radio-style selector) using theme tokens in app/settings.tsx
- [x] T044 [US3] Add settings navigation: gear icon button in tab navigator header or accessible from each tab in app/(tabs)/_layout.tsx
- [x] T045 [US3] Verify all 7 components render correctly in dark mode — check text contrast, border visibility, picker backgrounds in src/components/*.tsx
- [x] T046 [US3] Verify all 13 screens render correctly in dark mode — check backgrounds, card surfaces, text colors, input fields in app/**/*.tsx
- [x] T047 [US3] Verify modals and overlays (ProfessorPicker, SeriesPicker, TopicPicker, TimeCaptureButton) render correctly in dark mode with overlay colors from theme
- [x] T048 [US3] Verify tab bar appearance in dark mode (dark background, correct active/inactive colors) in app/(tabs)/_layout.tsx
- [x] T049 [US3] Verify StatusFilterBar pill buttons are distinguishable in dark mode with WCAG AA contrast in src/components/StatusFilterBar.tsx
- [x] T050 [US3] Verify theme preference persistence: set to "Dark", force-close app, reopen — should still be dark

**Checkpoint**: Dark mode fully functional. Settings toggle works. Preference persists. All screens + components render correctly in both themes. WCAG AA contrast met.

---

## Phase 6: User Story 4 — Visual Feedback & Animations (Priority: P2)

**Goal**: Add press feedback (scale/opacity) to all interactive elements and smooth screen transition animations.

**Independent Test**: Tap any button, card, or list item — immediate visual feedback (<100ms). Navigate between screens — smooth slide/fade animation plays.

### Implementation for User Story 4

- [x] T051 [US4] Configure screen transition animations (slide_from_right for push, slide_from_bottom for modals) in root Stack screenOptions in app/_layout.tsx
- [x] T052 [P] [US4] Add Reanimated press feedback (scale 0.97 spring) to lesson list item cards in app/(tabs)/index.tsx
- [x] T053 [P] [US4] Add Reanimated press feedback to series list item cards in app/(tabs)/series.tsx
- [x] T054 [P] [US4] Add Reanimated press feedback to professor list item cards in app/(tabs)/professors.tsx
- [x] T055 [P] [US4] Add Reanimated press feedback to CounterStepper +/- buttons in src/components/CounterStepper.tsx
- [x] T056 [P] [US4] Add Reanimated press feedback to TimeCaptureButton in src/components/TimeCaptureButton.tsx
- [x] T057 [P] [US4] Add Reanimated press feedback to StatusFilterBar pill buttons in src/components/StatusFilterBar.tsx
- [x] T058 [US4] Add Reanimated press feedback to all remaining tappable elements (form buttons, action buttons, picker triggers) across all screens

**Checkpoint**: All interactive elements provide visual feedback on press. Screen transitions are animated. 60fps animations confirmed.

---

## Phase 7: User Story 5 — Icon-Based Actions (Priority: P2)

**Goal**: Add Ionicons to FABs, status badges, and form controls throughout the app.

**Independent Test**: Navigate to list screens — FABs show "add" icon. View lesson list items — status badges include icons. View form screens — relevant inputs have leading icons.

### Implementation for User Story 5

- [x] T059 [US5] Create standardized FAB component with icon (default: "add"), press animation, and theme-aware styling in src/components/FAB.tsx
- [x] T060 [P] [US5] Replace lessons list inline FAB with FAB component in app/(tabs)/index.tsx
- [x] T061 [P] [US5] Replace series list inline FAB with FAB component in app/(tabs)/series.tsx
- [x] T062 [P] [US5] Replace professors list inline FAB with FAB component in app/(tabs)/professors.tsx
- [x] T063 [P] [US5] Replace series detail topic-add FAB with FAB component in app/series/[id].tsx
- [x] T064 [US5] Add icon indicators to lesson status badges (checkmark for completed, upload for exported, sync for synced, pencil for in-progress) in app/(tabs)/index.tsx
- [x] T065 [P] [US5] Add leading icons to form inputs on lesson detail screen (professor icon, series icon, topic icon, calendar icon, clock icon) in app/lesson/[id].tsx
- [x] T066 [P] [US5] Add leading icons to form inputs on professor create/edit screens (person icon, card icon for CPF) in app/professors/new.tsx and app/professors/[id].tsx
- [x] T067 [P] [US5] Add leading icons to form inputs on series create screen (code icon, text icon) in app/series/new.tsx
- [x] T068 [P] [US5] Add leading icons to form inputs on topic create screen (text icon, number icon, calendar icon) in app/topics/new.tsx

**Checkpoint**: All FABs use standardized component with icon. Status badges have icon indicators. Form inputs have leading icons.

---

## Phase 8: User Story 6 — Improved Empty States (Priority: P2)

**Goal**: Show descriptive empty states with icon, message, and CTA button on all list screens when no data exists.

**Independent Test**: View each list screen with no data — icon, descriptive message in PT-BR, and CTA button appear. Tap CTA — navigates to creation flow. Works in both light and dark mode.

### Implementation for User Story 6

- [x] T069 [US6] Create reusable EmptyState component (icon, title, description, actionLabel, onAction) with theme-aware styling in src/components/EmptyState.tsx
- [x] T070 [P] [US6] Add EmptyState to lessons list (icon: book-outline, message: "Nenhuma aula registrada", CTA: "Criar primeira aula") in app/(tabs)/index.tsx
- [x] T071 [P] [US6] Add EmptyState to series list (icon: library-outline, message: "Nenhuma série cadastrada", CTA: "Criar primeira série") in app/(tabs)/series.tsx
- [x] T072 [P] [US6] Add EmptyState to professors list (icon: people-outline, message: "Nenhum professor cadastrado", CTA: "Cadastrar professor") in app/(tabs)/professors.tsx
- [x] T073 [P] [US6] Add EmptyState to series detail topics list (icon: list-outline, message: "Nenhum tópico nesta série", CTA: "Adicionar tópico") in app/series/[id].tsx
- [x] T074 [US6] Verify all empty states render correctly in dark mode with legible text and visible icons

**Checkpoint**: All list screens display descriptive empty states. CTAs navigate to correct creation flows. Works in both themes.

---

## Phase 9: User Story 7 — Loading Skeletons (Priority: P3)

**Goal**: Replace generic spinners with skeleton placeholders that mimic content card shapes during data loading. Show inline error with retry on failure.

**Independent Test**: Trigger data load on list screens — skeleton placeholders appear. Data loads — skeletons transition smoothly to content. Simulate failure — error message with "Tentar novamente" button appears. Tap retry — skeletons reappear.

### Implementation for User Story 7

- [x] T075 [P] [US7] Create SkeletonLoader component with shimmer animation (Reanimated withRepeat opacity) and theme-aware colors (skeleton/skeletonHighlight tokens) in src/components/SkeletonLoader.tsx
- [x] T076 [P] [US7] Create ErrorRetry component (icon: alert-circle, message, "Tentar novamente" button) with theme-aware styling in src/components/ErrorRetry.tsx
- [x] T077 [P] [US7] Replace loading spinner with skeleton cards (3 placeholder rows matching card shape) in lessons list in app/(tabs)/index.tsx
- [x] T078 [P] [US7] Replace loading spinner with skeleton cards in series list in app/(tabs)/series.tsx
- [x] T079 [P] [US7] Replace loading spinner with skeleton cards in professors list in app/(tabs)/professors.tsx
- [x] T080 [US7] Add error state handling: on data fetch failure, replace skeletons with ErrorRetry component; on retry, show skeletons again and re-fetch in app/(tabs)/index.tsx, app/(tabs)/series.tsx, app/(tabs)/professors.tsx, app/(tabs)/sync.tsx
- [x] T081 [US7] Verify skeleton colors are appropriate in dark mode (not light-mode gray on dark background)

**Checkpoint**: All list screens show skeleton loaders during data fetch. Error states show inline retry. Skeletons render correctly in dark mode.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cleanup, and cross-cutting improvements

- [x] T082 [P] Verify SC-003: run grep for hardcoded hex/rgb values in all screen and component files — fix any remaining
- [x] T083 [P] Verify SC-009: audit all color token pairings against WCAG AA (4.5:1 text, 3:1 UI) in both light and dark palettes in src/theme/colors.ts
- [ ] T084 Verify SC-007: manually test all CRUD flows (create/edit/delete lesson, series, professor, topic), CSV export, and sync to confirm no behavioral regressions
- [ ] T085 Verify SC-006: test full app in Expo Go on both iOS and Android
- [x] T086 [P] Remove any unused imports, dead code, or orphaned style objects introduced during refactoring
- [ ] T087 Run quickstart.md verification checklist (all 10 items) to confirm feature completeness

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — can start as soon as theme system is ready
- **US2 (Phase 4)**: Depends on Phase 2 — can run in parallel with US1 (different files: app/(tabs)/ vs src/components/)
- **US3 (Phase 5)**: Depends on Phase 2 + US1 (needs tokens applied to verify dark mode) — best after US1
- **US4 (Phase 6)**: Depends on Phase 2 — can start after foundational; best after US1+US2 so animations apply to final screen structure
- **US5 (Phase 7)**: Depends on Phase 2 — can start after foundational; best after US2 (FABs reference final tab screens)
- **US6 (Phase 8)**: Depends on Phase 2 — can start after foundational; best after US2 (empty states on tab screens)
- **US7 (Phase 9)**: Depends on Phase 2 — can start after foundational; best after US2 (skeleton loaders on tab screens)
- **Polish (Phase 10)**: Depends on ALL user stories being complete

### User Story Dependencies

- **US1 (P1)**: Foundation only — no cross-story dependency
- **US2 (P1)**: Foundation only — no cross-story dependency (can parallel with US1)
- **US3 (P1)**: Ideally after US1 (tokens applied) and US2 (tab bar to verify dark styling)
- **US4 (P2)**: Ideally after US1+US2 (final screen structure in place)
- **US5 (P2)**: Ideally after US2 (FABs on tab screens)
- **US6 (P2)**: Ideally after US2 (empty states on tab screens)
- **US7 (P3)**: Ideally after US2 (skeleton loaders on tab screens)

### Within Each User Story

- Theme token files before ThemeProvider (Phase 2)
- Components before screens (US1: update components first, screens second)
- Structural changes before styling (US2: file moves before tab styling)
- Core implementation before verification (verify tasks last in each phase)

### Parallel Opportunities

- **Phase 2**: T004, T005, T006 can all run in parallel (different files)
- **Phase 2**: T008 can run in parallel with T004-T006 (different file)
- **US1**: ALL component updates (T012-T018) can run in parallel
- **US1**: ALL screen updates (T019-T030) can run in parallel
- **US2**: T035, T036, T037 can run in parallel (different tab files)
- **US4**: T052-T057 can run in parallel (different files)
- **US5**: T060-T063 can run in parallel (different list screens)
- **US5**: T065-T068 can run in parallel (different form screens)
- **US6**: T070-T073 can run in parallel (different list screens)
- **US7**: T075, T076 can run in parallel (different component files)
- **US7**: T077-T079 can run in parallel (different list screens)

---

## Parallel Example: User Story 1

```bash
# Launch all component updates together (7 files, no dependencies between them):
Task: "Update CounterStepper to use theme tokens in src/components/CounterStepper.tsx"
Task: "Update DatePickerInput to use theme tokens in src/components/DatePickerInput.tsx"
Task: "Update ProfessorPicker to use theme tokens in src/components/ProfessorPicker.tsx"
Task: "Update SeriesPicker to use theme tokens in src/components/SeriesPicker.tsx"
Task: "Update StatusFilterBar to use theme tokens in src/components/StatusFilterBar.tsx"
Task: "Update TimeCaptureButton to use theme tokens in src/components/TimeCaptureButton.tsx"
Task: "Update TopicPicker to use theme tokens in src/components/TopicPicker.tsx"

# Then launch all screen updates together (13 files, no dependencies between them):
Task: "Update lessons list screen in app/index.tsx"
Task: "Update lesson detail screen in app/lesson/[id].tsx"
# ... (all 13 screens in parallel)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T011)
3. Complete Phase 3: User Story 1 (T012-T032)
4. **STOP and VALIDATE**: Navigate all screens — consistent visual identity, no hardcoded values
5. App is visually improved even without tabs or dark mode

### Recommended Sequence (Sequential)

1. Setup → Foundational → **US1** (design tokens) → **US2** (tabs) → **US3** (dark mode) → US4 (animations) → US5 (icons) → US6 (empty states) → US7 (skeletons) → Polish
2. This order ensures each story builds on the previous: tokens first, then structure, then theme switching, then polish layers.

### Parallel Delivery (2 agents)

1. Both: Setup + Foundational
2. Agent A: US1 (tokens on components) | Agent B: US2 (tab restructuring)
3. Agent A: US3 (dark mode verification) | Agent B: US5 (icons + FABs)
4. Agent A: US4 (animations) | Agent B: US6 (empty states)
5. Both: US7 (skeletons) → Polish

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each completed phase
- Stop at any checkpoint to validate story independently
- All UI labels in Portuguese (PT-BR) per clarification
- All screen moves in US2 should preserve existing route functionality
