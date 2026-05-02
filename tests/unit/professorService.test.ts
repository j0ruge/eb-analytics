import { professorService } from '../../src/services/professorService';
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
jest.mock('uuid', () => ({ v4: jest.fn(() => 'test-uuid-123') }));
jest.mock('react-native-get-random-values', () => ({}));

describe('Professor Service', () => {
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {
      runAsync: jest.fn(),
      getAllAsync: jest.fn(),
      getFirstAsync: jest.fn(),
      // withTransactionAsync runs the callback inline so the test asserts on
      // the same mock calls it would in production. The real expo-sqlite
      // semantics (rollback on throw) are not exercised here — that is the
      // responsibility of integration tests.
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

  describe('createProfessor', () => {
    it('creates with valid CPF and pushes to backend', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);

      const professor = await professorService.createProfessor({
        doc_id: '111.444.777-35',
        name: 'João Silva',
      });

      expect(professor.name).toBe('João Silva');
      expect(professor.doc_id).toBe('11144477735');
      expect(mockDb.withTransactionAsync).toHaveBeenCalled();
      expect(mockDb.runAsync).toHaveBeenCalled();
      expect(apiClient.postWithTimeout).toHaveBeenCalledWith(
        '/catalog/professors',
        { id: professor.id, name: 'João Silva' },
        30_000,
      );
      expect(enqueueCatalogPush).not.toHaveBeenCalled();
    });

    it('rejects invalid CPF before any DB work', async () => {
      await expect(
        professorService.createProfessor({
          doc_id: '123.456.789-00',
          name: 'João Silva',
        }),
      ).rejects.toThrow('CPF inválido');
      expect(mockDb.withTransactionAsync).not.toHaveBeenCalled();
    });

    it('rejects duplicate CPF inside the transaction', async () => {
      mockDb.getFirstAsync.mockResolvedValue({
        id: 'existing-id',
        doc_id: '11144477735',
        name: 'Existing Professor',
      });

      await expect(
        professorService.createProfessor({
          doc_id: '111.444.777-35',
          name: 'João Silva',
        }),
      ).rejects.toThrow('CPF já cadastrado');
      // INSERT must NOT have happened
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    it('enqueues catalog push when backend POST fails', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);
      (apiClient.postWithTimeout as jest.Mock).mockResolvedValue({
        data: null,
        error: 'Sem conexão',
        status: 0,
        headers: {},
      });

      const professor = await professorService.createProfessor({
        doc_id: '111.444.777-35',
        name: 'João Silva',
      });

      // Local INSERT succeeded
      expect(mockDb.runAsync).toHaveBeenCalled();
      // Backend failure → enqueued, NOT thrown
      expect(enqueueCatalogPush).toHaveBeenCalledWith(mockDb, {
        entityType: 'PROFESSOR',
        entityId: professor.id,
        op: 'CREATE',
        payload: { id: professor.id, name: 'João Silva' },
        lastError: 'Sem conexão',
      });
    });
  });

  describe('updateProfessor', () => {
    it('rejects updates to columns outside the allowlist (no-op)', async () => {
      // Caller smuggles `id` in via Partial<Professor>. Allowlist filters it
      // out so the dynamic UPDATE does NOT rewrite the primary key.
      await professorService.updateProfessor('p1', {
        id: 'attacker-id',
        created_at: '2026-01-01',
      } as any);

      expect(mockDb.withTransactionAsync).not.toHaveBeenCalled();
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    it('checks doc_id uniqueness inside the transaction', async () => {
      // Duplicate found
      mockDb.getFirstAsync.mockResolvedValue({
        id: 'other-id',
        doc_id: '11144477735',
        name: 'Other',
      });

      await expect(
        professorService.updateProfessor('p1', {
          doc_id: '111.444.777-35',
        }),
      ).rejects.toThrow('CPF já cadastrado');
      // UPDATE must NOT have run
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    it('enqueues UPDATE on backend PATCH failure (non-404)', async () => {
      (apiClient.patchWithTimeout as jest.Mock).mockResolvedValue({
        data: null,
        error: 'Tempo limite atingido',
        status: 0,
        headers: {},
      });

      await professorService.updateProfessor('p1', { name: '  Maria  ' });

      // Local UPDATE happened (transaction ran)
      expect(mockDb.runAsync).toHaveBeenCalled();
      expect(enqueueCatalogPush).toHaveBeenCalledWith(mockDb, {
        entityType: 'PROFESSOR',
        entityId: 'p1',
        op: 'UPDATE',
        payload: { name: 'Maria' },
        lastError: 'Tempo limite atingido',
      });
    });

    it('falls back to POST on PATCH 404 and enqueues if POST also fails', async () => {
      (apiClient.patchWithTimeout as jest.Mock).mockResolvedValue({
        data: null,
        error: 'not found',
        status: 404,
        headers: {},
      });
      (apiClient.postWithTimeout as jest.Mock).mockResolvedValue({
        data: null,
        error: 'Sem conexão',
        status: 0,
        headers: {},
      });

      await professorService.updateProfessor('p1', { name: 'Maria' });

      expect(apiClient.postWithTimeout).toHaveBeenCalledWith(
        '/catalog/professors',
        { id: 'p1', name: 'Maria' },
        30_000,
      );
      expect(enqueueCatalogPush).toHaveBeenCalledWith(mockDb, {
        entityType: 'PROFESSOR',
        entityId: 'p1',
        op: 'CREATE',
        payload: { id: 'p1', name: 'Maria' },
        lastError: 'Sem conexão',
      });
    });
  });

  describe('deleteProfessor', () => {
    it('prevents deletion when lessons reference the professor', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ count: 3 });

      await expect(
        professorService.deleteProfessor('professor-id'),
      ).rejects.toThrow('Não é possível excluir professor com aulas vinculadas');
    });

    it('deletes professor without lessons', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ count: 0 });

      await professorService.deleteProfessor('professor-id');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'DELETE FROM professors WHERE id = ?',
        ['professor-id'],
      );
    });
  });
});
