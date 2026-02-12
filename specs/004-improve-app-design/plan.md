# Implementation Plan: Improve App Design

**Branch**: `004-improve-app-design` | **Date**: 2026-02-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-improve-app-design/spec.md`

## Summary

Overhaul the EB Insights app's visual design by implementing a complete design system (typography, shadows, semantic color tokens for light/dark), restructuring navigation from a flat Stack to tab-based layout with expo-router Tabs, adding icons via `@expo/vector-icons`, introducing press feedback and screen transition animations via `react-native-reanimated`, and standardizing all 13 screens and 7 components to use design tokens. Includes an in-app theme toggle (Light/Dark/System) with persistence, WCAG AA contrast compliance, improved empty states, and skeleton loaders. All UI labels remain in Portuguese (PT-BR).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode)
**Primary Dependencies**: React Native 0.81.5, Expo SDK 54, Expo Router 6.x, expo-sqlite 16.x
**New Dependencies**: `@expo/vector-icons` (icons), `react-native-reanimated` (animations), `expo-async-storage` or `@react-native-async-storage/async-storage` (theme preference persistence)
**Storage**: SQLite via expo-sqlite (existing, unchanged); AsyncStorage for theme preference only
**Testing**: Jest 29.x + jest-expo 54.x + @testing-library/react-native 13.x
**Target Platform**: iOS + Android via Expo Go (no custom dev client)
**Project Type**: Mobile (React Native + Expo)
**Performance Goals**: 60fps animations, <100ms press feedback, smooth screen transitions
**Constraints**: Must run in Expo Go (no native modules outside Expo ecosystem); portrait-only; all existing CRUD/export/sync features preserved identically; PT-BR labels
**Scale/Scope**: 13 screens, 7 components, 1 theme file, 1 layout file, 5 services (unchanged)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Local-First Architecture | PASS | No changes to data layer. Theme preference stored locally (AsyncStorage). No network dependency added. |
| II. Zero-Friction UX | PASS | Tab navigation reduces taps to reach sections. Existing pickers/steppers preserved. No new text inputs added. |
| III. Auto-Save & Fail-Safe | PASS | Auto-save behavior unchanged. Theme toggle persists automatically. |
| IV. Backward Compatibility | PASS | No schema changes. No data migrations needed. |
| V. Separation of Concerns | PASS | Theme system lives in `src/theme/`. New hooks in `src/hooks/`. Navigation in `app/`. Components don't access DB. |
| Tech Stack Alignment | PASS | Expo SDK 54, Expo Router 6, TypeScript 5.9 all match constitution. New deps (`@expo/vector-icons`, `react-native-reanimated`) are Expo-native packages. |

**Pre-Implementation Gates:**
- [x] Feature specification (spec.md) approved
- [x] Clarifications resolved (5/5 via `/speckit.clarify`)
- [x] No data migrations needed

**Result: ALL GATES PASS** — no violations, no complexity tracking needed.

## Project Structure

### Documentation (this feature)

```text
specs/004-improve-app-design/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (theme token structure)
├── quickstart.md        # Phase 1 output (setup guide)
├── checklists/
│   └── requirements.md  # Quality checklist
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── theme/
│   ├── index.ts         # EXPAND: full design system (colors, typography, spacing, shadows, tokens)
│   ├── colors.ts        # NEW: light + dark color palettes with semantic tokens
│   ├── typography.ts    # NEW: typography scale (5+ sizes with weights/lineHeights)
│   ├── shadows.ts       # NEW: cross-platform shadow/elevation presets
│   └── ThemeProvider.tsx # NEW: React context for theme (useColorScheme + manual override)
├── hooks/
│   ├── useDebounce.ts   # EXISTING: unchanged
│   ├── useTheme.ts      # NEW: hook to consume theme context
│   └── useThemePreference.ts # NEW: hook for persisted theme toggle (Light/Dark/System)
├── components/
│   ├── CounterStepper.tsx    # UPDATE: use design tokens
│   ├── DatePickerInput.tsx   # UPDATE: use design tokens
│   ├── ProfessorPicker.tsx   # UPDATE: use design tokens + icons
│   ├── SeriesPicker.tsx      # UPDATE: use design tokens + icons
│   ├── StatusFilterBar.tsx   # UPDATE: use design tokens
│   ├── TimeCaptureButton.tsx # UPDATE: use design tokens + icons
│   ├── TopicPicker.tsx       # UPDATE: use design tokens + icons
│   ├── EmptyState.tsx        # NEW: reusable empty state component (icon + message + CTA)
│   ├── FAB.tsx               # NEW: standardized floating action button with icon
│   ├── SkeletonLoader.tsx    # NEW: skeleton placeholder component
│   └── ErrorRetry.tsx        # NEW: inline error with "Tentar novamente" retry button
├── services/                  # UNCHANGED (5 services)
├── db/                        # UNCHANGED
├── types/                     # UNCHANGED
└── utils/                     # UNCHANGED

app/
├── (tabs)/                    # NEW: tab group for bottom navigation
│   ├── _layout.tsx            # NEW: Tab navigator layout (Aulas, Séries, Professores, Sincronizar)
│   ├── index.tsx              # MOVE: lessons list (home → tab)
│   ├── series/
│   │   └── index.tsx          # MOVE: series list → tab
│   ├── professors/
│   │   └── index.tsx          # MOVE: professors list → tab
│   └── sync/
│       └── index.tsx          # MOVE: sync screen → tab
├── _layout.tsx                # UPDATE: root Stack wrapping tab group
├── lesson/
│   ├── [id].tsx               # UPDATE: use design tokens + icons
│   └── new.tsx                # UPDATE: use design tokens
├── series/
│   ├── [id].tsx               # UPDATE: use design tokens + icons
│   └── new.tsx                # UPDATE: use design tokens
├── professors/
│   ├── [id].tsx               # UPDATE: use design tokens + icons
│   └── new.tsx                # UPDATE: use design tokens
├── topics/
│   ├── [id].tsx               # UPDATE: use design tokens + icons
│   └── new.tsx                # UPDATE: use design tokens
└── settings.tsx               # NEW: theme toggle screen (Light/Dark/System)
```

**Structure Decision**: Expo Router file-based tabs via `app/(tabs)/` group. Root layout wraps a Stack that contains the tab group as the initial route plus detail/create screens as modal or push routes. This preserves existing URL patterns while adding tab navigation.

## Complexity Tracking

> No constitution violations — this section is empty.
