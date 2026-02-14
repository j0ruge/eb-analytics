# EB Insights — Project Rules & Coding Standards

## Project Overview

- **Stack**: React Native 0.81 + Expo SDK 54 + Expo Router 6 + TypeScript 5.9 (strict) + SQLite (expo-sqlite 16)
- **Architecture**: Local-first, offline-first mobile app
- **Language**: UI text and error messages in Brazilian Portuguese (pt-BR)
- **Path Alias**: Use `@/` for imports from `src/` (e.g., `@/hooks/useTheme`)

## Commands

- `npm test` — run unit tests (Jest)
- `npm run lint` — lint the codebase
- `npm start` — start Expo dev server

---

## 1. TypeScript & Type Safety

- **Strict mode is mandatory** — never use `any` unless absolutely unavoidable (and add a `// TODO` explaining why)
- Prefer `interface` for object shapes, `type` for unions and intersections
- Use `enum` for finite sets of values (e.g., `LessonStatus`). Always use UPPERCASE_SNAKE_CASE for enum values
- Use `Record<K, V>` for typed key-value mappings instead of plain objects
- Mark nullable fields explicitly with `| null`, never use `undefined` for database fields
- Use generics for reusable hooks and utilities (e.g., `useDebounce<T>`)
- Prefer `Partial<T>` for update operations, full interfaces for creation

```typescript
// Good
interface Professor {
  id: string;
  doc_id: string;
  name: string;
  created_at: string;
}

// Good — nullable DB field
professor_id: string | null;

// Bad — avoid any
const data: any = fetchData();
```

---

## 2. Component Patterns

Every component follows this order:

```typescript
// 1. Imports (React → React Native → External libs → Local)
import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Theme } from "@/theme";

// 2. Props Interface (named {ComponentName}Props)
interface MyComponentProps {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
}

// 3. Component (named export, functional only)
export function MyComponent({ title, onPress, disabled }: MyComponentProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

// 4. Style factory (always at the bottom, outside the component)
const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
    },
    title: {
      ...theme.typography.h3,
      color: theme.colors.text,
    },
  });
```

### Rules

- **Always** use `StyleSheet.create()` — never inline styles except for dynamic values
- **Always** wrap styles in `useMemo(() => createStyles(theme), [theme])` for theme reactivity
- Use `createStyles(theme: Theme)` as a factory function at the bottom of the file
- Use theme tokens for **all** values: colors, spacing, typography, borderRadius, shadows
- Never hardcode colors, font sizes, or spacing values — use `theme.colors.*`, `theme.spacing.*`, `theme.typography.*`
- Prefer named exports over default exports for components
- Extend React Native primitives when building reusable components (e.g., `Omit<PressableProps, "style">`)

---

## 3. Import Order

Maintain consistent import grouping (separated by blank lines):

```typescript
// 1. React core
import React, { useState, useEffect, useMemo, useCallback } from "react";

// 2. React Native core
import { View, Text, StyleSheet, FlatList, Alert } from "react-native";

// 3. External libraries (Expo, Reanimated, etc.)
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useSharedValue, withSpring } from "react-native-reanimated";

// 4. Local imports (using @/ alias)
import { useTheme } from "@/hooks/useTheme";
import { lessonService } from "@/services/lessonService";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { LessonStatus, STATUS_LABELS } from "@/types/lesson";
import { Theme } from "@/theme";
```

---

## 4. Naming Conventions

| Element | Convention | Example |
| --------- | ----------- | --------- |
| Components | PascalCase | `AnimatedPressable`, `CounterStepper` |
| Component files | PascalCase.tsx | `AnimatedPressable.tsx` |
| Props interfaces | `{Name}Props` | `CounterStepperProps` |
| Services | camelCase + "Service" | `lessonService`, `professorService` |
| Service files | camelCase.ts | `lessonService.ts` |
| Hooks | `use` + PascalCase | `useDebounce`, `useTheme` |
| Hook files | camelCase.ts | `useDebounce.ts` |
| Utility files | camelCase.ts | `cpf.ts`, `date.ts` |
| Utility functions | camelCase | `validateCpf`, `formatDate` |
| Types/Interfaces | PascalCase | `Lesson`, `LessonWithDetails` |
| Enums | PascalCase (name), UPPER_SNAKE (values) | `LessonStatus.IN_PROGRESS` |
| Constants | UPPER_SNAKE_CASE | `STATUS_LABELS`, `DB_NAME` |
| Local state | camelCase | `isLoading`, `activeFilters` |
| Private functions | Leading underscore | `_doInitializeDatabase` |

