/**
 * Spec 008 — syncService.runOnce + helpers.
 * Mocks DB, apiClient, auth, lessonService at module boundaries.
 */

import { syncService, computeBackoffMs, parseRetryAfter } from '../../src/services/syncService';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: 'test' } },
}));
jest.mock('uuid', () => ({ v4: jest.fn(() => 'fixed-uuid') }));
jest.mock('react-native-get-random-values', () => ({}));

// Module-scope mock fns — names prefixed with `mock` so jest.mock allows them.
const mockGetById = jest.fn();
const mockGetByIdWithDetails = jest.fn();
const mockGetSession = jest.fn();
const mockPostWithTimeout = jest.fn();
const mockGetWithTimeout = jest.fn();
const mockClearJwt = jest.fn(async () => {});
const mockGetDeviceId = jest.fn(async () => 'dev-test');
const mockBuildCollection = jest.fn((row: Record<string, unknown>) => ({ id: row.id }));
const mockGetDatabase = jest.fn();

jest.mock('../../src/db/client', () => ({
  getDatabase: () => mockGetDatabase(),
}));
jest.mock('../../src/services/lessonService', () => ({
  lessonService: {
    getById: (id: string) => mockGetById(id),
    getByIdWithDetails: (id: string) => mockGetByIdWithDetails(id),
    // Bulk variant added for the N+1 fix. Loops `mockGetByIdWithDetails`
    // so existing test arrangements (which configure the single variant)
    // keep working unchanged.
    getByIdsWithDetails: async (ids: string[]) => {
      const out = [];
      for (const id of ids) {
        const r = await mockGetByIdWithDetails(id);
        if (r) out.push(r);
      }
      return out;
    },
  },
}));
jest.mock('../../src/services/authService', () => ({
  authService: { getSession: () => mockGetSession() },
}));
jest.mock('../../src/services/apiClient', () => ({
  apiClient: {
    postWithTimeout: (path: string, body: unknown, timeoutMs: number) =>
      mockPostWithTimeout(path, body, timeoutMs),
    getWithTimeout: (path: string, timeoutMs: number) =>
      mockGetWithTimeout(path, timeoutMs),
  },
  clearJwt: () => mockClearJwt(),
}));
jest.mock('../../src/services/deviceIdService', () => ({
  getDeviceId: () => mockGetDeviceId(),
}));
jest.mock('../../src/services/exportService', () => ({
  buildCollection: (row: Record<string, unknown>) => mockBuildCollection(row),
}));

// ---------------------------------------------------------------------------
// Fake SQLite
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

interface Push {
  id: string;
  entity_type: string;
  entity_id: string;
  op: string;
  payload: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  last_attempt_at: string | null;
}

const state = {
  rows: [] as Row[],
  pushes: [] as Push[],
};

