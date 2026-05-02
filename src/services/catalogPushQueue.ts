import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import * as SQLite from 'expo-sqlite';

export type CatalogEntityType = 'PROFESSOR' | 'SERIES' | 'TOPIC';
export type CatalogPushOp = 'CREATE' | 'UPDATE';

export interface CatalogPendingPush {
  id: string;
  entity_type: CatalogEntityType;
  entity_id: string;
  op: CatalogPushOp;
  payload: string; // JSON-serialized
  attempts: number;
  last_error: string | null;
  created_at: string;
  last_attempt_at: string | null;
}

export interface EnqueueParams {
  entityType: CatalogEntityType;
  entityId: string;
  op: CatalogPushOp;
  payload: Record<string, unknown>;
  lastError?: string | null;
}

/**
 * Inserts (or replaces) a pending push for a (entity_type, entity_id) pair.
 * The unique index on (entity_type, entity_id) means the latest payload always
 * wins — earlier queued ops for the same entity are superseded. This matches
 * the offline-first semantic where the local row is source of truth and the
 * push is just trying to mirror it server-side.
 */
export async function enqueueCatalogPush(
  db: SQLite.SQLiteDatabase,
  params: EnqueueParams,
): Promise<void> {
  const id = uuidv4();
  const payloadJson = JSON.stringify(params.payload);
  await db.runAsync(
    `INSERT INTO catalog_pending_pushes (id, entity_type, entity_id, op, payload, attempts, last_error)
     VALUES (?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT(entity_type, entity_id) DO UPDATE SET
       op = excluded.op,
       payload = excluded.payload,
       last_error = excluded.last_error,
       last_attempt_at = NULL`,
    [id, params.entityType, params.entityId, params.op, payloadJson, params.lastError ?? null],
  );
}

/**
 * Fetches up to `limit` pending pushes ordered by attempts (lowest first), then
 * created_at. The drainer in syncService consumes these in batches.
 */
export async function listPendingPushes(
  db: SQLite.SQLiteDatabase,
  limit = 50,
): Promise<CatalogPendingPush[]> {
  return db.getAllAsync<CatalogPendingPush>(
    `SELECT id, entity_type, entity_id, op, payload, attempts, last_error, created_at, last_attempt_at
       FROM catalog_pending_pushes
      ORDER BY attempts ASC, created_at ASC
      LIMIT ?`,
    [limit],
  );
}

export async function deletePendingPush(
  db: SQLite.SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync('DELETE FROM catalog_pending_pushes WHERE id = ?', [id]);
}

export async function bumpPushAttempt(
  db: SQLite.SQLiteDatabase,
  id: string,
  error: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE catalog_pending_pushes
        SET attempts = attempts + 1,
            last_error = ?,
            last_attempt_at = datetime('now')
      WHERE id = ?`,
    [error, id],
  );
}

export async function countPendingPushes(
  db: SQLite.SQLiteDatabase,
): Promise<number> {
  const r = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM catalog_pending_pushes',
  );
  return r?.count ?? 0;
}

// Bounded retries — mirrors the lessons_outbox pattern. After this many
// failed attempts the row stays in the queue but the drainer skips it
// (the user can manually re-edit the entity to push a fresh payload).
export const MAX_PUSH_ATTEMPTS = 8;
