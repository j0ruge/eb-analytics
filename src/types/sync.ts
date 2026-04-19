// Sync state + network contract types for spec 008 Offline-First Sync Client.
// See specs/008-offline-sync-client/data-model.md and
// specs/008-offline-sync-client/contracts/*.

export enum SyncStatus {
  LOCAL = 'LOCAL',
  QUEUED = 'QUEUED',
  SENDING = 'SENDING',
  SYNCED = 'SYNCED',
  REJECTED = 'REJECTED',
}

export interface SyncResultRejection {
  id: string;
  code: string;
  message: string;
}

export interface SyncResult {
  accepted: string[];
  rejected: SyncResultRejection[];
  server_now: string;
}

export type CatalogPullTrigger = 'auto' | 'manual';

export interface CatalogPullResult {
  ok: boolean;
  offline: boolean;
  skipped?: boolean;
  error?: string;
  counts?: {
    series: number;
    topics: number;
    professors: number;
  };
  server_now?: string;
}

export interface SyncQueueSnapshot {
  pending: number;
  sending: boolean;
  lastError: string | null;
  retryNow: (ids?: string[]) => Promise<void>;
}

export interface CatalogSyncSnapshot {
  lastSyncAt: string | null;
  isPulling: boolean;
  pullNow: (trigger: CatalogPullTrigger) => Promise<CatalogPullResult>;
}
