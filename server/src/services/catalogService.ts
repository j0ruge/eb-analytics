import { prisma } from '../lib/prisma.js';
import { Role } from '../lib/roles.js';
import { httpError } from '../lib/errors.js';

export interface ListCatalogOpts {
  since?: Date;
  includePending: boolean;
  actorRole: Role;
}

interface SerializedSeries {
  id: string;
  code: string;
  title: string;
  description: string | null;
  is_pending: boolean;
  updated_at: string;
}

interface SerializedTopic {
  id: string;
  series_id: string;
  title: string;
  sequence_order: number;
  suggested_date: string | null;
  is_pending: boolean;
  updated_at: string;
}

interface SerializedProfessor {
  id: string;
  name: string;
  email: string | null;
  is_pending: boolean;
  updated_at: string;
}

export interface CatalogResponse {
  series: SerializedSeries[];
  topics: SerializedTopic[];
  professors: SerializedProfessor[];
  server_now: string;
}

export interface CreateSeriesDto {
  id?: string;
  code: string;
  title: string;
  description?: string | null;
}

export interface UpdateSeriesDto {
  code?: string;
  title?: string;
  description?: string | null;
}

export interface CreateTopicDto {
  id?: string;
  series_id: string;
  title: string;
  sequence_order: number;
  suggested_date?: string | null;
}

export interface UpdateTopicDto {
  title?: string;
  sequence_order?: number;
  suggested_date?: string | null;
}

export interface CreateProfessorDto {
  id?: string;
  name: string;
  email?: string | null;
}

export interface UpdateProfessorDto {
  name?: string;
  email?: string | null;
}

function serializeSeries(s: {
  id: string;
  code: string;
  title: string;
  description: string | null;
  isPending: boolean;
  updatedAt: Date;
}): SerializedSeries {
  return {
    id: s.id,
    code: s.code,
    title: s.title,
    description: s.description,
    is_pending: s.isPending,
    updated_at: s.updatedAt.toISOString(),
  };
}

function serializeTopic(t: {
  id: string;
  seriesId: string;
  title: string;
  sequenceOrder: number;
  suggestedDate: Date | null;
  isPending: boolean;
  updatedAt: Date;
}): SerializedTopic {
  return {
    id: t.id,
    series_id: t.seriesId,
    title: t.title,
    sequence_order: t.sequenceOrder,
    suggested_date: t.suggestedDate ? t.suggestedDate.toISOString() : null,
    is_pending: t.isPending,
    updated_at: t.updatedAt.toISOString(),
  };
}

function serializeProfessor(p: {
  id: string;
  name: string;
  email: string | null;
  isPending: boolean;
  updatedAt: Date;
}): SerializedProfessor {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    is_pending: p.isPending,
    updated_at: p.updatedAt.toISOString(),
  };
}

function prismaErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return prismaErrorCode(err) === 'P2002';
}

function isPrismaRecordNotFound(err: unknown): boolean {
  return prismaErrorCode(err) === 'P2025';
}

function isPrismaForeignKeyViolation(err: unknown): boolean {
  return prismaErrorCode(err) === 'P2003';
}

/**
 * Extract `meta.target` from a Prisma `P2002` (unique violation) error.
 * Tells us *which* unique constraint was hit so we can distinguish
 * `id` collisions (idempotent replays) from `code`/`email` collisions
 * (real conflicts deserving a 409 with a specific code).
 */
function prismaUniqueTarget(err: unknown): string[] {
  if (!err || typeof err !== 'object') return [];
  const meta = (err as { meta?: { target?: unknown } }).meta;
  if (!meta || meta.target === undefined || meta.target === null) return [];
  if (Array.isArray(meta.target)) {
    return meta.target.filter((t): t is string => typeof t === 'string');
  }
  if (typeof meta.target === 'string') return [meta.target];
  return [];
}

