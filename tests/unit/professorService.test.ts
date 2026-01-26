import { professorService } from '../../src/services/professorService';

// Mock expo-sqlite module
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

// Mock database client
jest.mock('../../src/db/client');

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123'),
}));

// Mock react-native-get-random-values
jest.mock('react-native-get-random-values', () => ({}));

import { getDatabase } from '../../src/db/client';

describe('Professor Service', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      runAsync: jest.fn(),
      getAllAsync: jest.fn(),
      getFirstAsync: jest.fn(),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);
  });

  describe('createProfessor', () => {
    it('should create professor with valid CPF', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null); // No existing professor

      const professor = await professorService.createProfessor({
        doc_id: '111.444.777-35',
        name: 'João Silva',
      });

      expect(professor.name).toBe('João Silva');
      expect(professor.doc_id).toBe('11144477735'); // Normalized
      expect(professor.id).toBeDefined();
      expect(mockDb.runAsync).toHaveBeenCalled();
    });

    it('should reject invalid CPF', async () => {
      await expect(
        professorService.createProfessor({
          doc_id: '123.456.789-00',
          name: 'João Silva',
        })
      ).rejects.toThrow('CPF inválido');
    });

    it('should reject duplicate CPF', async () => {
      mockDb.getFirstAsync.mockResolvedValue({
        id: 'existing-id',
        doc_id: '11144477735',
        name: 'Existing Professor',
      });

      await expect(
        professorService.createProfessor({
          doc_id: '111.444.777-35',
          name: 'João Silva',
        })
      ).rejects.toThrow('CPF já cadastrado');
    });
  });

  describe('getAllProfessors', () => {
    it('should return all professors ordered by name', async () => {
      const mockProfessors = [
        { id: '1', doc_id: '11144477735', name: 'Ana Silva', created_at: '2026-01-25' },
        { id: '2', doc_id: '52998224725', name: 'Bruno Costa', created_at: '2026-01-25' },
      ];

      mockDb.getAllAsync.mockResolvedValue(mockProfessors);

      const result = await professorService.getAllProfessors();

      expect(result).toEqual(mockProfessors);
      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY name ASC')
      );
    });
  });

  describe('deleteProfessor', () => {
    it('should prevent deletion if professor has lessons', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ count: 3 });

      await expect(
        professorService.deleteProfessor('professor-id')
      ).rejects.toThrow('Não é possível excluir professor com aulas vinculadas');
    });

    it('should delete professor without lessons', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ count: 0 });

      await professorService.deleteProfessor('professor-id');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'DELETE FROM professors WHERE id = ?',
        ['professor-id']
      );
    });
  });
});
