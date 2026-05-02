import { seriesService } from '../../src/services/seriesService';
import { getDatabase } from '../../src/db/client';
import { apiClient } from '../../src/services/apiClient';
import { enqueueCatalogPush } from '../../src/services/catalogPushQueue';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('../../src/db/client');
jest.mock('../../src/services/apiClient', () => ({
  apiClient: {
    postWithTimeout: jest.fn(),
    patchWithTimeout: jest.fn(),
  },
  CATALOG_WRITE_TIMEOUT_MS: 30_000,
}));
jest.mock('../../src/services/catalogPushQueue', () => ({
  enqueueCatalogPush: jest.fn(),
}));
jest.mock('uuid', () => ({ v4: jest.fn(() => 'series-uuid-1') }));
jest.mock('react-native-get-random-values', () => ({}));

describe('Series Service', () => {
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {
      runAsync: jest.fn(),
      getAllAsync: jest.fn(),
      getFirstAsync: jest.fn(),
      withTransactionAsync: jest.fn((cb: () => Promise<unknown>) => cb()),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);
    (apiClient.postWithTimeout as jest.Mock).mockResolvedValue({
      data: null,
      error: null,
      status: 201,
      headers: {},
    });
    (apiClient.patchWithTimeout as jest.Mock).mockResolvedValue({
      data: null,
      error: null,
      status: 200,
      headers: {},
    });
    (enqueueCatalogPush as jest.Mock).mockResolvedValue(undefined);
  });

  describe('createSeries', () => {
    it('creates with normalized code and pushes to backend', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);

      const series = await seriesService.createSeries({
        code: ' eb354 ',
        title: 'Test Title',
        description: '  desc  ',
      } as any);

      expect(series.code).toBe('EB354'); // normalizeText uppercases + trims
      expect(series.title).toBe('Test Title');
      expect(series.description).toBe('desc');
      expect(mockDb.withTransactionAsync).toHaveBeenCalled();
      expect(apiClient.postWithTimeout).toHaveBeenCalledWith(
        '/catalog/series',
        expect.objectContaining({ code: 'EB354', title: 'Test Title' }),
        30_000,
      );
      expect(enqueueCatalogPush).not.toHaveBeenCalled();
    });

    it('rejects duplicate code inside the transaction', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ id: 'existing', code: 'EB354' });

      await expect(
        seriesService.createSeries({ code: 'EB354', title: 'X' } as any),
      ).rejects.toThrow(/já existe/);
      expect(mockDb.runAsync).not.toHaveBeenCalled();
      expect(apiClient.postWithTimeout).not.toHaveBeenCalled();
    });

    it('enqueues when backend POST fails (offline-first)', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);
      (apiClient.postWithTimeout as jest.Mock).mockResolvedValue({
        data: null,
        error: 'Sem conexão',
        status: 0,
        headers: {},
      });

      const series = await seriesService.createSeries({
        code: 'EB355',
        title: 'New',
      } as any);

      // Local INSERT happened
      expect(mockDb.runAsync).toHaveBeenCalled();
      expect(enqueueCatalogPush).toHaveBeenCalledWith(mockDb, {
        entityType: 'SERIES',
        entityId: series.id,
        op: 'CREATE',
        payload: expect.objectContaining({ id: series.id, code: 'EB355' }),
        lastError: 'Sem conexão',
      });
    });
  });

  describe('updateSeries', () => {
    it('filters caller-supplied keys outside the allowlist', async () => {
      // Smuggling `id` and `created_at` via Partial<>
      await seriesService.updateSeries('s1', {
        id: 'attacker',
        created_at: '2020-01-01',
      } as any);

      expect(mockDb.withTransactionAsync).not.toHaveBeenCalled();
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    it('rejects duplicate code on update inside transaction', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ id: 'other-series' });

      await expect(
        seriesService.updateSeries('s1', { code: 'EB354' }),
      ).rejects.toThrow(/já existe/);
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    it('enqueues UPDATE on PATCH timeout', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);
      (apiClient.patchWithTimeout as jest.Mock).mockResolvedValue({
        data: null,
        error: 'Tempo limite atingido',
        status: 0,
        headers: {},
      });

      await seriesService.updateSeries('s1', { title: 'Updated' });

      expect(mockDb.runAsync).toHaveBeenCalled();
      expect(enqueueCatalogPush).toHaveBeenCalledWith(mockDb, {
        entityType: 'SERIES',
        entityId: 's1',
        op: 'UPDATE',
        payload: { title: 'Updated' },
        lastError: 'Tempo limite atingido',
      });
    });
  });
});