function makeFakeDb() {
  return {
    async getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]> {
      const s = sql.replace(/\s+/g, ' ').trim();
      // Catalog push drainer reads from catalog_pending_pushes at the start
      // of every runOnce. Tests that don't seed pushes get an empty list.
      if (s.startsWith('SELECT id, entity_type, entity_id, op, payload')) {
        const limit = (params?.[0] as number | undefined) ?? 50;
        return state.pushes
          .slice()
          .sort((a, b) => {
            if (a.attempts !== b.attempts) return a.attempts - b.attempts;
            return a.created_at.localeCompare(b.created_at);
          })
          .slice(0, limit) as unknown as T[];
      }
      if (s.startsWith('SELECT id, sync_attempt_count FROM lessons_data')) {
        const userId = params?.[0];
        const nowIso = params?.[1] as string;
        return state.rows
          .filter(
            (r) =>
              r.sync_status === 'QUEUED' &&
              r.collector_user_id === userId &&
              (!r.sync_next_attempt_at || (r.sync_next_attempt_at as string) <= nowIso),
          )
          .sort((a, b) => {
            const an = (a.sync_next_attempt_at as string) ?? '';
            const bn = (b.sync_next_attempt_at as string) ?? '';
            if (an !== bn) return an.localeCompare(bn);
            return (a.created_at as string).localeCompare(b.created_at as string);
          })
          .slice(0, 20)
          .map((r) => ({
            id: r.id,
            sync_attempt_count: r.sync_attempt_count ?? 0,
          })) as unknown as T[];
      }
      throw new Error('Unexpected getAllAsync: ' + s);
    },
    async getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null> {
      const s = sql.replace(/\s+/g, ' ').trim();
      if (s.startsWith('SELECT sync_attempt_count FROM lessons_data')) {
        const id = params?.[0];
        const row = state.rows.find((r) => r.id === id);
        return row
          ? ({ sync_attempt_count: row.sync_attempt_count } as unknown as T)
          : null;
      }
      if (s.startsWith('SELECT count(*)')) {
        const userId = params?.[0];
        const n = state.rows.filter(
          (r) =>
            (r.sync_status === 'QUEUED' || r.sync_status === 'SENDING') &&
            r.collector_user_id === userId,
        ).length;
        return { n } as unknown as T;
      }
      return null;
    },
    async runAsync(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowId: number }> {
      const s = sql.replace(/\s+/g, ' ').trim();
      const ok = (changes: number) => ({ changes, lastInsertRowId: 0 });
      // catalog_pending_pushes — drainer mutations
      if (s.startsWith('UPDATE catalog_pending_pushes SET attempts = attempts + 1')) {
        const lastError = params?.[0] as string;
        const id = params?.[1] as string;
        const push = state.pushes.find((p) => p.id === id);
        if (push) {
          push.attempts += 1;
          push.last_error = lastError;
          push.last_attempt_at = new Date().toISOString();
          return ok(1);
        }
        return ok(0);
      }
      if (s.startsWith('DELETE FROM catalog_pending_pushes WHERE id =')) {
        const id = params?.[0] as string;
        const before = state.pushes.length;
        state.pushes = state.pushes.filter((p) => p.id !== id);
        return ok(before - state.pushes.length);
      }
      if (s.startsWith("UPDATE lessons_data SET sync_status = 'SENDING'")) {
        const id = params?.[0];
        const row = state.rows.find((r) => r.id === id && r.sync_status === 'QUEUED');
        if (row) {
          row.sync_status = 'SENDING';
          return ok(1);
        }
        return ok(0);
      }
      if (s.startsWith("UPDATE lessons_data SET sync_status = 'SYNCED'")) {
        const serverNow = params?.[0];
        const id = params?.[1];
        const row = state.rows.find((r) => r.id === id && r.synced_at === null);
        if (row) {
          row.sync_status = 'SYNCED';
          row.sync_error = null;
          row.sync_attempt_count = 0;
          row.sync_next_attempt_at = null;
          row.synced_at = serverNow;
          return ok(1);
        }
        return ok(0);
      }
      if (s.startsWith("UPDATE lessons_data SET sync_status = 'REJECTED'")) {
        const syncError = params?.[0];
        const id = params?.[1];
        const row = state.rows.find((r) => r.id === id);
        if (row) {
          row.sync_status = 'REJECTED';
          row.sync_error = syncError;
          return ok(1);
        }
        return ok(0);
      }
      // Enqueue (LOCAL→QUEUED) must match BEFORE the clear-backoff and
      // revert-with-backoff patterns, since all three start with
      // "UPDATE lessons_data SET sync_status = 'QUEUED'". Enqueue is the
      // most specific — it's the only one that sets sync_error = NULL and
      // writes collector_user_id via COALESCE.
      if (
        s.startsWith(
          "UPDATE lessons_data SET sync_status = 'QUEUED', sync_attempt_count = 0, sync_next_attempt_at = NULL, sync_error = NULL",
        )
      ) {
        // Enqueue: includes `collector_user_id = COALESCE(...)` and `sync_status = 'LOCAL'`.
        if (s.includes("COALESCE(collector_user_id") && s.includes("sync_status = 'LOCAL'")) {
          const userId = params?.[0] as string | null;
          const id = params?.[1];
          const row = state.rows.find((r) => r.id === id && r.sync_status === 'LOCAL');
          if (row) {
            row.sync_status = 'QUEUED';
            row.sync_attempt_count = 0;
            row.sync_next_attempt_at = null;
            row.sync_error = null;
            if (row.collector_user_id == null && userId != null) {
              row.collector_user_id = userId;
            }
            return ok(1);
          }
          return ok(0);
        }
        // Targeted retryNow: WHERE id = ? AND sync_status IN ('QUEUED', 'REJECTED') AND collector_user_id = ?
        if (s.includes("WHERE id = ?") && s.includes("sync_status IN ('QUEUED', 'REJECTED')")) {
          const id = params?.[0];
          const userId = params?.[1];
          const row = state.rows.find(
            (r) =>
              r.id === id &&
              (r.sync_status === 'QUEUED' || r.sync_status === 'REJECTED') &&
              r.collector_user_id === userId,
          );
          if (row) {
            row.sync_status = 'QUEUED';
            row.sync_attempt_count = 0;
            row.sync_next_attempt_at = null;
            row.sync_error = null;
            return ok(1);
          }
          return ok(0);
        }
        // Bulk retryNow: WHERE sync_status IN ('QUEUED', 'REJECTED') AND collector_user_id = ?
        if (s.includes("sync_status IN ('QUEUED', 'REJECTED')")) {
          const userId = params?.[0];
          let changes = 0;
          for (const row of state.rows) {
            if (
              (row.sync_status === 'QUEUED' || row.sync_status === 'REJECTED') &&
              row.collector_user_id === userId
            ) {
              row.sync_status = 'QUEUED';
              row.sync_attempt_count = 0;
              row.sync_next_attempt_at = null;
              row.sync_error = null;
              changes++;
            }
          }
          return ok(changes);
        }
        return ok(0);
      }
      // Clear-backoff revert (used on 401): sets QUEUED + resets both
      // counters without touching sync_error or collector.
      if (
        s.startsWith(
          "UPDATE lessons_data SET sync_status = 'QUEUED', sync_attempt_count = 0, sync_next_attempt_at = NULL WHERE id =",
        )
      ) {
        const id = params?.[0];
        const row = state.rows.find((r) => r.id === id);
        if (row) {
          row.sync_status = 'QUEUED';
          row.sync_attempt_count = 0;
          row.sync_next_attempt_at = null;
          return ok(1);
        }
        return ok(0);
      }
      if (
        s.startsWith(
          "UPDATE lessons_data SET sync_status = 'QUEUED', sync_attempt_count",
        )
      ) {
        const count = params?.[0];
        const nextAt = params?.[1];
        const id = params?.[2];
        const row = state.rows.find((r) => r.id === id);
        if (row) {
          row.sync_status = 'QUEUED';
          row.sync_attempt_count = count;
          row.sync_next_attempt_at = nextAt;
          return ok(1);
        }
        return ok(0);
      }
      if (s.startsWith('UPDATE lessons_data SET sync_attempt_count = 0')) {
        let changes = 0;
        if (params && params.length === 2) {
          const id = params[0];
          const row = state.rows.find(
            (r) => r.id === id && r.sync_status === 'QUEUED',
          );
          if (row) {
            row.sync_attempt_count = 0;
            row.sync_next_attempt_at = null;
            row.sync_error = null;
            changes = 1;
          }
        } else {
          const userId = params?.[0];
          for (const row of state.rows) {
            if (row.sync_status === 'QUEUED' && row.collector_user_id === userId) {
              row.sync_attempt_count = 0;
              row.sync_next_attempt_at = null;
              row.sync_error = null;
              changes++;
            }
          }
        }
        return ok(changes);
      }
      throw new Error('Unexpected runAsync: ' + s);
    },
    async withTransactionAsync(task: () => Promise<void>): Promise<void> {
      await task();
    },
    async execAsync(_sql: string): Promise<void> {
      return;
    },
  };
}

