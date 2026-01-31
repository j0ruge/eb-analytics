import { getDatabase } from '../db/client';
import { Professor } from '../types/professor';
import { normalizeCpf, validateCpf } from '../utils/cpf';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export const professorService = {
  async createProfessor(data: { doc_id: string; name: string }): Promise<Professor> {
    const db = await getDatabase();
    
    // Validar CPF
    if (!validateCpf(data.doc_id)) {
      throw new Error('CPF inválido');
    }

    // Normalizar CPF (remover pontos e traços)
    const cleanDocId = normalizeCpf(data.doc_id);

    // Verificar se CPF já existe
    const existing = await db.getFirstAsync<Professor>(
      'SELECT * FROM professors WHERE doc_id = ?',
      [cleanDocId]
    );

    if (existing) {
      throw new Error('CPF já cadastrado');
    }

    const newProfessor: Professor = {
      id: uuidv4(),
      doc_id: cleanDocId,
      name: data.name.trim(),
      created_at: new Date().toISOString(),
    };

    await db.runAsync(
      `INSERT INTO professors (id, doc_id, name, created_at) VALUES (?, ?, ?, ?)`,
      [newProfessor.id, newProfessor.doc_id, newProfessor.name, newProfessor.created_at]
    );

    return newProfessor;
  },

  async getAllProfessors(): Promise<Professor[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync<Professor>(
      'SELECT * FROM professors ORDER BY name ASC'
    );
    return results;
  },

  async getById(id: string): Promise<Professor | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<Professor>(
      'SELECT * FROM professors WHERE id = ?',
      [id]
    );
    return result;
  },

  async updateProfessor(id: string, updates: Partial<Professor>): Promise<void> {
    const db = await getDatabase();
    
    // Filter out ID and created_at
    const entries = Object.entries(updates).filter(
      ([key]) => key !== 'id' && key !== 'created_at'
    );
    
    if (entries.length === 0) return;

    // Se estiver atualizando doc_id, validar CPF
    if (updates.doc_id) {
      if (!validateCpf(updates.doc_id)) {
        throw new Error('CPF inválido');
      }
      
      const cleanDocId = normalizeCpf(updates.doc_id);
      
      // Verificar se CPF já existe em outro professor
      const existing = await db.getFirstAsync<Professor>(
        'SELECT * FROM professors WHERE doc_id = ? AND id != ?',
        [cleanDocId, id]
      );

      if (existing) {
        throw new Error('CPF já cadastrado');
      }

      // Atualizar com CPF limpo
      updates.doc_id = cleanDocId;
    }

    const fields = entries.map(([key]) => key);
    const values = entries.map(([_, value]) => value === undefined ? null : value);

    const query = `UPDATE professors SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`;
    const params = [...values, id];

    await db.runAsync(query, params);
  },

  async deleteProfessor(id: string): Promise<void> {
    const db = await getDatabase();
    
    // Verificar se o professor tem aulas vinculadas (por professor_id ou professor_name)
    const lessonsCount = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM lessons_data WHERE professor_id = ? OR professor_name = (SELECT name FROM professors WHERE id = ?)',
      [id, id]
    );

    if (lessonsCount && lessonsCount.count > 0) {
      throw new Error('Não é possível excluir professor com aulas vinculadas');
    }

    await db.runAsync('DELETE FROM professors WHERE id = ?', [id]);
  }
};