---

## 5. Service Layer

Services are exported as **object literals** (not classes) with async methods:

```typescript
export const myService = {
  async create(data: CreateDTO): Promise<Entity> { },
  async getById(id: string): Promise<Entity | null> { },
  async getAll(): Promise<Entity[]> { },
  async update(id: string, updates: Partial<Entity>): Promise<void> { },
  async delete(id: string): Promise<void> { },
};
```

### Service Rules

- Every database operation goes through a service — screens never access `getDatabase()` directly
- Always acquire the database instance via `const db = await getDatabase()`
- Always use parameterized queries (`?` placeholders) — never interpolate values into SQL strings
- Validate business rules in the service before performing operations (existence, status checks, referential integrity)
- Throw descriptive `Error` messages in Portuguese for user-facing validations
- Use `Partial<T>` for update methods to allow partial updates
- Return `null` (not `undefined`) when an entity is not found

```typescript
// Good — parameterized query
await db.runAsync('SELECT * FROM professors WHERE id = ?', [id]);

// Bad — SQL injection risk
await db.runAsync(`SELECT * FROM professors WHERE id = '${id}'`);
```

---

## 6. Database & Schema

- Database singleton pattern — single instance via `getDatabase()`
- WAL mode enabled for concurrent access
- All tables use TEXT UUIDs as primary keys (generated with `uuid.v4()`)
- Timestamps stored as ISO 8601 TEXT (`created_at`, `date`)
- Schema defined in `src/db/schema.ts` with `CREATE TABLE IF NOT EXISTS`
- Migrations applied at startup in `src/db/client.ts` using `PRAGMA table_info` to check column existence
- Always create indexes for frequently queried columns (status, date, foreign keys)
- Use `LEFT JOIN` for optional relationships (professor, topic)

### Migration Rules

- Never drop tables in migrations — always use `ALTER TABLE ADD COLUMN`
- Check if column/table exists before applying migration (idempotent)
- Log migration progress with `console.log`
- Preserve legacy fields for backward compatibility

---

## 7. Theme System

- Access the theme via `const { theme } = useTheme()` — never import colors directly
- All new colors must be added to `ColorTokens` interface in `src/theme/colors.ts` with both light and dark variants
- Use semantic color names (`primary`, `success`, `danger`, `textSecondary`) — never raw hex values
- Use `theme.spacing.*` tokens (xs=4, sm=8, md=16, lg=24, xl=32, xxl=48) — never magic numbers
- Use `theme.typography.*` spread for text styles — never hardcode fontSize/fontWeight
- Use `theme.borderRadius.*` tokens — never hardcode border radius values
- Use `theme.shadows.*` for elevation — handles iOS/Android differences automatically
- Use `hexToRgba()` from `@/utils/color` when you need transparency on theme colors

```typescript
// Good
color: theme.colors.primary,
padding: theme.spacing.md,
...theme.typography.body,

// Bad
color: '#007AFF',
padding: 16,
fontSize: 16,
```

---

## 8. Navigation (Expo Router)

- Use file-based routing under `app/` directory
- Use `useRouter()` for programmatic navigation
- Use `useLocalSearchParams<{ id: string }>()` for typed route parameters
- Use `useFocusEffect()` instead of `useEffect()` for data loading on screen focus (prevents stale data)
- Tab screens go under `app/(tabs)/`
- Detail/create screens as siblings: `app/entity/[id].tsx`, `app/entity/new.tsx`

```typescript
// Good — reloads data when screen gains focus
useFocusEffect(
  React.useCallback(() => {
    loadData();
  }, [loadData]),
);

// Bad — only loads once, data becomes stale
useEffect(() => {
  loadData();
}, []);
```

---

## 9. State Management

- Use `useState` for local component state
- Use `React.Context` only for truly global state (theme, auth)
- Use `AsyncStorage` for persisted user preferences (theme, settings)
- Use `useDebounce` hook for auto-save with 500ms delay
- No Redux, MobX, or Zustand — keep it simple

### Loading Pattern

Every screen that fetches data should manage three states:

```typescript
const [data, setData] = useState<T[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(false);

const loadData = useCallback(async () => {
  try {
    setError(false);
    setLoading(true);
    const result = await myService.getAll();
    setData(result);
  } catch (err) {
    console.error("Error loading data:", err);
    setError(true);
  } finally {
    setLoading(false);
  }
}, []);

// Render
if (loading) return <SkeletonLoader count={4} />;
if (error) return <ErrorRetry onRetry={loadData} />;
if (data.length === 0) return <EmptyState title="Nenhum item" />;
```

