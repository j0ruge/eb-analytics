# Implementation Plan: Statistics Dashboard

**Branch**: `009-statistics-dashboard` | **Date**: 2026-04-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/009-statistics-dashboard/spec.md`

## Summary

Add an in-app **Statistics Dashboard** that visualizes locally collected lesson data as a handful of motivational charts. The primary goal is to close the feedback loop for collectors: "your counting work tells a story". The MVP ships **P1 only** — Late Arrival Index (FR-030) and Attendance Curve (FR-031) — behind a new bottom-tab entry point. P2 charts (Trend, Punctuality, Engagement) ship as a follow-up slice within the same branch if scope allows. P3 charts (Coverage Calendar, Rankings, Professor Influence) are explicitly out of MVP and remain deferred.

The technical approach is purely client-side: a new `dashboardService` computes derived datasets from `lessons_data` via parameterized SQL, a new `app/(tabs)/dashboard.tsx` renders chart cards, and chart colors are added as semantic tokens to the existing theme system. No backend, no schema migration, no new dependencies beyond a single chart library.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), React 19.1, React Native 0.81.5
**Primary Dependencies**: Expo SDK 54, Expo Router 6, expo-sqlite 16, react-native-reanimated 4.1, react-native-svg (to be added), **react-native-gifted-charts (to be added)** — see `research.md`
**Storage**: local SQLite (`lessons_data` table, read-only for this feature)
**Testing**: Jest + jest-expo, @testing-library/react-native
**Target Platform**: Android + iOS via Expo Go and standalone builds
**Project Type**: Mobile (single Expo project, file-based routing under `app/`)
**Performance Goals**: Dashboard opens without a visible loading spinner for datasets up to ~200 lessons (well above realistic one-year volume of ~52)
**Constraints**: 100% offline; no hardcoded colors (all theme tokens); all charts MUST match FR-015 tooltip interaction pattern; dataset queries MUST be capped at 12/26 most recent lessons per FR-030..034
**Scale/Scope**: MVP = 2 charts (P1), ~6 new files, ~1 new tab, ~6 new theme color tokens. No new DB tables, no migrations.

## Constitution Check

Gates derived from `.specify/memory/constitution.md` (v1.0.0):

| Principle | Status | Notes |
|---|---|---|
| **I. Local-First Architecture** | ✅ PASS | Dashboard reads SQLite only. No network calls. Works offline day one. |
| **II. Zero-Friction UX** | ✅ PASS | No text entry in the dashboard flow. Interaction is limited to scroll + tap (FR-015 tooltip). |
| **III. Auto-Save & Fail-Safe** | ➖ N/A | Dashboard is read-only; no state is mutated. |
| **IV. Backward Compatibility** | ✅ PASS | No schema migration. Existing lessons appear in the dashboard without any data transformation. |
| **V. Separation of Concerns** | ✅ PASS | New `dashboardService` owns all SQL + aggregation. Screen `app/(tabs)/dashboard.tsx` only consumes prepared datasets. Chart components live under `src/components/charts/`. Theme tokens under `src/theme/colors.ts`. |

**Quality Gates (Pre-Implementation)**:

- [x] Feature specification approved (draft status, clarifications resolved 2026-04-11)
- [x] Clarifications resolved (4 Qs answered in spec session)
- [x] Data migration plan: **none needed** — see Complexity Tracking for the one FR-037 caveat

**Verdict**: All gates pass. No constitution violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/009-statistics-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0: chart library selection, schema gap analysis
├── data-model.md        # Phase 1: derived datum types, computation contracts
├── quickstart.md        # Phase 1: how to run and verify the dashboard locally
├── contracts/
│   └── dashboard-service.md  # Phase 1: TypeScript API surface of dashboardService
└── spec.md              # (existing) feature specification
```

### Source Code (repository root)

Only the new or touched paths are listed. Existing files are referenced where relevant.

