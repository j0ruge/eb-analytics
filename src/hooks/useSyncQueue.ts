import { useContext } from 'react';
import { SyncContext } from '../contexts/SyncProvider';
import type { SyncQueueSnapshot } from '../types/sync';

export function useSyncQueue(): SyncQueueSnapshot {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error('useSyncQueue must be used within <SyncProvider>');
  }
  const { pending, sending, lastError, retryNow } = ctx;
  return { pending, sending, lastError, retryNow };
}
