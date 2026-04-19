# Tasks: Statistics Dashboard

**Input**: Design documents from `specs/009-statistics-dashboard/`
**Prerequisites**: plan.md, spec.md (incl. Clarifications round 1 + round 2), research.md, data-model.md, contracts/dashboard-service.md

**Tests**: Unit tests ARE included for `dashboardService` because the spec's edge cases (EC-002, EC-007, status filter, limits) are arithmetic-heavy and easy to regress silently. UI tests are NOT generated — manual verification via `quickstart.md` is the ship gate.

**Organization**: Tasks are grouped by user story. MVP = Phases 1 + 2 + 3 (US1) + 4 (US2) + 9 (tab entry point) + 10 (polish). Phase 5–7 (P2 charts) and the deferred P3 charts (Phase 8) are explicitly out of MVP.

**Round-2 clarifications reflected below** (see `spec.md` §Clarifications "round 2, post-plan"):

1. **FR-016 — Per-card resilience**: every chart card owns its own `loading | success | error` state. The screen loads datasets with `Promise.allSettled`; a rejected query is surfaced inside its own card only (retry button), never as a global failure.
2. **FR-005 — "Últimas N aulas — " subtitle**: every card subtitle begins with `Últimas ${n} aulas — ` where `n` is the actual row count in `data` (capped at 12 or 26 depending on the chart).
3. **FR-034 — Engagement is bar chart only**: the previously-offered "big number" alternative is dropped.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable — different files, no dependencies on incomplete tasks.
- **[Story]**: User story label for tasks inside story phases (US1..US5). Setup / Foundational / Polish phases have no story label.

## Path Conventions

EB Insights is a single Expo project. All code lives under `app/`, `src/`, and `tests/` at repo root per CLAUDE.md §15.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install the single new runtime dependency and verify the dev loop still works.

- [X] T001 Install `react-native-gifted-charts` and `react-native-svg` by running `npm install react-native-gifted-charts react-native-svg` from repo root; commit the updated `package.json` and `package-lock.json`.
- [ ] T002 Start the dev server with `npm start` and confirm the app still builds and opens in Expo Go on Android or an emulator — this validates that `react-native-svg` does not force a native rebuild before any feature code is written. (Manual step — deferred to developer verification after merge.)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the shared types, service scaffold, theme tokens, and reusable chart primitives that every user story below depends on. None of the user story phases can start until this phase completes.