// ---------------------------------------------------------------------------
// seed + hooks
// ---------------------------------------------------------------------------

function seed(lesson: Partial<Row>): Row {
  const row: Row = {
    id: lesson.id ?? 'id-1',
    collector_user_id: lesson.collector_user_id ?? 'user-1',
    status: 'COMPLETED',
    sync_status: 'QUEUED',
    sync_error: null,
    sync_attempt_count: 0,
    sync_next_attempt_at: null,
    synced_at: null,
    created_at: '2026-04-18T10:00:00.000Z',
    ...lesson,
  };
  state.rows.push(row);
  return row;
}

function seedPush(push: Partial<Push>): Push {
  const row: Push = {
    id: push.id ?? 'push-1',
    entity_type: push.entity_type ?? 'TOPIC',
    entity_id: push.entity_id ?? 'topic-1',
    op: push.op ?? 'CREATE',
    payload: push.payload ?? JSON.stringify({ id: 'topic-1' }),
    attempts: push.attempts ?? 0,
    last_error: push.last_error ?? null,
    created_at: push.created_at ?? '2026-04-18T09:00:00.000Z',
    last_attempt_at: push.last_attempt_at ?? null,
  };
  state.pushes.push(row);
  return row;
}

beforeEach(() => {
  state.rows.length = 0;
  state.pushes.length = 0;
  mockGetById.mockImplementation(async (id: string) => state.rows.find((r) => r.id === id) ?? null);
  mockGetByIdWithDetails.mockImplementation(async (id: string) =>
    state.rows.find((r) => r.id === id) ?? null,
  );
  mockGetSession.mockResolvedValue({ user: { id: 'user-1', display_name: 'Test' } });
  mockGetDatabase.mockImplementation(async () => makeFakeDb());
  mockPostWithTimeout.mockReset();
  mockGetWithTimeout.mockReset();
  mockClearJwt.mockClear();
  syncService.__resetSendingFlagForTest();
});

