# Contract — `catalogSyncService` & `useCatalogSync`

**Scope**: client-side interfaces. HTTP contract is spec 007's `GET /catalog` in `specs/007-sync-backend/contracts/catalog.md`; this file describes what the mobile service and hook expose.

---

## `catalogSyncService`

File: `src/services/catalogSyncService.ts`.

```typescript
import type { CatalogPullResult } from '../types/sync';

export type CatalogPullTrigger = 'auto' | 'manual';

export const catalogSyncService = {
  /**
   * Pulls /catalog?since=<last_catalog_sync>.
   * - trigger === 'auto': called by SyncProvider on login + 1h foreground timer.
   *                       Silent on all failures (FR-044, FR-045).
   * - trigger === 'manual': called by pull-to-refresh in series/topic/professor lists.
   *                         Returns a result whose `offline` / `error` fields the
   *                         caller converts to a toast (FR-045).
   *
   * Behavior:
   *   1. Read last_catalog_sync from AsyncStorage; absent ⇒ first-run full pull.
   *   2. If not authenticated ⇒ return { ok: false, offline: false, skipped: true }
   *      (auto trigger silently ignored; manual trigger toasts "Faça login…").
   *   3. apiClient.getWithTimeout('/catalog' + qs, 30_000).
   *   4. On 2xx: upsert series + topics + professors in one SQLite transaction.
   *      On success, advance last_catalog_sync to response.server_now.
   *   5. Map outcome to result.
   *
   * Never throws — callers read the returned shape.
   */
  async pullNow(trigger: CatalogPullTrigger): Promise<CatalogPullResult>,

  /**
   * Clear the cursor. Called by authService.logout() so the next login starts fresh.
   */
  async resetCursor(): Promise<void>,

  /**
   * Read the stored cursor. Used by useCatalogSync and tests.
   */
  async getLastSyncAt(): Promise<string | null>,
};
```

### `CatalogPullResult`

```typescript
export interface CatalogPullResult {
  ok: boolean;
  offline: boolean;         // true ONLY when status === 0 (network drop / timeout abort)
  skipped?: boolean;        // true when called while unauthenticated (auto path silently skips)
  error?: string;           // server error message (4xx/5xx); undefined on ok or offline
  counts?: {                // populated on ok
    series: number;
    topics: number;
    professors: number;
  };
  server_now?: string;      // ISO 8601 — cursor value advanced to this
}
```

### Trigger behavior matrix (FR-040, FR-044, FR-045)

| Trigger | Auth | Network | Result | UI feedback |
|---------|------|---------|--------|-------------|
| `auto` | logged in | online | `{ ok: true, counts, server_now }` | silent |
| `auto` | logged in | offline | `{ ok: false, offline: true }` | silent |
| `auto` | not logged in | any | `{ ok: false, skipped: true }` | silent |
| `auto` | logged in | 4xx/5xx | `{ ok: false, error }` | silent |
| `manual` | logged in | online | `{ ok: true, counts, server_now }` | pull-to-refresh indicator dismisses; no toast |
| `manual` | logged in | offline | `{ ok: false, offline: true }` | toast `"Sem conexão — usando dados locais"` |
| `manual` | not logged in | any | `{ ok: false, skipped: true }` | toast `"Entre para atualizar o catálogo"` |
| `manual` | logged in | 4xx/5xx | `{ ok: false, error }` | toast with `error` verbatim |

The toast wiring lives in the screen (`app/series/index.tsx`, etc.), not in the service — keeps the service UI-agnostic.

### Upsert transaction shape

Exact SQL in `data-model.md §6`. All three tables are upserted in a single `BEGIN ... COMMIT` so a partial failure leaves the cursor un-advanced and the next pull retries the same window.

### Auth events

- `authService.logout()` calls `catalogSyncService.resetCursor()` so the next login fetches the catalog from scratch. This prevents a coordinator on a shared device from inheriting the previous collector's filtered view.
- First login after install: cursor is absent, full pull.

---

## `useCatalogSync` hook

File: `src/hooks/useCatalogSync.ts`.

```typescript
export interface CatalogSyncSnapshot {
  lastSyncAt: string | null;
  isPulling: boolean;
  pullNow: (trigger: CatalogPullTrigger) => Promise<CatalogPullResult>;
}

export function useCatalogSync(): CatalogSyncSnapshot;
```

Consumed by the three catalog list screens (`series`, `topics`, `professors`). On pull-to-refresh:

```typescript
const { pullNow } = useCatalogSync();
const onRefresh = async () => {
  const result = await pullNow('manual');
  if (!result.ok) {
    if (result.offline) toast.show('Sem conexão — usando dados locais');
    else if (result.skipped) toast.show('Entre para atualizar o catálogo');
    else if (result.error) toast.show(result.error);
  }
};
```

The hook itself does **not** call the toast — screens own that.

---

## Provider mount

`CatalogSyncProvider` is **not** a separate provider. The auto-pull side-effects (on login, on foreground after 1h) live inside `SyncProvider` to avoid double-wiring AppState listeners. The hook simply reads state exposed by that provider.

Inside `SyncProvider`'s `useEffect`:

```typescript
// On login transition (isAuthenticated went false → true)
useEffect(() => {
  if (isAuthenticated && !wasAuthenticated) {
    catalogSyncService.pullNow('auto').catch(logError);
  }
}, [isAuthenticated]);

// On foreground, if last pull > 1 hour ago
useEffect(() => {
  const sub = AppState.addEventListener('change', async (s) => {
    if (s === 'active' && isAuthenticated) {
      const last = await catalogSyncService.getLastSyncAt();
      if (!last || Date.now() - Date.parse(last) > 60 * 60 * 1000) {
        catalogSyncService.pullNow('auto').catch(logError);
      }
    }
  });
  return () => sub.remove();
}, [isAuthenticated]);
```