```text
app/
└── (tabs)/
    ├── _layout.tsx          # MODIFIED — register new Dashboard tab between "Aulas" and "Séries"
    └── dashboard.tsx        # NEW — dashboard screen, chart cards stacked vertically

src/
├── components/
│   └── charts/              # NEW directory — small, focused chart primitives
│       ├── LateArrivalChart.tsx      # NEW (P1) — vertical bar chart for FR-030
│       ├── AttendanceCurveRow.tsx    # NEW (P1) — horizontal scroll of mini line charts for FR-031
│       ├── ChartCard.tsx             # NEW — shared card wrapper (title, subtitle, slot)
│       └── ChartTooltip.tsx          # NEW — shared FR-015 inline tooltip popover
├── services/
│   └── dashboardService.ts  # NEW — object literal service, pure async functions per chart
├── theme/
│   └── colors.ts            # MODIFIED — add chart* semantic tokens (see research.md §3)
└── types/
    └── dashboard.ts         # NEW — derived datum interfaces + DashboardFilters

tests/
└── unit/
    └── dashboardService.test.ts  # NEW — arithmetic, edge cases (zero, null, missing fields), limits, status filter
```

**Structure Decision**: Single Expo project (Option 1 from the template's "Mobile" variant, adapted — there is no separate API backend for this feature). All new code lives under the existing `app/` and `src/` trees, no new top-level directories. The `src/components/charts/` subdirectory is new but follows the established "one component per file" rule from CLAUDE.md §15.

## Phase 0 — Research

See [`research.md`](./research.md) for the full analysis. Summary of decisions:

1. **Chart library: `react-native-gifted-charts`** (with `react-native-svg` as its peer dep). Chosen over `victory-native` XL because it does not require `@shopify/react-native-skia` or a config plugin — keeping Expo Go compatibility and zero-friction onboarding for the team. Alternatives considered: victory-native XL, react-native-chart-kit, react-native-svg with hand-drawn charts.
2. **Schema gap for FR-037 (Professor Influence)**: the `lessons_data` table has **no `notes` column**. Since FR-037 is P3 and deferred past MVP, no action is needed now. The schema gap is documented as a pre-condition for any future attempt to ship FR-037 (either add the column via a migration in a later spec, or change the detection mechanism).
3. **Auth filtering (FR-023)**: spec 006 has not shipped. The MVP falls through to the "show all local lessons" branch with no user filter, exactly as EC-005 permits.
4. **Entry point (FR-001)**: a new bottom tab `Dashboard` is added to `app/(tabs)/_layout.tsx` between **Aulas** and **Séries**, with icon `stats-chart` / `stats-chart-outline`. This is the only decision taken for the "exact entry point" deferral in FR-001.

## Phase 1 — Design & Contracts

### Data Model

See [`data-model.md`](./data-model.md). All entities are derived, in-memory shapes computed from `lessons_data`. No new persistent entities, no migrations.

### Service Contract

See [`contracts/dashboard-service.md`](./contracts/dashboard-service.md) for the full TypeScript surface of `dashboardService`. The service exposes one pure async function per chart, each taking `DashboardFilters` and returning an array of the corresponding datum type. All functions enforce the FR-022 status filter (`IN_PROGRESS` excluded), the per-chart limits from FR-030..034, and the per-chart exclusion rules from EC-002.

### Quickstart

See [`quickstart.md`](./quickstart.md) for the verification walkthrough: seed the dev DB, open the app, navigate to the new tab, verify both P1 charts render, and verify empty / single-lesson / zero-denominator edge cases.

### Agent Context Update

`CLAUDE.md` already documents the full project conventions and references this spec indirectly via `specs/`. No additional agent-context file updates are required — the constitution plus existing CLAUDE.md cover everything a future agent would need to continue this work.

## Post-Design Constitution Re-Check

Re-evaluating after Phase 0/1 artifacts are drafted:

- **Local-First**: still ✅. The library choice (gifted-charts) has no runtime network calls.
- **Zero-Friction UX**: still ✅. FR-015 tooltip is tap-only, no text entry.
- **Separation of Concerns**: still ✅. The screen does not touch `getDatabase()`; all SQL is in `dashboardService`.
- **Backward Compatibility**: still ✅. No schema changes.
- **Quality Gates**: all pass.

**Verdict**: Post-design re-check clean. Ready for `/speckit.tasks`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| FR-037 (Professor Influence) references a `notes` field that doesn't exist in `lessons_data` | The spec preserves the analytical intent as a P3 goal; dropping it now would lose stakeholder-requested analysis | Adding a `notes` column just for a P3/deferred chart would violate "don't design for hypothetical future requirements" (CLAUDE.md). Kept deferred; schema change deferred with it. |

No other violations. No new dependencies beyond the single chart library, which is the minimum viable addition for this feature.