// ---------------------------------------------------------------------------

describe('computeBackoffMs (FR-030)', () => {
  it('follows the published schedule and caps at 30 min', () => {
    expect(computeBackoffMs(1)).toBe(30_000);
    expect(computeBackoffMs(2)).toBe(60_000);
    expect(computeBackoffMs(3)).toBe(120_000);
    expect(computeBackoffMs(4)).toBe(300_000);
    expect(computeBackoffMs(5)).toBe(900_000);
    expect(computeBackoffMs(6)).toBe(1_800_000);
    expect(computeBackoffMs(7)).toBe(1_800_000);
    expect(computeBackoffMs(99)).toBe(1_800_000);
  });
});

describe('parseRetryAfter (FR-024a)', () => {
  const now = new Date('2026-04-18T12:00:00.000Z');

  it('parses delta-seconds', () => {
    expect(parseRetryAfter('60', now)).toBe(60_000);
    expect(parseRetryAfter('0', now)).toBe(0);
  });

  it('parses HTTP-date', () => {
    const future = new Date(now.getTime() + 45_000).toUTCString();
    expect(parseRetryAfter(future, now)).toBe(45_000);
  });

  it('clamps to 30-min ceiling', () => {
    expect(parseRetryAfter('86400', now)).toBe(30 * 60 * 1000);
  });

  it('returns null on unparseable / missing header', () => {
    expect(parseRetryAfter(null, now)).toBeNull();
    expect(parseRetryAfter('', now)).toBeNull();
    expect(parseRetryAfter('not-a-date', now)).toBeNull();
  });

  it('returns 0 on past HTTP-date', () => {
    const past = new Date(now.getTime() - 60_000).toUTCString();
    expect(parseRetryAfter(past, now)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// runOnce matrix
// ---------------------------------------------------------------------------

describe('syncService.runOnce', () => {
  it('US1 happy path — accepted ids → SYNCED with server_now', async () => {
    const lesson = seed({ id: 'a' });
    mockPostWithTimeout.mockResolvedValueOnce({
      status: 200,
      data: { accepted: ['a'], rejected: [], server_now: '2026-04-18T13:00:00.000Z' },
      error: null,
      headers: {},
    });
    const result = await syncService.runOnce();
    expect(result.accepted).toBe(1);
    expect(lesson.sync_status).toBe('SYNCED');
    expect(lesson.synced_at).toBe('2026-04-18T13:00:00.000Z');
    expect(lesson.sync_attempt_count).toBe(0);
    expect(mockPostWithTimeout).toHaveBeenCalledTimes(1);
  });

  it('US2 batching — 5 offline items go in a single POST /sync/batch', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    ids.forEach((id, i) =>
      seed({
        id,
        created_at: `2026-04-18T10:00:${String(i).padStart(2, '0')}.000Z`,
      }),
    );
    mockPostWithTimeout.mockResolvedValueOnce({
      status: 200,
      data: { accepted: ids, rejected: [], server_now: '2026-04-18T13:00:00.000Z' },
      error: null,
      headers: {},
    });
    const result = await syncService.runOnce();
    expect(result.accepted).toBe(5);
    expect(mockPostWithTimeout).toHaveBeenCalledTimes(1);
    const body = mockPostWithTimeout.mock.calls[0]![1] as { collections: unknown[] };
    expect(body.collections).toHaveLength(5);
  });

  it('US2/US3 network error → revert with FR-030 first-step backoff', async () => {
    const lesson = seed({ id: 'a' });
    mockPostWithTimeout.mockResolvedValueOnce({
      status: 0,
      data: null,
      error: 'Sem conexão',
      headers: {},
    });
    const result = await syncService.runOnce();
    expect(result.retried).toBe(1);
    expect(lesson.sync_status).toBe('QUEUED');
    expect(lesson.sync_attempt_count).toBe(1);
    expect(lesson.sync_next_attempt_at).not.toBeNull();
  });

  it('US3 per-item 4xx → REJECTED with code:message', async () => {
    const lesson = seed({ id: 'a' });
    mockPostWithTimeout.mockResolvedValueOnce({
      status: 200,
      data: {
        accepted: [],
        rejected: [
          { id: 'a', code: 'missing_catalog_reference', message: 'Topic not found' },
        ],
        server_now: '2026-04-18T13:00:00.000Z',
      },
      error: null,
      headers: {},
    });
    const result = await syncService.runOnce();
    expect(result.rejected).toBe(1);
    expect(lesson.sync_status).toBe('REJECTED');
    expect(lesson.sync_error).toBe('missing_catalog_reference: Topic not found');
  });

  it('US3 401 → clearJwt + revert to QUEUED + sessionExpired flag', async () => {
    const lesson = seed({ id: 'a' });
    mockPostWithTimeout.mockResolvedValueOnce({
      status: 401,
      data: null,
      error: 'Sessão expirada',
      headers: {},
    });
    const result = await syncService.runOnce();
    expect(result.sessionExpired).toBe(true);
    expect(mockClearJwt).toHaveBeenCalled();
    expect(lesson.sync_status).toBe('QUEUED');
  });

  it('US3 429 with Retry-After delta-seconds uses that delay', async () => {
    const lesson = seed({ id: 'a' });
    mockPostWithTimeout.mockResolvedValueOnce({
      status: 429,
      data: null,
      error: 'rate',
      headers: { 'retry-after': '120' },
    });
    const now = new Date('2026-04-18T12:00:00.000Z');
    jest.useFakeTimers();
    jest.setSystemTime(now);
    await syncService.runOnce();
    jest.useRealTimers();
    expect(lesson.sync_status).toBe('QUEUED');
    const scheduled = Date.parse(lesson.sync_next_attempt_at as string);
    expect(scheduled - now.getTime()).toBeGreaterThanOrEqual(120_000 - 1000);
    expect(scheduled - now.getTime()).toBeLessThanOrEqual(120_000 + 1000);
  });

  it('US3 429 without Retry-After falls back to FR-030', async () => {
    const lesson = seed({ id: 'a' });
    mockPostWithTimeout.mockResolvedValueOnce({
      status: 429,
      data: null,
      error: 'rate',
      headers: {},
    });
    await syncService.runOnce();
    expect(lesson.sync_status).toBe('QUEUED');
    expect(lesson.sync_attempt_count).toBe(1);
    expect(lesson.sync_next_attempt_at).not.toBeNull();
  });

  it('FR-025 batch-level 400 marks every sent id REJECTED', async () => {
    const a = seed({ id: 'a' });
    const b = seed({ id: 'b' });
    mockPostWithTimeout.mockResolvedValueOnce({
      status: 400,
      data: null,
      error: 'Schema inválido',
      headers: {},
    });
    const result = await syncService.runOnce();
    expect(result.rejected).toBe(2);
    expect(a.sync_status).toBe('REJECTED');
    expect(b.sync_status).toBe('REJECTED');
    expect(a.sync_error).toContain('http_400');
  });

  it('FR-021 cap at 20 — 25 rows → one POST with 20 items', async () => {
    for (let i = 0; i < 25; i++) {
      seed({
        id: `row-${i}`,
        created_at: `2026-04-18T10:${String(i).padStart(2, '0')}:00.000Z`,
      });
    }
    mockPostWithTimeout.mockResolvedValueOnce({
      status: 200,
      data: { accepted: [], rejected: [], server_now: '2026-04-18T13:00:00.000Z' },
      error: null,
      headers: {},
    });
    await syncService.runOnce();
    const body = mockPostWithTimeout.mock.calls[0]![1] as { collections: unknown[] };
    expect(body.collections).toHaveLength(20);
  });

  it('FR-032 per-item backoff — cooling-down row stays out of batch', async () => {
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    seed({ id: 'cooling', sync_next_attempt_at: future, sync_attempt_count: 3 });
    seed({ id: 'fresh' });
    mockPostWithTimeout.mockResolvedValueOnce({
      status: 200,
      data: {
        accepted: ['fresh'],
        rejected: [],
        server_now: '2026-04-18T13:00:00.000Z',
      },
      error: null,
      headers: {},
    });
    await syncService.runOnce();
    const body = mockPostWithTimeout.mock.calls[0]![1] as { collections: { id: string }[] };
    expect(body.collections).toHaveLength(1);
    expect(body.collections[0].id).toBe('fresh');
  });

  it('no-op when no user is signed in', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    seed({ id: 'a' });
    const result = await syncService.runOnce();
    expect(result.accepted).toBe(0);
    expect(mockPostWithTimeout).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

describe('syncService.enqueue', () => {
  it('rejects non-COMPLETED rows', async () => {
    seed({ id: 'a', status: 'IN_PROGRESS', sync_status: 'LOCAL' });
    await expect(syncService.enqueue('a')).rejects.toThrow('Aula precisa estar finalizada');
  });

  it('transitions LOCAL → QUEUED', async () => {
    const row = seed({ id: 'a', status: 'COMPLETED', sync_status: 'LOCAL' });
    await syncService.enqueue('a');
    expect(row.sync_status).toBe('QUEUED');
  });

  it('rejects when already QUEUED', async () => {
    seed({ id: 'a', status: 'COMPLETED', sync_status: 'QUEUED' });
    await expect(syncService.enqueue('a')).rejects.toThrow('já foi enviada');
  });
});

describe('syncService.retryNow', () => {
  it('resets backoff fields on all pending rows', async () => {
    const a = seed({
      id: 'a',
      sync_attempt_count: 3,
      sync_next_attempt_at: '2099-01-01T00:00:00.000Z',
      sync_error: 'prior',
    });
    await syncService.retryNow();
    expect(a.sync_attempt_count).toBe(0);
    expect(a.sync_next_attempt_at).toBeNull();
    expect(a.sync_error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// drainCatalogPushes — exercised via runOnce. The drainer fires before lesson
// claim, so a runOnce with no lessons exercises only the queue.
// ---------------------------------------------------------------------------

describe('drainCatalogPushes (via runOnce)', () => {
  it('bumps attempts on 4xx-not-404 instead of deleting (data preserved for re-edit)', async () => {
    const push = seedPush({ entity_type: 'TOPIC', op: 'CREATE', attempts: 0 });
    mockPostWithTimeout.mockResolvedValueOnce({
      status: 400,
      data: null,
      error: 'invalid_payload',
      headers: {},
    });

    await syncService.runOnce();

    expect(state.pushes).toHaveLength(1);
    expect(state.pushes[0].attempts).toBe(1);
    expect(state.pushes[0].last_error).toBe('400: invalid_payload');
    // Verify the drainer reached the topics endpoint with the right body.
    // Third arg is CATALOG_WRITE_TIMEOUT_MS — the apiClient mock factory
    // doesn't re-export it, so it lands as undefined in the proxied call.
    expect(mockPostWithTimeout).toHaveBeenCalledTimes(1);
    const [calledPath, calledBody] = mockPostWithTimeout.mock.calls[0];
    expect(calledPath).toBe('/catalog/topics');
    expect(calledBody).toEqual({ id: 'topic-1' });
    // entry must NOT have been deleted — that was the silent-loss bug
    expect(state.pushes.find((p) => p.id === push.id)).toBeDefined();
  });

  it('deletes the entry on success (200/201)', async () => {
    seedPush({ entity_type: 'PROFESSOR', op: 'CREATE' });
    mockPostWithTimeout.mockResolvedValueOnce({
      status: 201,
      data: null,
      error: null,
      headers: {},
    });

    await syncService.runOnce();

    expect(state.pushes).toHaveLength(0);
  });

  it('also bumps on 5xx (no behavior regression in transient-error path)', async () => {
    seedPush({ entity_type: 'SERIES', op: 'CREATE' });
    mockPostWithTimeout.mockResolvedValueOnce({
      status: 503,
      data: null,
      error: 'service unavailable',
      headers: {},
    });

    await syncService.runOnce();

    expect(state.pushes).toHaveLength(1);
    expect(state.pushes[0].attempts).toBe(1);
    expect(state.pushes[0].last_error).toBe('503: service unavailable');
  });

  it('skips entries past MAX_PUSH_ATTEMPTS without calling the API', async () => {
    seedPush({ entity_type: 'TOPIC', op: 'CREATE', attempts: 8 });

    await syncService.runOnce();

    expect(mockPostWithTimeout).not.toHaveBeenCalled();
    // entry is preserved so a future enqueue (which resets attempts=0) destrava it
    expect(state.pushes).toHaveLength(1);
    expect(state.pushes[0].attempts).toBe(8);
  });
});
