# Implementation Plan: Export Data Contract v2

**Branch**: `005-export-contract-v2` | **Date**: 2026-04-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-export-contract-v2/spec.md`

## Summary

Substituir o formato de exportação JSON v1 (despejo direto das linhas de `lessons_data`) por um **envelope v2** com `schema_version: "2.0"`, `client { app_version, device_id }`, `collector: null` e um array `collections[]` onde cada item carrega XOR entre IDs de catálogo e fallbacks de texto livre, mais `attendance.includes_professor`, `client_updated_at`, `weather` e `notes`. A mudança viabiliza os specs 006 (auth), 007 (backend) e 008 (sync cliente) sem acoplá-los a 005 — este spec é standalone-deliverable e o JSON continua sendo compartilhado apenas via OS share sheet.

**Abordagem técnica**: migração idempotente (`ALTER TABLE ADD COLUMN` + backfill) sobre a tabela `lessons_data`, enforcement de XOR no write-path (`lessonService.createLesson`/`updateLesson`), reescrita completa do `exportService` para montar o envelope v2, dois novos helpers (`deviceIdService`, `useIncludesProfessorDefault`) seguindo o padrão `useThemePreference`, UI mínima no `app/lesson/[id].tsx` (Switch + card "Observações") e em `app/settings.tsx` (seção "Padrões"), e extensão do `seedService` para escrever os novos campos a partir do JSON de seed existente. Nenhuma nova dependência externa — tudo via pacotes já presentes no `package.json`.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode)
**Primary Dependencies**:
- `expo` SDK 54
- `expo-router` 6.x (file-based routing)
- `expo-sqlite` 16.x (local storage, WAL mode)
- `expo-constants` (reads `app.json` version for `client.app_version`)
- `expo-file-system` + `expo-sharing` (already used by v1 export)
- `@react-native-async-storage/async-storage` 2.2 (existing `@eb-insights/*` key conventions)
- `react-native-get-random-values` + `uuid` 9.x (UUID v4, already used by `lessonService`/`professorService`)
- `react-native-reanimated` (animations, not touched in 005)

**Storage**: SQLite via `expo-sqlite` 16.x. Single database file. Tables touched: `lessons_data` (new columns added), `lesson_topics` and `lesson_series` (read-only JOIN for series resolution). Migrations via `PRAGMA table_info` + `ALTER TABLE ADD COLUMN`, idempotent pattern already established in `src/db/client.ts`.

**Testing**: Jest 29.x + `jest-expo` preset. Unit tests under `tests/unit/`. New test files for this feature: `tests/unit/exportService.test.ts`, `tests/unit/lessonService.test.ts`. The existing `tests/unit/seedService.test.ts` already mocks `expo-sqlite` and `react-native-get-random-values` — that mock scaffolding is reused.

**Target Platform**: iOS 15+ / Android 8+ via Expo Go and standalone builds. pt-BR only (no i18n layer).

**Project Type**: Mobile single-project (React Native + Expo). No backend component in 005 — everything runs on-device.

**Performance Goals**: Export generation must complete in under 500ms for a typical batch of ≤ 50 lessons (church's realistic maximum over one semester). No p95 latency SLOs — this is an interactive action triggered by a tap, not a background job.

**Constraints**:
- Strictly offline-capable (Constitution I — Local-First). No network call anywhere in the 005 code path.
- Must not regress the anonymous (no-login) flow (SC-003).
- Migration must preserve every existing row (SC-007, Constitution IV).
- Must not introduce new runtime dependencies — every tool needed is already in `package.json`.
- Re-export must be idempotent at the `collections[].id` level (SC-006).

**Scale/Scope**: Per-installation data set. Typical collector produces 20–50 completed lessons per semester. Device storage pressure is irrelevant. A single export file stays well under 1 MB in realistic scenarios.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Justification |
|---|---|---|
| **I. Local-First Architecture** | ✅ PASS | 005 adds zero network code paths. Export still happens via local file + share sheet. `collector: null` means even the logged-out flow is perfectly functional. `deviceIdService` uses AsyncStorage (local). No remote call anywhere. |
| **II. Zero-Friction UX** | ✅ PASS | `includes_professor` is a single Switch toggle (one tap). `weather` is a short single-line TextInput and `notes` is multi-line TextInput — both nullable, not required to complete a lesson. The default toggle in Settings means most collectors touch the per-lesson toggle zero times. CounterSteppers are unchanged. No new keyboard-heavy flows. |
| **III. Auto-Save & Fail-Safe** | ✅ PASS | The three new fields (`includes_professor`, `weather`, `notes`) are wired into the existing `useDebounce(lesson, 500)` pattern already used by Lesson Detail. No explicit save button. `client_updated_at` is touched on every `updateLesson` call, so crash recovery for in-progress lessons continues to work identically. |
| **IV. Backward Compatibility** | ✅ PASS | All new columns (`includes_professor`, `client_updated_at`, `weather`, `notes`) have safe defaults (0 / NULL). The migration backfills `client_updated_at = created_at` so every pre-existing row has a valid timestamp post-migration. Legacy columns (`professor_name`, `series_name`, `lesson_title`) are preserved but stop being written when the corresponding `*_id` is populated. The `EXPORTED` status enum value is preserved in the schema CHECK constraint even though the code stops writing it (existing `EXPORTED` rows stay valid). Migration is idempotent via `PRAGMA table_info`. |
| **V. Separation of Concerns** | ✅ PASS | Plan respects the `types/ → db/ → services/ → components/ → app/` layering. `exportService` only knows about `lessonService` and two helpers (`deviceIdService`, `expo-constants`); it never touches SQLite directly. `lessonService` stays DB-bound with no UI imports. The new Lesson Detail inputs delegate persistence to the existing `updateField` pattern, never to `getDatabase()`. New `Toggle` component (if extracted) lives in `src/components/`; new `useIncludesProfessorDefault` lives in `src/hooks/`. |

**Gate verdict**: ✅ All five principles satisfied, no violations. No Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/005-export-contract-v2/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output — design decisions and alternatives
├── data-model.md        # Phase 1 output — SQLite + payload shape
├── quickstart.md        # Phase 1 output — manual verification script
├── contracts/           # Phase 1 output
│   └── export-envelope.v2.schema.json   # JSON Schema for the v2 payload
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit.specify)
├── spec.md              # Feature specification (updated by /speckit.clarify)
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
app/
├── (tabs)/
│   └── sync.tsx                        # MODIFIED: remove "status atualizado para EXPORTED" message
├── lesson/
│   └── [id].tsx                        # MODIFIED: add includes_professor Switch + Observações card
└── settings.tsx                        # MODIFIED: add "Padrões" section with default toggle

src/
├── types/
│   └── lesson.ts                       # MODIFIED: extend Lesson interface with 4 new fields
├── db/
│   ├── schema.ts                       # MODIFIED: extend CREATE_LESSONS_TABLE with 4 new columns (fresh installs)
│   └── client.ts                       # MODIFIED: new migration steps with PRAGMA table_info + backfill
├── services/
│   ├── lessonService.ts                # MODIFIED: XOR enforcement in createLesson; client_updated_at touch in updateLesson
│   ├── exportService.ts                # REWRITTEN: v2 envelope
│   ├── seedService.ts                  # MODIFIED: persist includes_professor + notes from JSON
│   └── deviceIdService.ts              # NEW: idempotent UUID v4 generator backed by AsyncStorage
├── hooks/
│   └── useIncludesProfessorDefault.ts  # NEW: AsyncStorage-backed boolean preference (useThemePreference pattern)
└── components/
    └── (no new components for 005)      # Dashboard components below belong to spec 009

tests/
└── unit/
    ├── exportService.test.ts           # NEW: envelope shape, XOR, empty guard, re-export stability, device_id
    └── lessonService.test.ts           # NEW: XOR in createLesson, client_updated_at touch in updateLesson
```

**Structure Decision**: Single-project mobile app (React Native + Expo Router 6). This feature makes pure additive changes to the existing `src/` and `app/` trees, plus two new unit test files. No new top-level directories, no workspace splits, no new packages. The layering specified in Constitution Principle V is preserved: new types go in `src/types/`, new migrations in `src/db/`, new services in `src/services/`, new hooks in `src/hooks/`, and screen modifications stay inside `app/`.

## Complexity Tracking

> Constitution Check passed with zero violations. No complexity to track.