---

## 10. Error Handling

- Service layer: `throw new Error('Mensagem em português')` for business rule violations
- Screen layer: `try/catch` around all service calls, log with `console.error`
- Use `Alert.alert()` for user-facing error messages
- Always reset loading state in `finally` block
- Validate at boundaries: user input in services, not in screens

```typescript
// Service — validates and throws
async deleteProfessor(id: string): Promise<void> {
  const lessonCount = await this.getLessonCount(id);
  if (lessonCount > 0) {
    throw new Error('Não é possível excluir professor com aulas vinculadas');
  }
  await db.runAsync('DELETE FROM professors WHERE id = ?', [id]);
}

// Screen — catches and displays
try {
  await professorService.deleteProfessor(id);
  router.back();
} catch (err) {
  Alert.alert('Erro', (err as Error).message);
}
```

---

## 11. Animation

- Use `react-native-reanimated` for all animations (not the legacy Animated API)
- Prefer `withSpring` for interactive feedback (pressable, toggles)
- Use `useSharedValue` + `useAnimatedStyle` pattern
- Keep spring config consistent: `{ damping: 15, stiffness: 300 }`
- Wrap components with `Animated.createAnimatedComponent()` when needed
- Use `AnimatedPressable` for all interactive list items and cards

---

## 12. Testing

- Test files go in `tests/unit/` directory with `.test.ts` or `.test.tsx` extension
- Test service logic and utility functions (pure functions first)
- Use `@testing-library/react-native` for component tests
- Mock `expo-sqlite` in service tests
- Run tests with `npm test` or `npx jest`
- Follow Arrange-Act-Assert pattern

---

## 13. Clean Code Principles

### Do

- **Single Responsibility**: Each service handles one entity, each component renders one thing
- **DRY**: Extract reusable components (`EmptyState`, `ErrorRetry`, `SkeletonLoader`)
- **Early Return**: Guard clauses at the top of functions for validation
- **Descriptive Names**: `getAllLessonsWithDetails()` not `getData()`
- **Small Functions**: If a function exceeds 30 lines, consider extracting helpers
- **Consistent Patterns**: Follow the established patterns in this file — consistency beats novelty

### Don't

- Don't use `any` — use proper types or `unknown` with type guards
- Don't hardcode strings for status — use `LessonStatus` enum
- Don't mix business logic with UI code — delegate to services
- Don't create God components — split into smaller, focused components
- Don't ignore TypeScript errors with `@ts-ignore` — fix the types
- Don't use `var` — use `const` by default, `let` only when reassignment is needed
- Don't nest ternaries — use early returns or extract to variables
- Don't leave `console.log` in production code — use `console.error` only for actual errors

---

## 14. Performance

- Use `useMemo` for computed values that depend on theme or expensive calculations
- Use `useCallback` for function references passed to child components or `useFocusEffect`
- Use `FlatList` (never `ScrollView` with `.map()`) for lists of dynamic length
- Provide `keyExtractor` using the entity's `id` field
- Use `React.memo()` only when profiling confirms unnecessary re-renders
- Keep `FlatList` `renderItem` lightweight — extract to a named component if complex

---

## 15. File Organization

```text
app/                    # Screens (Expo Router file-based routing)
├── _layout.tsx         # Root layout (DB init, ThemeProvider)
├── (tabs)/             # Bottom Tab Navigator
├── lesson/             # Lesson CRUD screens
├── professors/         # Professor CRUD screens
├── series/             # Series CRUD screens
├── topics/             # Topic CRUD screens
└── settings.tsx        # App settings

src/
├── components/         # Reusable UI components
├── db/                 # Database schema, migrations, client
├── hooks/              # Custom React hooks
├── services/           # Business logic and data access
├── theme/              # Design tokens, colors, typography, ThemeProvider
├── types/              # TypeScript interfaces, enums, constants
└── utils/              # Pure utility functions

specs/                  # Feature specifications (Spec-Driven Dev)
tests/                  # Unit and integration tests
```

### Organization Rules

- One component per file
- One service per entity
- Types grouped by domain entity
- Never import from `../db/client` in screens — always go through services
- Prefer editing existing files over creating new ones
- New components go in `src/components/`
- New types go in `src/types/`
- New hooks go in `src/hooks/`

---

## 16. Git & Commits

- Commit messages in English, following conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- Keep commits atomic — one logical change per commit
- Never commit `.env`, credentials, or database files
- Always test before committing: `npm test`
