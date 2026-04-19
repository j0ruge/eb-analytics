/**
 * Spec 008 — catalogSyncService behavior per contracts/catalog-service.md.
 * Verifies cursor advance, trigger-gated skip-when-unauthenticated, offline
 * handling, and upsert idempotency.
 */

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('uuid', () => ({ v4: jest.fn(() => 'fixed') }));
jest.mock('react-native-get-random-values', () => ({}));

const mockGetWithTimeout = jest.fn();
const mockGetSession = jest.fn();
const mockGetDatabase = jest.fn();
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockRemoveItem = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
    removeItem: (...args: unknown[]) => mockRemoveItem(...args),
  },
}));
jest.mock('../../src/db/client', () => ({
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
}));
jest.mock('../../src/services/apiClient', () => ({
  apiClient: {
    getWithTimeout: (...args: unknown[]) => mockGetWithTimeout(...args),
  },
}));
jest.mock('../../src/services/authService', () => ({
  authService: { getSession: (...args: unknown[]) => mockGetSession(...args) },
}));

import { catalogSyncService } from '../../src/services/catalogSyncService';

interface UpsertRow {
  table: 'lesson_series' | 'lesson_topics' | 'professors';
  id: string;
}

function makeFakeDb() {
  const upserts: UpsertRow[] = [];
  return {
    upserts,
    db: {
      async runAsync(sql: string, params?: unknown[]) {
        const s = sql.replace(/\s+/g, ' ').trim();
        if (s.startsWith('INSERT INTO lesson_series')) {
          upserts.push({ table: 'lesson_series', id: params?.[0] as string });
          return;
        }
        if (s.startsWith('INSERT INTO lesson_topics')) {
          upserts.push({ table: 'lesson_topics', id: params?.[0] as string });
          return;
        }
        if (s.startsWith('INSERT INTO professors')) {
          upserts.push({ table: 'professors', id: params?.[0] as string });
          return;
        }
        throw new Error('Unexpected runAsync: ' + s);
      },
      async withTransactionAsync(task: () => Promise<void>) {
        await task();
      },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue({ user: { id: 'user-1', display_name: 'Test' } });
  mockGetItem.mockResolvedValue(null);
});

describe('catalogSyncService.pullNow', () => {
  it('returns skipped:true when unauthenticated regardless of trigger', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const auto = await catalogSyncService.pullNow('auto');
    expect(auto.ok).toBe(false);
    expect(auto.skipped).toBe(true);
    expect(mockGetWithTimeout).not.toHaveBeenCalled();

    mockGetSession.mockResolvedValueOnce(null);
    const manual = await catalogSyncService.pullNow('manual');
    expect(manual.skipped).toBe(true);
  });

  it('first run fires GET /catalog without `since`', async () => {
    const fake = makeFakeDb();
    mockGetDatabase.mockResolvedValue(fake.db);
    mockGetWithTimeout.mockResolvedValueOnce({
      status: 200,
      data: {
        series: [{ id: 's1', code: 'EB1', title: 'T', description: null, updated_at: 'u1' }],
        topics: [],
        professors: [],
        server_now: '2026-04-18T13:00:00.000Z',
      },
      error: null,
      headers: {},
    });

    const result = await catalogSyncService.pullNow('auto');

    expect(mockGetWithTimeout).toHaveBeenCalledWith('/catalog', 30_000);
    expect(result.ok).toBe(true);
    expect(result.counts).toEqual({ series: 1, topics: 0, professors: 0 });
    expect(mockSetItem).toHaveBeenCalledWith(
      '@eb-insights/last-catalog-sync',
      '2026-04-18T13:00:00.000Z',
    );
  });

  it('subsequent runs include the cursor via ?since=', async () => {
    const fake = makeFakeDb();
    mockGetDatabase.mockResolvedValue(fake.db);
    mockGetItem.mockResolvedValueOnce('2026-04-17T10:00:00.000Z');
    mockGetWithTimeout.mockResolvedValueOnce({
      status: 200,
      data: { series: [], topics: [], professors: [], server_now: '2026-04-18T13:00:00.000Z' },
      error: null,
      headers: {},
    });

    await catalogSyncService.pullNow('auto');

    expect(mockGetWithTimeout).toHaveBeenCalledWith(
      `/catalog?since=${encodeURIComponent('2026-04-17T10:00:00.000Z')}`,
      30_000,
    );
  });

  it('offline (status 0) returns { ok:false, offline:true } and does NOT advance cursor', async () => {
    mockGetWithTimeout.mockResolvedValueOnce({
      status: 0,
      data: null,
      error: 'Sem conexão',
      headers: {},
    });
    const result = await catalogSyncService.pullNow('manual');
    expect(result.ok).toBe(false);
    expect(result.offline).toBe(true);
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('server error returns { ok:false, error } and does NOT advance cursor', async () => {
    mockGetWithTimeout.mockResolvedValueOnce({
      status: 500,
      data: null,
      error: 'Servidor caiu',
      headers: {},
    });
    const result = await catalogSyncService.pullNow('manual');
    expect(result.ok).toBe(false);
    expect(result.offline).toBe(false);
    expect(result.error).toBe('Servidor caiu');
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('upsert is idempotent — same payload twice yields same row set', async () => {
    const fake1 = makeFakeDb();
    const fake2 = makeFakeDb();
    mockGetDatabase.mockResolvedValueOnce(fake1.db).mockResolvedValueOnce(fake2.db);

    const payload = {
      series: [
        { id: 's1', code: 'EB1', title: 'T1', description: null, updated_at: 'u1' },
      ],
      topics: [
        {
          id: 't1',
          series_id: 's1',
          title: 'Topic',
          sequence_order: 1,
          suggested_date: null,
          updated_at: 'u1',
        },
      ],
      professors: [
        { id: 'p1', name: 'Alex', email: null, updated_at: 'u1' },
      ],
      server_now: '2026-04-18T13:00:00.000Z',
    };

    mockGetWithTimeout
      .mockResolvedValueOnce({ status: 200, data: payload, error: null, headers: {} })
      .mockResolvedValueOnce({ status: 200, data: payload, error: null, headers: {} });

    await catalogSyncService.pullNow('auto');
    await catalogSyncService.pullNow('auto');

    // Same number of upsert calls each run (ON CONFLICT handles both).
    expect(fake1.upserts).toHaveLength(3);
    expect(fake2.upserts).toHaveLength(3);
    expect(fake1.upserts.map((u) => u.id)).toEqual(fake2.upserts.map((u) => u.id));
  });
});

describe('catalogSyncService cursor accessors', () => {
  it('getLastSyncAt returns stored cursor', async () => {
    mockGetItem.mockResolvedValueOnce('2026-04-18T00:00:00.000Z');
    const got = await catalogSyncService.getLastSyncAt();
    expect(got).toBe('2026-04-18T00:00:00.000Z');
  });

  it('resetCursor removes the key', async () => {
    await catalogSyncService.resetCursor();
    expect(mockRemoveItem).toHaveBeenCalledWith('@eb-insights/last-catalog-sync');
  });
});
