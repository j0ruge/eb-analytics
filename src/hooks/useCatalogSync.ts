import { useContext } from 'react';
import { SyncContext } from '../contexts/SyncProvider';
import type { CatalogSyncSnapshot } from '../types/sync';

export function useCatalogSync(): CatalogSyncSnapshot {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error('useCatalogSync must be used within <SyncProvider>');
  }
  const { lastSyncAt, isPulling, pullNow } = ctx;
  return { lastSyncAt, isPulling, pullNow };
}
