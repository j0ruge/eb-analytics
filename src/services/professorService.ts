import { getDatabase } from '../db/client';
import { Professor } from '../types/professor';
import { normalizeCpf, validateCpf } from '../utils/cpf';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { apiClient, CATALOG_WRITE_TIMEOUT_MS } from './apiClient';
import { enqueueCatalogPush } from './catalogPushQueue';

// Whitelist of columns that may be patched via the dynamic UPDATE builder.
// Closes the door on caller-supplied keys (e.g. `id`, `created_at`) being
// silently rewritten through `Partial<Professor>`.
const PROFESSOR_PATCHABLE_COLUMNS: readonly (keyof Professor)[] = ['doc_id', 'name'];

export const professorService = {
  async createProfessor(data: { doc_id: string; name: string }): Promise<Professor> {
    const db = await getDatabase();

    if (!validateCpf(data.doc_id)) {
      throw new Error('CPF inválido');
    }

    const cleanDocId = normalizeCpf(data.doc_id);

    const newProfessor: Professor = {
      id: uuidv4(),
      doc_id: cleanDocId,
      name: data.name.trim(),
      created_at: new Date().toISOString(),
    };

    // Atomic: uniqueness check + insert in one transaction so two concurrent
    // creates with the same CPF can't both pass the check.
    await db.withTransactionAsync(async () => {
      const existing = await db.getFirstAsync<Professor>(
        'SELECT * FROM professors WHERE doc_id = ?',
        [cleanDocId],
      );
      if (existing) {
        throw new Error('CPF já cadastrado');
      }
      await db.runAsync(
        `INSERT INTO professors (id, doc_id, name, created_at) VALUES (?, ?, ?, ?)`,
        [newProfessor.id, newProfessor.doc_id, newProfessor.name, newProfessor.created_at],
      );
    });

    // Push to backend with timeout. Local row is committed; on failure we
    // enqueue for the drainer to retry instead of throwing — offline-first.
    const r = await apiClient.postWithTimeout(
      '/catalog/professors',
      { id: newProfessor.id, name: newProfessor.name },
      CATALOG_WRITE_TIMEOUT_MS,
    );
    if (r.error) {
      await enqueueCatalogPush(db, {
        entityType: 'PROFESSOR',
        entityId: newProfessor.id,
        op: 'CREATE',
        payload: { id: newProfessor.id, name: newProfessor.name },
        lastError: r.error,
      });
    }

    return newProfessor;
  },

  async getAllProfessors(): Promise<Professor[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync<Professor>(
      'SELECT * FROM professors ORDER BY name ASC',
    );
    return results;
  },

  async getById(id: string): Promise<Professor | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<Professor>(
      'SELECT * FROM professors WHERE id = ?',
      [id],
    );
    return result;
  },

  async updateProfessor(id: string, updates: Partial<Professor>): Promise<void> {
    const db = await getDatabase();

    // Filter to allowlisted columns only — protects against `Partial<Professor>`
    // ever growing fields we don't intend to expose to the dynamic UPDATE.
    const entries = Object.entries(updates).filter(([key]) =>
      (PROFESSOR_PATCHABLE_COLUMNS as readonly string[]).includes(key),
    );
    if (entries.length === 0) return;

    let cleanDocId: string | null = null;
    if (updates.doc_id !== undefined) {
      if (!validateCpf(updates.doc_id)) {
        throw new Error('CPF inválido');
      }
      cleanDocId = normalizeCpf(updates.doc_id);
    }

    const trimmedName = updates.name !== undefined ? updates.name.trim() : null;

    // Atomic: uniqueness check + UPDATE in one tx — closes TOCTOU on rapid
    // duplicate calls (debounced autosave double-fire, network retry).
    await db.withTransactionAsync(async () => {
      if (cleanDocId !== null) {
        const dup = await db.getFirstAsync<Professor>(
          'SELECT * FROM professors WHERE doc_id = ? AND id != ?',
          [cleanDocId, id],
        );
        if (dup) {
          throw new Error('CPF já cadastrado');
        }
      }
      const fields: string[] = [];
      const values: unknown[] = [];
      if (cleanDocId !== null) {
        fields.push('doc_id');
        values.push(cleanDocId);
      }
      if (trimmedName !== null) {
        fields.push('name');
        values.push(trimmedName);
      }
      if (fields.length === 0) return;
      await db.runAsync(
        `UPDATE professors SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`,
        [...values, id],
      );
    });

    // Push to backend (catalog write-back). Only `name` maps server-side.
    if (trimmedName !== null) {
      const r = await apiClient.patchWithTimeout(
        `/catalog/professors/${id}`,
        { name: trimmedName },
        CATALOG_WRITE_TIMEOUT_MS,
      );
      if (r.status === 404) {
        // Row exists locally but not on server — POST with the local id so
        // future sync_batch calls can resolve professor_id.
        const post = await apiClient.postWithTimeout(
          '/catalog/professors',
          { id, name: trimmedName },
          CATALOG_WRITE_TIMEOUT_MS,
        );
        if (post.error) {
          await enqueueCatalogPush(db, {
            entityType: 'PROFESSOR',
            entityId: id,
            op: 'CREATE',
            payload: { id, name: trimmedName },
            lastError: post.error,
          });
        }
      } else if (r.error) {
        await enqueueCatalogPush(db, {
          entityType: 'PROFESSOR',
          entityId: id,
          op: 'UPDATE',
          payload: { name: trimmedName },
          lastError: r.error,
        });
      }
    }
  },

  async deleteProfessor(id: string): Promise<void> {
    const db = await getDatabase();

    const lessonsCount = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM lessons_data WHERE professor_id = ? OR professor_name = (SELECT name FROM professors WHERE id = ?)',
      [id, id],
    );

    if (lessonsCount && lessonsCount.count > 0) {
      throw new Error('Não é possível excluir professor com aulas vinculadas');
    }

    await db.runAsync('DELETE FROM professors WHERE id = ?', [id]);
  },
};
