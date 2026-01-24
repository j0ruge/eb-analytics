# Implementation Plan: Lesson Data Collection Flow

**Branch**: `001-lesson-collection` | **Date**: 2026-01-24 | **Spec**: [specs/001-lesson-collection/spec.md](../spec.md)
**Input**: Feature specification from `specs/001-lesson-collection/spec.md`

## Summary

Implement the core "Local-First" data collection flow for EBD Insights. This includes setting up the SQLite database schema, creating the "New Lesson" entry point, building the 3-stage Lesson Form (Start, Mid, End) with "Zero Typing" controls (Steppers, Time Capture), and establishing the "Auto-Save" mechanism to ensure data persistence. Finally, implement the JSON export for completed lessons.

## Technical Context

**Language/Version**: TypeScript (Strict Mode)
**Primary Dependencies**: React Native, Expo SDK, Expo Router, `expo-sqlite` (using `expo-sqlite/next` API or latest equivalent), `expo-file-system`, `expo-sharing`.
**Storage**: SQLite (Local device storage via `expo-sqlite`).
**Testing**: Jest (Unit/Integration for Logic/Components).
**Target Platform**: Mobile (Android/iOS) via Expo Go.
**Project Type**: Mobile Application.
**Performance Goals**: Database writes < 100ms (debounced 500ms), App cold start to interactive form < 2s.
**Constraints**: Offline-first mandatory, No heavy UI libraries (Native StyleSheet only).
**Scale/Scope**: ~3 Screens, 1 Database Table, ~1000 LOC.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Local-First Architecture**: ✅ PASS. Design centers on SQLite `lessons_data` table as single source of truth.
- **II. Minimalism & Native-First**: ✅ PASS. UI uses `StyleSheet`, standard `View`/`Text`, and custom lightweight components (`CounterStepper`).
- **III. Fail-Safe UX**: ✅ PASS. Auto-save mechanism on every field change ensures state recovery.
- **IV. Decoupled Export Strategy**: ✅ PASS. Export is a separate "Coordinator" action generating JSON from `COMPLETED` records.
- **V. Zero-Friction UX**: ✅ PASS. Steppers and Time Capture buttons replace manual typing.

## Project Structure

### Documentation (this feature)

```text
specs/001-lesson-collection/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A - Local DB, but Schema definition goes here)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
app/
├── index.tsx                # Home Screen (List of lessons)
├── _layout.tsx              # Expo Router Root Layout
├── lesson/
│   ├── new.tsx              # "New Lesson" Controller
│   └── [id].tsx             # Lesson Form Screen
├── sync/
│   └── index.tsx            # Export/Sync Screen

src/
├── components/              # Reusable UI Components
│   ├── CounterStepper.tsx   # [ - ] Value [ + ]
│   └── TimeCaptureButton.tsx # [ Capture Time ]
├── db/
│   ├── schema.ts            # Table definitions
│   └── client.ts            # SQLite client wrapper
├── services/
│   └── lessonService.ts     # Business logic (create, update, export)
└── theme/
    └── index.ts             # Shared styles/colors (Minimalist)

tests/
├── unit/                    # Component/Service tests
└── integration/             # Database flow tests
```

**Structure Decision**: Standard Expo Router `app/` directory for navigation, with business logic and UI components separated in `src/` to maintain clean separation of concerns. `src/db` encapsulates all SQLite interactions.

## Complexity Tracking

*No violations.*