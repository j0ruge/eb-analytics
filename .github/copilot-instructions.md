# EB Insights - Copilot Instructions

## Project Overview

Local-first mobile app (Expo/React Native) for collecting Sunday School attendance data. SQLite is the **single source of truth** - no cloud dependency.

## Architecture Principles

1. **Local-First**: All data persists to SQLite via `expo-sqlite`. Never assume network availability.
2. **Auto-Save**: Every field change triggers debounced (500ms) persistence. See [useDebounce](../src/hooks/useDebounce.ts) pattern in [lesson/[id].tsx](../app/lesson/%5Bid%5D.tsx).
3. **Zero-Friction UX**: Prefer tap controls (`CounterStepper`, `TimeCaptureButton`) over keyboard input.
4. **Minimalist UI**: Use native `StyleSheet` only. Import shared values from [src/theme/index.ts](../src/theme/index.ts).

## Key Patterns

### Database Layer

- Schema definitions: [src/db/schema.ts](../src/db/schema.ts) - raw SQL strings
- Client singleton: [src/db/client.ts](../src/db/client.ts) - `getDatabase()` returns cached connection
- Always use parameterized queries (`?` placeholders) to prevent SQL injection

### Service Layer

- Business logic lives in `src/services/` (e.g., [lessonService.ts](../src/services/lessonService.ts))
- Services call `getDatabase()` directly; screens call services
- Pattern: `lessonService.createLesson()` → uses "smart defaults" from last lesson

### Type Definitions

- [src/types/lesson.ts](../src/types/lesson.ts) defines `Lesson` interface and `LessonStatus` enum
- Status flow: `IN_PROGRESS` → `COMPLETED` → `SYNCED`

### Component Conventions

- Reusable components in `src/components/` with `Props` interface
- Always support `disabled` prop for form controls
- Use theme tokens: `theme.colors.primary`, `theme.spacing.md`, etc.

## File Structure Rules

```
app/           → Expo Router screens (navigation)
src/components → Reusable UI components
src/db         → Database schema + client
src/services   → Business logic (CRUD, export)
src/hooks      → Custom React hooks
src/types      → TypeScript interfaces/enums
specs/         → Feature specifications and plans
```

## Commands

```bash
npm start      # Start Expo dev server
npm run android/ios  # Platform-specific launch
npm test       # Run Jest tests
```

## Common Tasks

**Adding a new field to Lesson:**

1. Update interface in `src/types/lesson.ts`
2. Add column to SQL in `src/db/schema.ts`
3. Update service methods in `src/services/lessonService.ts`
4. Add UI control in `app/lesson/[id].tsx`

**Creating a new screen:**

1. Add file in `app/` directory (Expo Router file-based routing)
2. Register in [app/\_layout.tsx](../app/_layout.tsx) with `Stack.Screen`

## Language Conventions

- **Code**: English (variables, functions, comments, commit messages)
- **UI strings**: Portuguese (pt-BR) - all user-facing text in screens
- Example: `const lessonTitle = "..."` but displays "Título da Lição" to user

## Testing

- Framework: Jest with `jest-expo` preset
- Test location: `tests/unit/` for unit tests, `tests/integration/` for DB flows
- Run: `npm test`
- Service methods should be unit-testable (mock `getDatabase()`)
- Components: test props behavior and callbacks

## Sync Status (Future Work)

The `SYNCED` status in `LessonStatus` enum is reserved for future cloud sync. Current implementation:

- Export: JSON file via `expo-sharing` (see [exportService.ts](../src/services/exportService.ts))
- Online API: Not yet implemented - sync workflow pending backend development

## Spec Driven Development (speckit)

This project follows **Spec Driven Development** using the speckit methodology. See [speck-kit.md](../speck-kit.md) for commands.

**Workflow:**

1. `/speckit.constitution` → Defines project principles and stack (already established)
2. `/speckit.specify` → Details schemas, screens, and business rules
3. `/speckit.plan` → Creates milestone-based delivery schedule

**Spec Structure per Feature:**

```
specs/{feature-id}/
├── spec.md          # Feature specification
├── plan.md          # Implementation plan with milestones
├── tasks.md         # Granular task breakdown
├── data-model.md    # Schema and type definitions
├── research.md      # Technical research notes
├── quickstart.md    # Quick reference
├── checklists/      # Validation checklists
└── contracts/       # API/Schema contracts
```

**Key Rule:** Always consult `specs/` before implementing a feature. The spec is the source of truth for requirements.

## Specs Reference

Feature planning docs live in `specs/001-lesson-collection/`. Check [plan.md](../specs/001-lesson-collection/plan.md) for implementation context.