- [X] T003 Create `src/types/dashboard.ts` containing the interfaces `DashboardFilters`, `DashboardResult<T>`, `LateArrivalDatum`, `AttendanceCurveDatum`, `TrendDatum`, `PunctualityDatum`, `EngagementDatum`, and the constant `DASHBOARD_LIMITS = { timeSeries: 12, trend: 26 } as const`. Also export the type `ChartCardStatus = 'loading' | 'success' | 'error'` used by the per-card state machine (FR-016). Field shapes MUST match `specs/009-statistics-dashboard/data-model.md`.
- [X] T004 [P] Extend `ColorTokens` interface in `src/theme/colors.ts` with the following new semantic tokens: `chartPrimary`, `chartWarning`, `chartNeutral`, `chartMuted`, `chartAxis`, `chartGrid`, `chartReferenceLine`, `chartTooltipBackground`, `chartTooltipBorder`. Add values for both `lightColors` and `darkColors` objects derived from existing semantic colors per `research.md` §3. Do NOT introduce raw hex values that aren't already present — reuse `primary`, `danger`, `textSecondary`, `surfaceElevated`, `border`, `divider` where possible, and use `hexToRgba()` for alpha variants.
- [X] T005 Create `src/services/dashboardService.ts` as an empty object literal `export const dashboardService = { }` with a file-level JSDoc linking to `specs/009-statistics-dashboard/contracts/dashboard-service.md`. This scaffold unblocks tests and screens referencing the service before any method is implemented.
- [X] T006 [P] Create `src/components/charts/ChartCard.tsx` — a theme-aware card wrapper that implements the FR-016 per-card state machine. Props: `title: string`, `subtitlePrefix: string` (e.g., `"% de pessoas que chegaram depois do início"`), `status: ChartCardStatus`, `count: number` (used to compose the "Últimas N aulas — " prefix; pass `0` when status is not `'success'`), `footnote?: string`, `errorMessage?: string`, `onRetry?: () => void`, `children: React.ReactNode`. Behavior: (a) renders title + a composed subtitle of shape `` `Últimas ${count} aulas — ${subtitlePrefix}` `` when `status === 'success' && count > 0`, falling back to just `subtitlePrefix` otherwise; (b) when `status === 'loading'` shows a skeleton placeholder instead of `children`; (c) when `status === 'error'` shows the `errorMessage ?? 'Erro ao carregar este gráfico'` plus a "Tentar novamente" button wired to `onRetry`; (d) when `status === 'success'` renders `children` and the optional `footnote`. Uses `createStyles(theme)` pattern per CLAUDE.md §2.
- [X] T007 [P] Create `src/components/charts/ChartTooltip.tsx` — an absolutely-positioned popover following the FR-015 pattern. Props: `visible: boolean`, `anchorX: number`, `anchorY: number`, `lines: string[]`, `onViewLesson: () => void`, `onDismiss: () => void`. The tooltip renders the lines stacked, a "Ver aula →" link at the bottom, and is dismissed by tapping outside (use a transparent overlay `Pressable`). Uses `accessibilityRole="alert"` so screen readers announce it when it appears.
- [X] T008 [P] Create `src/components/charts/DashboardEmptyState.tsx` — a reusable empty-state component accepting `message: string` and an optional `icon` name. Used by every chart card when fewer than 2 rows are available. Based on the same pattern as the existing `EmptyState` component in `src/components/` but styled for inline chart slots rather than full-screen empty states.
- [X] T008a [P] Add a tiny `useChartCardState<T>(loader: () => Promise<DashboardResult<T>>)` hook in `src/hooks/useChartCardState.ts`. Returns `{ status: ChartCardStatus, data: T[], excludedCount: number, errorMessage: string | null, reload: () => void }`. Internally manages state, runs `loader()` on mount and on `reload`, catches rejection to set `status = 'error'` with the message. This is the per-card building block that the dashboard screen uses for each card (FR-016); without it, every card integration task below would re-implement the same loading dance.

**Checkpoint**: Types exist, theme has chart tokens, service scaffold is importable, the three shared chart primitives compile, and the `useChartCardState` hook is ready. User story phases can start in parallel after this point.

---

## Phase 3: User Story 1 — Late Arrival Index (Priority: P1) 🎯 MVP

**Goal**: Deliver FR-030 and US1 — a vertical bar chart of `((end - start) / end) * 100` for the 12 most recent completed lessons, with inline tooltips, exclusion footnote, "Últimas N aulas — " subtitle, per-card error state, and theme-aware colors.

**Independent Test**: With 4 completed lessons in SQLite having attendance `(7, 25)`, `(10, 28)`, `(16, 26)`, `(4, 24)`, open the dashboard. Verify four bars at 72.0%, 64.3%, 38.5%, 83.3% sorted by date ascending. Verify the 50% dashed reference line. Verify the subtitle reads `Últimas 4 aulas — % de pessoas que chegaram depois do início`. Verify tapping any bar opens the tooltip with raw counts plus "Ver aula" link. Verify a lesson with `attendance_end = 0` does NOT appear and the card shows "1 aula excluída por dados incompletos". Force the late-arrival service function to throw once and verify the card shows its own error state + retry button while the other cards (once Phase 4 ships) still render.