/**
 * Parse an optional ISO-date string into a Date or null.
 * Throws httpError(invalid_payload) if the string is non-empty but unparseable.
 * A bare `new Date(badString)` yields `Invalid Date` and would silently corrupt
 * the row — we reject it at the API boundary instead.
 */
function parseOptionalDate(value: string | null | undefined, field: string): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') {
    throw httpError('invalid_payload', `${field} deve ser string ISO ou null.`, 400);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw httpError('invalid_payload', `${field} inválido.`, 400);
  }
  return d;
}

export const catalogService = {
  async listCatalog(opts: ListCatalogOpts): Promise<CatalogResponse> {
    // Hide pending items unless the caller is a coordinator who asked for them.
    const showPending = opts.includePending && opts.actorRole === Role.COORDINATOR;
    const pendingFilter = showPending ? {} : { isPending: false };
    const sinceFilter = opts.since ? { updatedAt: { gt: opts.since } } : {};

    const [series, topics, professors] = await Promise.all([
      prisma.lessonSeries.findMany({
        where: { ...pendingFilter, ...sinceFilter },
        orderBy: { code: 'asc' },
      }),
      prisma.lessonTopic.findMany({
        where: { ...pendingFilter, ...sinceFilter },
        orderBy: [{ seriesId: 'asc' }, { sequenceOrder: 'asc' }],
      }),
      prisma.professor.findMany({
        where: { ...pendingFilter, ...sinceFilter },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      series: series.map(serializeSeries),
      topics: topics.map(serializeTopic),
      professors: professors.map(serializeProfessor),
      server_now: new Date().toISOString(),
    };
  },

  // ---------------- Series mutations ----------------

  async createSeries(dto: CreateSeriesDto): Promise<SerializedSeries> {
    if (!dto.code || !dto.title) {
      throw httpError('invalid_payload', 'code e title obrigatórios.', 400);
    }
    const description = dto.description ?? null;
    // Idempotent create: if client supplies an `id` and the row already exists
    // with the SAME payload, return it. If the payload diverges, surface
    // id_conflict so the client doesn't silently see stale data on replay.
    const checkDivergence = (existing: { code: string; title: string; description: string | null }) => {
      if (
        existing.code !== dto.code ||
        existing.title !== dto.title ||
        (existing.description ?? null) !== description
      ) {
        throw httpError('id_conflict', 'ID já existe com payload diferente.', 409);
      }
    };
    if (dto.id) {
      const existing = await prisma.lessonSeries.findUnique({ where: { id: dto.id } });
      if (existing) {
        checkDivergence(existing);
        return serializeSeries(existing);
      }
    }
    try {
      const row = await prisma.lessonSeries.create({
        data: {
          ...(dto.id ? { id: dto.id } : {}),
          code: dto.code,
          title: dto.title,
          description,
          isPending: false,
        },
      });
      return serializeSeries(row);
    } catch (err) {
      if (isPrismaUniqueViolation(err)) {
        const target = prismaUniqueTarget(err);
        // Race: dto.id was created concurrently between our findUnique and create.
        // Re-fetch and treat as idempotent replay (with divergence check).
        if (dto.id && target.includes('id')) {
          const existing = await prisma.lessonSeries.findUnique({ where: { id: dto.id } });
          if (existing) {
            checkDivergence(existing);
            return serializeSeries(existing);
          }
        }
        throw httpError('code_already_exists', 'Código já existe.', 409);
      }
      throw err;
    }
  },

  async updateSeries(id: string, dto: UpdateSeriesDto): Promise<SerializedSeries> {
    try {
      const row = await prisma.lessonSeries.update({
        where: { id },
        data: {
          ...(dto.code !== undefined ? { code: dto.code } : {}),
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          isPending: false,
        },
      });
      return serializeSeries(row);
    } catch (err) {
      if (isPrismaRecordNotFound(err)) {
        throw httpError('not_found', 'Registro não encontrado.', 404);
      }
      if (isPrismaUniqueViolation(err)) {
        throw httpError('code_already_exists', 'Código já existe.', 409);
      }
      throw err;
    }
  },

  async deleteSeries(id: string): Promise<void> {
    // All checks + delete in one tx to close the TOCTOU on concurrent
    // sync ingests that might insert a LessonInstance using this
    // series code between the count and the delete.
    //
    // Even with the tx, an advisory-lock-free sync path can still race us
    // inside the tx window: catch the resulting P2003 (FK violation) and
    // surface it as the same 409 the app-level count check would.
    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.lessonSeries.findUnique({ where: { id } });
        if (!existing) {
          throw httpError('not_found', 'Registro não encontrado.', 404);
        }
        const usageCount = await tx.lessonInstance.count({
          where: { seriesCode: existing.code },
        });
        if (usageCount > 0) {
          throw httpError(
            'series_referenced',
            'Série não pode ser excluída enquanto houver aulas associadas.',
            409,
          );
        }
        const topicCount = await tx.lessonTopic.count({ where: { seriesId: id } });
        if (topicCount > 0) {
          throw httpError(
            'series_referenced',
            'Série possui tópicos vinculados.',
            409,
          );
        }
        await tx.lessonSeries.delete({ where: { id } });
      });
    } catch (err) {
      if (isPrismaForeignKeyViolation(err)) {
        throw httpError(
          'series_referenced',
          'Série não pode ser excluída: uma coleta concorrente a referenciou.',
          409,
        );
      }
      throw err;
    }
  },

  // ---------------- Topic mutations ----------------

  async createTopic(dto: CreateTopicDto): Promise<SerializedTopic> {
    if (!dto.series_id || !dto.title) {
      throw httpError('invalid_payload', 'series_id e title obrigatórios.', 400);
    }
    if (!Number.isInteger(dto.sequence_order) || (dto.sequence_order as number) < 0) {
      throw httpError(
        'invalid_payload',
        'sequence_order deve ser inteiro ≥ 0.',
        400,
      );
    }
    const suggestedDate = parseOptionalDate(dto.suggested_date, 'suggested_date');
    const checkDivergence = (existing: {
      seriesId: string;
      title: string;
      sequenceOrder: number;
      suggestedDate: Date | null;
    }) => {
      const existingDate = existing.suggestedDate ? existing.suggestedDate.toISOString() : null;
      const incomingDate = suggestedDate ? suggestedDate.toISOString() : null;
      if (
        existing.seriesId !== dto.series_id ||
        existing.title !== dto.title ||
        existing.sequenceOrder !== dto.sequence_order ||
        existingDate !== incomingDate
      ) {
        throw httpError('id_conflict', 'ID já existe com payload diferente.', 409);
      }
    };
    if (dto.id) {
      const existing = await prisma.lessonTopic.findUnique({ where: { id: dto.id } });
      if (existing) {
        checkDivergence(existing);
        return serializeTopic(existing);
      }
    }
    const series = await prisma.lessonSeries.findUnique({ where: { id: dto.series_id } });
    if (!series) {
      throw httpError('not_found', 'Série não encontrada.', 404);
    }
    try {
      const row = await prisma.lessonTopic.create({
        data: {
          ...(dto.id ? { id: dto.id } : {}),
          seriesId: dto.series_id,
          title: dto.title,
          sequenceOrder: dto.sequence_order,
          suggestedDate,
          isPending: false,
        },
      });
      return serializeTopic(row);
    } catch (err) {
      if (isPrismaUniqueViolation(err)) {
        const target = prismaUniqueTarget(err);
        if (dto.id && target.includes('id')) {
          const existing = await prisma.lessonTopic.findUnique({ where: { id: dto.id } });
          if (existing) {
            checkDivergence(existing);
            return serializeTopic(existing);
          }
        }
        throw httpError('invalid_payload', 'Tópico já existe.', 409);
      }
      // Race: series was deleted between our findUnique and create — surface as 404.
      if (isPrismaForeignKeyViolation(err)) {
        throw httpError('not_found', 'Série não encontrada.', 404);
      }
      throw err;
    }
  },

  async updateTopic(id: string, dto: UpdateTopicDto): Promise<SerializedTopic> {
    if (dto.sequence_order !== undefined) {
      if (!Number.isInteger(dto.sequence_order) || (dto.sequence_order as number) < 0) {
        throw httpError(
          'invalid_payload',
          'sequence_order deve ser inteiro ≥ 0.',
          400,
        );
      }
    }
    const suggestedDate =
      dto.suggested_date !== undefined
        ? parseOptionalDate(dto.suggested_date, 'suggested_date')
        : undefined;
    try {
      const row = await prisma.lessonTopic.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.sequence_order !== undefined ? { sequenceOrder: dto.sequence_order } : {}),
          ...(suggestedDate !== undefined ? { suggestedDate } : {}),
          isPending: false,
        },
      });
      return serializeTopic(row);
    } catch (err) {
      if (isPrismaRecordNotFound(err)) {
        throw httpError('not_found', 'Registro não encontrado.', 404);
      }
      throw err;
    }
  },

  async deleteTopic(id: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.lessonTopic.findUnique({ where: { id } });
      if (!existing) {
        throw httpError('not_found', 'Registro não encontrado.', 404);
      }
      const usageCount = await tx.lessonInstance.count({ where: { topicId: id } });
      if (usageCount > 0) {
        throw httpError(
          'topic_referenced',
          'Tópico não pode ser excluído enquanto houver aulas associadas.',
          409,
        );
      }
      await tx.lessonTopic.delete({ where: { id } });
    });
  },

  // ---------------- Professor mutations ----------------

  async createProfessor(dto: CreateProfessorDto): Promise<SerializedProfessor> {
    if (!dto.name) {
      throw httpError('invalid_payload', 'name obrigatório.', 400);
    }
    const email = dto.email ?? null;
    const checkDivergence = (existing: { name: string; email: string | null }) => {
      if (existing.name !== dto.name || (existing.email ?? null) !== email) {
        throw httpError('id_conflict', 'ID já existe com payload diferente.', 409);
      }
    };
    if (dto.id) {
      const existing = await prisma.professor.findUnique({ where: { id: dto.id } });
      if (existing) {
        checkDivergence(existing);
        return serializeProfessor(existing);
      }
    }
    try {
      const row = await prisma.professor.create({
        data: {
          ...(dto.id ? { id: dto.id } : {}),
          name: dto.name,
          email,
          isPending: false,
        },
      });
      return serializeProfessor(row);
    } catch (err) {
      if (isPrismaUniqueViolation(err)) {
        const target = prismaUniqueTarget(err);
        if (dto.id && target.includes('id')) {
          const existing = await prisma.professor.findUnique({ where: { id: dto.id } });
          if (existing) {
            checkDivergence(existing);
            return serializeProfessor(existing);
          }
        }
        throw httpError('email_already_exists', 'E-mail já existe.', 409);
      }
      throw err;
    }
  },

  async updateProfessor(id: string, dto: UpdateProfessorDto): Promise<SerializedProfessor> {
    try {
      const row = await prisma.professor.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.email !== undefined ? { email: dto.email } : {}),
          isPending: false,
        },
      });
      return serializeProfessor(row);
    } catch (err) {
      if (isPrismaRecordNotFound(err)) {
        throw httpError('not_found', 'Registro não encontrado.', 404);
      }
      if (isPrismaUniqueViolation(err)) {
        throw httpError('email_already_exists', 'E-mail já existe.', 409);
      }
      throw err;
    }
  },

  async deleteProfessor(id: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.professor.findUnique({ where: { id } });
      if (!existing) {
        throw httpError('not_found', 'Registro não encontrado.', 404);
      }
      const usageCount = await tx.lessonInstance.count({ where: { professorId: id } });
      if (usageCount > 0) {
        throw httpError(
          'professor_referenced',
          'Professor não pode ser excluído enquanto houver aulas associadas.',
          409,
        );
      }
      await tx.professor.delete({ where: { id } });
    });
  },
};
