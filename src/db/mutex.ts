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