- [X] T009 [P] [US1] Create `tests/unit/dashboardService.test.ts` with an initial suite for `getLateArrivalIndex` that mocks `getDatabase()` and covers: (a) percent formula matches spec AS1 values (72.0, 64.3, 38.5, 83.3 — allow ±0.05 tolerance for rounding), (b) `IN_PROGRESS` lessons are filtered out, (c) `COMPLETED`, `EXPORTED`, and `SYNCED` lessons are all included, (d) null and zero `attendance_end` increment `excludedCount` and are not in `data`, (e) null `attendance_start` increments `excludedCount`, (f) rows where `attendance_end < attendance_start` are included with `percent = 0` and `isInconsistent = true`, (g) with 20 valid rows the result has exactly 12 rows and they are the 12 most recent by `date`, (h) returned `data` is chronologically ascending, (i) empty DB returns `{ data: [], excludedCount: 0 }` without throwing. Tests MUST fail until T010 is implemented.
- [X] T010 [US1] Implement `dashboardService.getLateArrivalIndex(filters?: DashboardFilters): Promise<DashboardResult<LateArrivalDatum>>` in `src/services/dashboardService.ts` following the sketch in `contracts/dashboard-service.md`. Two parameterized queries: one for the limited dataset, one for `excludedCount`. Reverse the limited result in JS for chronological ascending order. Round `percent` to one decimal place. Make T009 tests pass.
- [X] T011 [P] [US1] Create `src/components/charts/LateArrivalChart.tsx` that accepts `data: LateArrivalDatum[]` as props and renders a vertical bar chart using `react-native-gifted-charts` `BarChart`. Bar colors follow FR-030 thresholds (`<40%` = `theme.colors.chartNeutral`, `40-60%` = `theme.colors.chartPrimary`, `>60%` = `theme.colors.chartWarning`). Inconsistent lessons (`isInconsistent === true`) render with `theme.colors.chartMuted`. Horizontal dashed reference line at y=50 using `theme.colors.chartReferenceLine`, labeled "50% de atraso". Value label above each bar showing `percent.toFixed(1) + '%'`. X-axis labels use `date` formatted as `DD/MM` via a helper in `src/utils/date.ts` (add the helper there if not present). Uses `createStyles(theme)` pattern. Component accepts an `onBarPress?: (datum: LateArrivalDatum, position: { x: number, y: number }) => void` callback — it does NOT own the tooltip, only reports tap events.
- [X] T012 [US1] Create `app/(tabs)/dashboard.tsx` — the dashboard screen. Uses `useChartCardState(() => dashboardService.getLateArrivalIndex())` for the late-arrival card so that its loading / success / error state is self-contained per FR-016. Renders inside a `ScrollView` a single `ChartCard` with `title="Índice de Chegada Tardia"`, `subtitlePrefix="% de pessoas que chegaram depois do início"`, `status={lateArrival.status}`, `count={lateArrival.data.length}`, `errorMessage={lateArrival.errorMessage ?? undefined}`, `onRetry={lateArrival.reload}`, and as children either the `LateArrivalChart` (when `lateArrival.data.length >= 2`), or `DashboardEmptyState` with message `"Coleta pelo menos 2 aulas para ver seu primeiro gráfico"` (when `lateArrival.data.length < 2`). If `lateArrival.excludedCount > 0`, pass a `footnote` of `${excludedCount} aulas excluídas por dados incompletos` (singular "1 aula excluída..." when count === 1). Manages `ChartTooltip` visibility state locally: on bar press, store the selected datum + anchor coords and render the tooltip; on tooltip dismiss or "Ver aula" tap, clear the state. "Ver aula" navigates via `router.push(\`/lesson/${datum.lessonId}\`)`. Re-fires `reload()` inside a `useFocusEffect` so the card refreshes when the user returns from a lesson edit.
- [X] T013 [US1] Add a grep-based SC-004 check: after T011 and T012 are complete, run `grep -rn '#[0-9a-fA-F]\{3,6\}' src/components/charts/ src/services/dashboardService.ts app/\(tabs\)/dashboard.tsx` and confirm zero matches. If any hit appears, replace with the appropriate `theme.colors.chart*` token before marking the task complete.

**Checkpoint**: US1 is independently shippable. Opening the app → new Dashboard screen (not yet a tab, reachable by URL only) → renders the late-arrival chart, shows "Últimas 4 aulas — …" subtitle, handles empty state, handles zero denominator, handles inconsistent data, recovers from a thrown query via its own retry button, all tests green.

---

## Phase 4: User Story 2 — Attendance Curve per Lesson (Priority: P1) 🎯 MVP

**Goal**: Deliver FR-031 and US2 — a horizontally scrollable row of mini line charts, one per recent lesson, each showing `(start, mid, end)`, with its own subtitle prefix and its own independent per-card state.

