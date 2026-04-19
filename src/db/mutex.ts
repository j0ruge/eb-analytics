/**
 * Global transaction mutex.
 *
 * expo-sqlite on web (wa-sqlite) cannot serialize concurrent
 * `withTransactionAsync` calls — a second transaction starting while the
 * first is still running surfaces as:
 *   - "cannot start a transaction within a transaction"
 *   - "cannot rollback - no transaction is active"
 *
 * Any code path that wraps work in `withTransactionAsync` should go through
 * `withDbMutex` to queue behind other in-flight transactions. Used by
 * `syncService` (claimBatch, revert, markSynced, markRejected) and
 * `catalogSyncService` (catalog upsert).
 *
 * **Contract — no re-entry.** Calling `withDbMutex` from inside a task already
 * running under `withDbMutex` will deadlock: the inner call awaits a promise
 * that can only resolve when the outer task completes. There is no runtime
 * detection in production builds — callers must not nest. Helper functions
 * invoked from a mutex-held section must NOT themselves wrap their work in
 * `withDbMutex`. If a helper needs both modes, expose an `-Inner` variant that
 * assumes the caller already holds the mutex.
 */

let queue: Promise<unknown> = Promise.resolve();

export async function withDbMutex<T>(task: () => Promise<T>): Promise<T> {
  const prev = queue;
  let release!: () => void;
  queue = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await prev;
    return await task();
  } finally {
    release();
  }
}
