import { topicService } from '../../src/services/topicService';
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
jest.mock('uuid', () => ({ v4: jest.fn(() => 'topic-uuid-1') }));
jest.mock('react-native-get-random-values', () => ({}));

describe('Topic Service', () => {
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

  describe('createTopic', () => {
    it('rejects duplicate title in same series', async () => {
      // First getFirstAsync (max_seq) returns a value; second (duplicate
      // check inside tx) returns an existing row.
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ max_seq: 5 })
        .mockResolvedValueOnce({ id: 'duplicate-topic' });

      await expect(
        topicService.createTopic({
          series_id: 'series-1',
          title: 'Aula 1',
          sequence_order: 0,
          suggested_date: null,
        } as any),
      ).rejects.toThrow(/já existe/);
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    it('enqueues CREATE on backend POST failure', async () => {
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ max_seq: null })
        .mockResolvedValueOnce(null); // no duplicate
      (apiClient.postWithTimeout as jest.Mock).mockResolvedValue({
        data: null,
        error: 'Sem conexão',
        status: 0,
        headers: {},
      });

      const topic = await topicService.createTopic({
        series_id: 'series-1',
        title: 'New Topic',
        sequence_order: 0,
        suggested_date: null,
      } as any);

      expect(topic.sequence_order).toBe(1); // auto-incremented
      expect(mockDb.runAsync).toHaveBeenCalled();
      expect(enqueueCatalogPush).toHaveBeenCalledWith(mockDb, {
        entityType: 'TOPIC',
        entityId: topic.id,
        op: 'CREATE',
        payload: expect.objectContaining({
          id: topic.id,
          series_id: 'series-1',
          title: 'New Topic',
        }),
        lastError: 'Sem conexão',
      });
    });

    it('normalizes pt-BR suggested_date to ISO YYYY-MM-DD on POST', async () => {
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ max_seq: 8 })
        .mockResolvedValueOnce(null); // no duplicate

      await topicService.createTopic({
        series_id: 'series-1',
        title: 'GULA — Fazendo da comida um deus',
        sequence_order: 0,
        suggested_date: '2026-MAI-02',
      } as any);

      expect(apiClient.postWithTimeout).toHaveBeenCalledWith(
        '/catalog/topics',
        expect.objectContaining({ suggested_date: '2026-05-02' }),
        expect.any(Number),
      );
    });

    it('keeps suggested_date null when input is empty', async () => {
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ max_seq: null })
        .mockResolvedValueOnce(null);

      await topicService.createTopic({
        series_id: 'series-1',
        title: 'No date',
        sequence_order: 0,
        suggested_date: null,
      } as any);

      expect(apiClient.postWithTimeout).toHaveBeenCalledWith(
        '/catalog/topics',
        expect.objectContaining({ suggested_date: null }),
        expect.any(Number),
      );
    });
  });

  describe('updateTopic', () => {
    it('filters out unknown columns from dynamic UPDATE', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({
        id: 't1',
        series_id: 's1',
        title: 'old',
        sequence_order: 1,
      });

      await topicService.updateTopic('t1', {
        id: 'attacker',
        created_at: '2020-01-01',
      } as any);

      // No tx (entries filtered to empty)
      expect(mockDb.withTransactionAsync).not.toHaveBeenCalled();
    });

    it('enqueues UPDATE when backend PATCH fails', async () => {
      // currentTopic lookup
      mockDb.getFirstAsync
        .mockResolvedValueOnce({
          id: 't1',
          series_id: 's1',
          title: 'old',
          sequence_order: 1,
          suggested_date: null,
        })
        // duplicate-title check inside tx
        .mockResolvedValueOnce(null);
      (apiClient.patchWithTimeout as jest.Mock).mockResolvedValue({
        data: null,
        error: 'Tempo limite atingido',
        status: 0,
        headers: {},
      });

      await topicService.updateTopic('t1', { title: 'New Title' });

      expect(mockDb.runAsync).toHaveBeenCalled();
      expect(enqueueCatalogPush).toHaveBeenCalledWith(mockDb, {
        entityType: 'TOPIC',
        entityId: 't1',
        op: 'UPDATE',
        payload: { title: 'New Title' },
        lastError: 'Tempo limite atingido',
      });
    });

    it('normalizes pt-BR suggested_date to ISO on PATCH body', async () => {
      mockDb.getFirstAsync
        .mockResolvedValueOnce({
          id: 't1',
          series_id: 's1',
          title: 'IDOLATRIA',
          sequence_order: 9,
          suggested_date: null,
        });

      await topicService.updateTopic('t1', { suggested_date: '2026-MAI-30' });

      expect(apiClient.patchWithTimeout).toHaveBeenCalledWith(
        '/catalog/topics/t1',
        { suggested_date: '2026-05-30' },
        expect.any(Number),
      );
    });

    it('normalizes suggested_date to ISO in 404 → CREATE fallback POST', async () => {
      // currentTopic lookup; then re-read for fallback fullPayload
      mockDb.getFirstAsync
        .mockResolvedValueOnce({
          id: 't1',
          series_id: 's1',
          title: 'old',
          sequence_order: 4,
          suggested_date: '2026-ABR-25',
        })
        .mockResolvedValueOnce({
          id: 't1',
          series_id: 's1',
          title: 'old',
          sequence_order: 4,
          suggested_date: '2026-ABR-25',
        });
      (apiClient.patchWithTimeout as jest.Mock).mockResolvedValue({
        data: null,
        error: 'Não encontrado',
        status: 404,
        headers: {},
      });
      (apiClient.postWithTimeout as jest.Mock).mockResolvedValue({
        data: null,
        error: null,
        status: 201,
        headers: {},
      });

      await topicService.updateTopic('t1', { sequence_order: 4 });

      expect(apiClient.postWithTimeout).toHaveBeenCalledWith(
        '/catalog/topics',
        expect.objectContaining({
          id: 't1',
          suggested_date: '2026-04-25',
        }),
        expect.any(Number),
      );
    });
  });
});