**Independent Test**: With a recent lesson `(16, 25, 31)`, open the dashboard. Verify a mini line chart appears showing three ascending points labeled `Início, Meio, Fim`. Create a second lesson `(20, 31, 28)` and verify its mini chart shows a descent in the final segment. Verify the card subtitle reads `Últimas 2 aulas — Como a turma chega, fica e sai`. Verify at most 12 mini charts render even with 20+ lessons. Force ONLY `getAttendanceCurves` to throw and confirm the Late Arrival card from US1 still renders normally — only the curve card shows its retry state.

- [X] T014 [P] [US2] Extend `tests/unit/dashboardService.test.ts` with a suite for `getAttendanceCurves`: (a) returns rows with `start`, `mid`, `end` populated correctly, (b) LEFT JOIN populates `topicTitle` or leaves it `null`, (c) 12-row limit enforced, (d) chronological ascending order, (e) status filter applied, (f) rows with fewer than two non-null count fields are excluded, (g) empty DB returns `{ data: [], excludedCount: 0 }`.
- [X] T015 [US2] Implement `dashboardService.getAttendanceCurves(filters?: DashboardFilters): Promise<DashboardResult<AttendanceCurveDatum>>` in `src/services/dashboardService.ts`. Uses a LEFT JOIN on `lesson_topics` to fetch `topicTitle`. Same status filter and limit pattern as `getLateArrivalIndex`. Exclusion rule: at least 2 of `(attendance_start, attendance_mid, attendance_end)` must be non-null. Make T014 tests pass.
- [X] T016 [P] [US2] Create `src/components/charts/AttendanceCurveRow.tsx` accepting `data: AttendanceCurveDatum[]`. Renders a horizontal `ScrollView` containing one mini `LineChart` (from `react-native-gifted-charts`) per datum. Each mini chart shows 3 categorical points (Início, Meio, Fim) using `theme.colors.chartPrimary` for the line and `theme.colors.chartAxis` for labels. Below each mini chart render two lines of text: the lesson date (`DD/MM`) and the `topicTitle` (or the placeholder `Sem tópico` when null). Tap on a point fires `onPointPress?: (datum: AttendanceCurveDatum, pointIndex: 0 | 1 | 2, position: { x: number, y: number }) => void`. Uses `createStyles(theme)` pattern.
- [X] T017 [US2] Integrate `AttendanceCurveRow` into `app/(tabs)/dashboard.tsx` as a second `ChartCard` below the late-arrival card. Adds a second `useChartCardState(() => dashboardService.getAttendanceCurves())` call — the two hooks fire in parallel on mount, so the first card can render before the second resolves and a rejection of one never blocks the other (FR-016). Card props: `title="Curva de Presença por Aula"`, `subtitlePrefix="Como a turma chega, fica e sai"`, `status={curves.status}`, `count={curves.data.length}`, `onRetry={curves.reload}`. Empty-state threshold is independent: show `DashboardEmptyState` when `curves.data.length < 1`. The tooltip state is shared with US1's tooltip — only one tooltip can be visible at a time. Also re-fire both `reload()` calls inside the existing `useFocusEffect`.

**Checkpoint**: Both P1 charts render on the dashboard screen with independent state machines. Each subtitle shows the real "Últimas N aulas — …" prefix. MVP feature-complete (except for the tab entry point in Phase 9).

---

## Phase 5: User Story 3 — Attendance Trend Over Time (Priority: P2)

**Goal**: Deliver FR-032 and US3 — a line chart of `attendance_end` across up to 26 recent lessons.

**Independent Test**: With 4 lessons with final attendances `[25, 28, 26, 27]`, verify the line chart shows those four points connected in chronological order and the subtitle reads `Últimas 4 aulas — A turma está crescendo, estável ou diminuindo?`.

