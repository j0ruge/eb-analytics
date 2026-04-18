import { httpError } from './errors.js';

/**
 * Exact string literal — MUST match the `const` in
 * specs/005-export-contract-v2/contracts/export-envelope.v2.schema.json.
 * Any drift (e.g. "2") would reject every valid client payload (research §7).
 */
export const SUPPORTED_SCHEMA_VERSION = '2.0' as const;

export function assertSchemaVersion(body: { schema_version?: unknown }): void {
  const raw = body.schema_version;
  if (raw === undefined || raw === null || raw === '') {
    throw httpError('schema_version_required', 'O campo schema_version é obrigatório.', 400);
  }
  if (raw !== SUPPORTED_SCHEMA_VERSION) {
    throw httpError(
      'schema_version_unsupported',
      'Versão de schema não suportada — esperada v2.',
      400,
    );
  }
}
