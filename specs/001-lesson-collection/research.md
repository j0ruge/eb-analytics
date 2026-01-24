# Research & Technical Decisions: Lesson Data Collection Flow

**Feature**: Lesson Data Collection
**Date**: 2026-01-24

## 1. Database Library: `expo-sqlite`

**Decision**: Use the modern `expo-sqlite` API (formerly previewed as `/next`).
**Rationale**:
- Provides a cleaner, Promise-based API compared to the legacy WebSQL-style callback API.
- Better TypeScript support.
- Fully compatible with Expo Go.

**Implementation Detail**:
```typescript
import * as SQLite from 'expo-sqlite';

// Open database asynchronously
const db = await SQLite.openDatabaseAsync('ebd_insights.db');

// Execute query
await db.runAsync('INSERT INTO ...', params);
```

## 2. Auto-Save Strategy (Debounce)

**Decision**: Implement a custom `useDebouncedCallback` hook (or use `use-debounce` if allowed, but "Minimalism" suggests custom/simple).
**Rationale**:
- Users will tap counters rapidly (+1, +1, +1).
- We should not run an `UPDATE` query on every tap.
- A 500ms debounce ensures the database is hit only once the user pauses.

**Implementation Detail**:
- UI updates optimistic state *immediately*.
- Effect/Callback waits 500ms before persisting to DB.
- On "Force Close", we accept the risk of losing the last <500ms of data (acceptable trade-off for performance). *Self-correction: Constitution says "Fail-Safe". If we debounce, we risk small data loss on crash. However, SC-001 says "Zero Data Loss".
**Refinement**: For *counters*, we can use `useDebounce` but maybe shorten the time to 300ms. For *time capture*, we save immediately (no debounce needed).

## 3. Export Mechanism

**Decision**: `expo-file-system` + `expo-sharing`.
**Rationale**:
- Standard Expo way to share files.
- Works offline (saves to cache, then opens Share Sheet).

**Flow**:
1. Query `SELECT * FROM lessons_data WHERE status = 'COMPLETED'`.
2. `JSON.stringify(data)`.
3. `FileSystem.writeAsStringAsync(fileUri, json)`.
4. `Sharing.shareAsync(fileUri)`.