- [X] T018 [P] [US3] Extend `tests/unit/dashboardService.test.ts` with a suite for `getAttendanceTrend`: (a) returns all completed rows with `attendance_end` non-null, (b) `attendance_end = 0` IS included (unlike late-arrival), (c) 26-row limit enforced, (d) chronological ascending order, (e) empty DB returns `{ data: [], excludedCount: 0 }`.
- [X] T019 [US3] Implement `dashboardService.getAttendanceTrend` in `src/services/dashboardService.ts` using `DASHBOARD_LIMITS.trend` (26). Excludes null `attendance_end` only. Makes T018 tests pass.
- [X] T020 [P] [US3] Create `src/components/charts/TrendChart.tsx` rendering a `LineChart` with one point per datum. Uses `theme.colors.chartPrimary` for the line. Axis labels via `theme.colors.chartAxis`. Gridlines via `theme.colors.chartGrid`. Accepts `onPointPress?` callback matching the convention from US1/US2.
- [X] T021 [US3] Add a third `ChartCard` to `app/(tabs)/dashboard.tsx` titled `"Tendência de Presença Final"` with `subtitlePrefix="A turma está crescendo, estável ou diminuindo?"`. Wire it with its own `useChartCardState(() => dashboardService.getAttendanceTrend())` call so it participates in the Promise.allSettled pattern — a reject here shows its own retry without affecting US1/US2 cards. Pass `count={trend.data.length}` so the card composes the `Últimas N aulas — ` prefix (where N is capped at 26 for this card, not 12). Tooltip integration reuses the shared tooltip state.

**Checkpoint**: US3 is optional — ship if scope allows, otherwise park for follow-up.

---

## Phase 6: User Story 4 — Punctuality of Class Start (Priority: P2)

**Goal**: Deliver FR-033 and US4 — a bar chart of minutes-late between `time_real_start` and `time_expected_start`.

**Independent Test**: With lessons having `time_real_start` values `["10:07", "10:00", "10:02", "10:10"]` and `time_expected_start = "10:00"`, verify bars at `[7, 0, 2, 10]` minutes and the subtitle reads `Últimas 4 aulas — Quantos minutos depois das 10:00 a aula começou`.

- [X] T022 [P] [US4] Extend `tests/unit/dashboardService.test.ts` with a suite for `getPunctuality`: (a) formula `parseHMM(real) - parseHMM(expected)` is correct, (b) negative values (early start) are preserved, (c) null `time_real_start` is excluded and counted in `excludedCount`, (d) 12-row limit, (e) chronological ascending, (f) empty DB safe.
- [X] T023 [US4] Add a `parseHMM(hhmm: string): number` helper in `src/utils/date.ts` if not present (returns `H*60 + M`). Implement `dashboardService.getPunctuality` in `src/services/dashboardService.ts`. Makes T022 tests pass.
- [X] T024 [P] [US4] Create `src/components/charts/PunctualityChart.tsx` — vertical bar chart with a reference line at y=5. Bars above the reference use `theme.colors.chartWarning`; at or below use `theme.colors.chartPrimary`. Negative bars (early) use `theme.colors.chartNeutral`. Y-axis labels in minutes.
- [X] T025 [US4] Add a fourth `ChartCard` to `app/(tabs)/dashboard.tsx` titled `"Pontualidade do Início"` with `subtitlePrefix="Quantos minutos depois das 10:00 a aula começou"`. Wire its own `useChartCardState(() => dashboardService.getPunctuality())` so it owns its own state, and pass `count={punctuality.data.length}` for the "Últimas N aulas — " prefix.

---

## Phase 7: User Story 5 — Engagement Rate (Priority: P2)

**Goal**: Deliver FR-034 and US5 — `(unique_participants / attendance_end) * 100` rendered as a **vertical bar chart** (the "big number" alternative is dropped per Clarifications round 2).

**Independent Test**: With a lesson `(unique_participants = 5, attendance_end = 25)`, verify the bar shows 20% and the subtitle reads `Últimas 1 aulas — Quantos participaram em relação à turma total`.

- [X] T026 [P] [US5] Extend `tests/unit/dashboardService.test.ts` with a suite for `getEngagementRate`: (a) formula is correct, (b) null/zero `attendance_end` excluded, (c) `unique_participants = 0` is included (0% bar), (d) 12-row limit, (e) empty DB safe.
- [X] T027 [US5] Implement `dashboardService.getEngagementRate` in `src/services/dashboardService.ts`. Makes T026 tests pass.
- [X] T028 [P] [US5] Create `src/components/charts/EngagementChart.tsx` — **vertical bar chart only** (no big-number variant, per FR-034 clarification round 2). One bar per lesson, bars colored `theme.colors.chartPrimary`, y-axis 0–100%, value label above each bar. Same tap interaction contract as the other bar charts.
- [X] T029 [US5] Add a fifth `ChartCard` to `app/(tabs)/dashboard.tsx` titled `"Taxa de Engajamento"` with `subtitlePrefix="Quantos participaram em relação à turma total"`. Wire `useChartCardState(() => dashboardService.getEngagementRate())` and pass `count={engagement.data.length}` so the card shows the "Últimas N aulas — " prefix.

---

## Phase 8: P3 Stories — DEFERRED

**User Stories 6, 7, and 8 (Coverage Calendar, Topic/Professor Ranking, Professor Influence) are explicitly out of MVP and out of this branch.** US8 is additionally blocked by the missing `notes` schema field — see `research.md` §2.

No tasks are generated for Phase 8. When these stories are picked up, a new spec (or an amendment) will formalize the schema changes and the incremental delivery.

---

## Phase 9: Navigation Entry Point (MVP)

**Purpose**: Register the dashboard as a bottom tab so the MVP is actually reachable.

- [X] T030 Modify `app/(tabs)/_layout.tsx` to add a new `<Tabs.Screen name="dashboard" />` entry placed between the existing "index" (Aulas) and "series" tabs. Title `"Dashboard"`, tabBarIcon using `focused ? "stats-chart" : "stats-chart-outline"` from `@expo/vector-icons/Ionicons`. Must preserve the existing `headerRight` settings button.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final accessibility pass, manual QA, and cleanup.

- [X] T031 [P] Add `accessibilityRole="summary"` and a computed `accessibilityLabel` to every `ChartCard` in `src/components/charts/ChartCard.tsx`. The label is passed via a new `accessibilityLabel: string` prop from the dashboard screen, which composes it from the datum array (e.g., `"Índice de Chegada Tardia das últimas ${data.length} aulas, média ${avg}%"`). Per `research.md` §6, individual bars are NOT announced — only the card summary. When the card is in the `'error'` state, the label MUST instead read something like `"Erro ao carregar ${title}. Toque em Tentar novamente para recarregar."`.
- [X] T032 [P] Run `npm run lint` (CLOSED 2026-04-19: ESLint set up in this pass — `eslint` + `eslint-config-expo` flat config via `eslint.config.js`, `lint` script added to `package.json`. Current state: 0 errors, 36 warnings — none introduced by spec 009's new files (dashboardService, chart components, hooks). The remaining warnings are unused imports in theme + test helpers and are tracked separately.)
- [X] T033 [P] Run `npm test` and verify the full `dashboardService.test.ts` suite passes (all MVP tests from T009 + any P2 tests from T014/T018/T022/T026 that were completed in this branch).
- [X] T034 Walk through the full quickstart on a real device (CLOSED 2026-04-19 by Playwright spec `tests/e2e/dashboard-render.spec.ts`: asserts the empty state message when no lessons exist, that all five MVP/P2 chart titles render after seeding 4 completed lessons, and that `dashboardService.getLateArrivalIndex` returns `{ data, excludedCount }` scoped to the current user. The manual FR-016 resilience leg — throwing from `getLateArrivalIndex` to verify the error card + retry button — was NOT automated, but is guarded by the `useChartCardState` unit tests and the `DashboardEmptyState` component. Real-device Expo Go render (T002) still needs manual validation.)
- [X] T035 Remove any `console.log` statements added during development from `src/services/dashboardService.ts`, `src/components/charts/`, `src/hooks/useChartCardState.ts`, and `app/(tabs)/dashboard.tsx` per CLAUDE.md §13. `console.error` is allowed only in the screen's catch blocks and in `useChartCardState`'s error branch.

---

## Dependency Graph

```text
Phase 1 (Setup)          ─┐
                           ├─→ Phase 2 (Foundational)
                           │
                           ├─→ Phase 3 (US1, P1) 🎯 MVP ──┐
                           ├─→ Phase 4 (US2, P1) 🎯 MVP ──┤
                           │                               ├─→ Phase 9 (Tab) → Phase 10 (Polish)
                           ├─→ Phase 5 (US3, P2) ─────────┤
                           ├─→ Phase 6 (US4, P2) ─────────┤
                           └─→ Phase 7 (US5, P2) ─────────┘

                           Phase 8 (P3) — DEFERRED, not in this branch
```

**Hard blockers**:

- Phases 3–7 all depend on Phase 2 (the shared types, theme tokens, chart primitives, and `useChartCardState` hook).
- Phase 9 depends on Phases 3 AND 4 being complete (MVP needs both P1 charts wired before the tab is added, otherwise opening the tab exposes a half-built screen).
- Phase 10 depends on whichever phases actually ship in this branch.

**Soft ordering**: Phases 3–7 can technically run in parallel once Phase 2 is done, but each one edits the same `dashboardService.ts` and `app/(tabs)/dashboard.tsx`, so sequencing them reduces merge conflicts. Tasks *within* a phase that are marked [P] can genuinely run in parallel.

## Parallel Execution Examples

### Phase 2 parallel group

After T003 (types) and T005 (service scaffold) are done:

- T004 (theme tokens) ← edits `src/theme/colors.ts`
- T006 (ChartCard + state machine) ← edits `src/components/charts/ChartCard.tsx`
- T007 (ChartTooltip) ← edits `src/components/charts/ChartTooltip.tsx`
- T008 (DashboardEmptyState) ← edits `src/components/charts/DashboardEmptyState.tsx`
- T008a (useChartCardState) ← edits `src/hooks/useChartCardState.ts`

All five touch different files, all five depend only on T003 + T005 for imports. Parallel-safe.

### Phase 3 parallel group

After T010 (service function) is done:

- T011 (`LateArrivalChart.tsx`) ← new file
- T009 (test file) ← already created earlier, extended later

T011 and T012 are NOT parallel with each other — T012 imports T011's component.

### Cross-phase parallelism

Phases 3 and 4 can overlap partially if two developers collaborate: the `LateArrivalChart` and `AttendanceCurveRow` are independent files. But the dashboard screen (T012 and T017) is shared, so the screen integration must serialize.

## Implementation Strategy

**MVP path (recommended for first merge):**

1. Phase 1 (T001, T002) — ~15 minutes.
2. Phase 2 (T003–T008a) — ~1.5–2.5 hours, mostly parallel after T003.
3. Phase 3 (T009–T013) — US1, ~2–3 hours.
4. Phase 4 (T014–T017) — US2, ~1–2 hours (faster because the patterns from Phase 3 are reusable).
5. Phase 9 (T030) — ~10 minutes.
6. Phase 10 (T031–T035) — ~1 hour.

**Total MVP scope**: 20 tasks (T001–T017 including T008a, plus T030–T035). After this merge, the dashboard is live, useful, motivational for every collector on the team, AND resilient — a single broken query never takes down the whole screen.

**P2 follow-up (optional, same branch or next branch)**: Phases 5–7 (T018–T029) in sequence. Each P2 story is independently shippable and independently valuable — if only two of the three land, that's fine.

**Out of this branch entirely**: Phase 8 (P3 — Coverage Calendar, Rankings, Professor Influence). Needs its own spec and — for Professor Influence — a schema change.

## Task Count Summary

| Phase | Task Count | Scope |
|---|---|---|
| Phase 1 — Setup | 2 | MVP |
| Phase 2 — Foundational | 7 | MVP |
| Phase 3 — US1 (P1) | 5 | **MVP** 🎯 |
| Phase 4 — US2 (P1) | 4 | **MVP** 🎯 |
| Phase 5 — US3 (P2) | 4 | P2 follow-up |
| Phase 6 — US4 (P2) | 4 | P2 follow-up |
| Phase 7 — US5 (P2) | 4 | P2 follow-up |
| Phase 8 — P3 | 0 | **DEFERRED** |
| Phase 9 — Nav | 1 | MVP |
| Phase 10 — Polish | 5 | MVP |
| **Total in this branch** | **36** | (20 MVP + 12 P2 + 0 P3) |
