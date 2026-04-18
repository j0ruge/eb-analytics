import { prisma } from '../lib/prisma.js';
import { aggregateService, type Tx } from './aggregateService.js';
import { assertSchemaVersion } from '../lib/schemaVersion.js';
import { httpError } from '../lib/errors.js';

const MAX_COLLECTIONS_PER_BATCH = 500;
const HH_MM = /^[0-9]{2}:[0-9]{2}$/;
const ISO_DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

// ---------------- Payload shape ----------------

export interface SyncPayload {
  schema_version?: unknown;
  collections?: unknown;
}

interface CollectionInput {
  id: string;
  client_created_at: string;
  client_updated_at: string;
  status?: string;
  lesson_instance: {
    date: string;
    series_id: string | null;
    series_code_fallback: string | null;
    topic_id: string | null;
    topic_title_fallback: string | null;
    professor_id: string | null;
    professor_name_fallback: string | null;
  };
  times: {
    expected_start: string;
    expected_end: string;
    real_start: string | null;
    real_end: string | null;
  };
  attendance: {
    start: number;
    mid: number;
    end: number;
    includes_professor: boolean;
  };
  unique_participants: number;
  weather: string | null;
  notes: string | null;
}

export interface SyncResult {
  accepted: string[];
  rejected: Array<{ id: string; code: string; message: string }>;
  server_now: string;
}

type PerCollectionError = { code: string; message: string };

class CollectionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// ---------------- Payload sanity guards ----------------

function isObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

function assertBatchShape(payload: SyncPayload): CollectionInput[] {
  assertSchemaVersion(payload);
  const collections = payload.collections;
  if (!Array.isArray(collections)) {
    throw httpError('invalid_payload', 'O campo collections é obrigatório.', 400);
  }
  if (collections.length === 0) {
    throw httpError('invalid_payload', 'collections não pode estar vazio.', 400);
  }
  if (collections.length > MAX_COLLECTIONS_PER_BATCH) {
    throw httpError(
      'batch_too_large',
      'Lote excede o limite (máx. 500 coletas ou 5 MB).',
      413,
    );
  }
  return collections as CollectionInput[];
}

/**
 * Structural validation needed BEFORE we can resolve a LessonInstance.
 * Must pass for the row to be persistable at all (even as REJECTED).
 */
function validateInstanceStructure(c: CollectionInput): void {
  if (!c.id || typeof c.id !== 'string') {
    throw new CollectionError('invalid_collection_payload', 'id ausente.');
  }
  if (!isObject(c.lesson_instance)) {
    throw new CollectionError('invalid_collection_payload', 'lesson_instance ausente.');
  }
  if (!ISO_DATE.test(c.lesson_instance.date)) {
    throw new CollectionError('invalid_collection_payload', 'date inválida.');
  }
  if (
    Number.isNaN(Date.parse(c.client_created_at)) ||
    Number.isNaN(Date.parse(c.client_updated_at))
  ) {
    throw new CollectionError('invalid_collection_payload', 'timestamps inválidos.');
  }
}

/**
 * Remaining validation. If this fails we still have a lesson instance id, so
 * we persist the row as REJECTED per FR-025 + FR-043 — clients can read back
 * rejection reasons via GET /collections?mine=true.
 */
function validateCollectionData(c: CollectionInput): void {
  if (!isObject(c.times) || !isObject(c.attendance)) {
    throw new CollectionError('invalid_collection_payload', 'times ou attendance ausentes.');
  }
  if (!HH_MM.test(c.times.expected_start) || !HH_MM.test(c.times.expected_end)) {
    throw new CollectionError('invalid_collection_payload', 'expected_start/end inválidos.');
  }
  if (c.times.real_start !== null && !HH_MM.test(c.times.real_start)) {
    throw new CollectionError('invalid_collection_payload', 'real_start inválido.');
  }
  if (c.times.real_end !== null && !HH_MM.test(c.times.real_end)) {
    throw new CollectionError('invalid_collection_payload', 'real_end inválido.');
  }
  for (const [k, v] of [
    ['attendance.start', c.attendance.start],
    ['attendance.mid', c.attendance.mid],
    ['attendance.end', c.attendance.end],
    ['unique_participants', c.unique_participants],
  ] as const) {
    if (!Number.isInteger(v) || v < 0) {
      throw new CollectionError('invalid_collection_payload', `${k} deve ser inteiro ≥ 0.`);
    }
  }
  if (typeof c.attendance.includes_professor !== 'boolean') {
    throw new CollectionError(
      'invalid_collection_payload',
      'includes_professor deve ser boolean.',
    );
  }
}

// ---------------- Catalog resolution ----------------

async function resolveSeries(
  tx: Tx,
  seriesId: string | null,
  fallback: string | null,
): Promise<{ id: string; code: string }> {
  if (seriesId) {
    const row = await tx.lessonSeries.findUnique({ where: { id: seriesId } });
    if (!row) throw new CollectionError('missing_catalog_reference', 'series_id não encontrado.');
    return { id: row.id, code: row.code };
  }
  if (!fallback) {
    throw new CollectionError('missing_catalog_reference', 'Série não informada.');
  }
  const existing = await tx.lessonSeries.findUnique({ where: { code: fallback } });
  if (existing) {
    return { id: existing.id, code: existing.code };
  }
  const created = await tx.lessonSeries.create({
    data: {
      code: fallback,
      title: `${fallback} (auto)`,
      isPending: true,
    },
  });
  return { id: created.id, code: created.code };
}

async function resolveTopic(
  tx: Tx,
  seriesId: string,
  topicId: string | null,
  fallback: string | null,
): Promise<string | null> {
  if (topicId) {
    const row = await tx.lessonTopic.findUnique({ where: { id: topicId } });
    if (!row) throw new CollectionError('missing_catalog_reference', 'topic_id não encontrado.');
    return row.id;
  }
  if (!fallback) {
    return null;
  }
  const existing = await tx.lessonTopic.findFirst({
    where: { seriesId, title: fallback },
  });
  if (existing) return existing.id;
  const maxOrder = await tx.lessonTopic.aggregate({
    where: { seriesId },
    _max: { sequenceOrder: true },
  });
  const created = await tx.lessonTopic.create({
    data: {
      seriesId,
      title: fallback,
      sequenceOrder: (maxOrder._max.sequenceOrder ?? 0) + 1,
      isPending: true,
    },
  });
  return created.id;
}

async function resolveProfessor(
  tx: Tx,
  professorId: string | null,
  fallback: string | null,
): Promise<string | null> {
  if (professorId) {
    const row = await tx.professor.findUnique({ where: { id: professorId } });
    if (!row) throw new CollectionError('missing_catalog_reference', 'professor_id não encontrado.');
    return row.id;
  }
  if (!fallback) {
    return null;
  }
  const existing = await tx.professor.findFirst({ where: { name: fallback } });
  if (existing) return existing.id;
  const created = await tx.professor.create({
    data: {
      name: fallback,
      email: null,
      isPending: true,
    },
  });
  return created.id;
}

// ---------------- LessonInstance upsert ----------------

async function upsertInstance(
  tx: Tx,
  args: { date: Date; seriesCode: string; topicId: string | null; professorId: string | null },
): Promise<string> {
  const existing = await tx.lessonInstance.findFirst({
    where: {
      date: args.date,
      seriesCode: args.seriesCode,
      topicId: args.topicId,
    },
  });
  if (existing) {
    // If this instance was created without a professor and we now have one, patch it in.
    if (!existing.professorId && args.professorId) {
      await tx.lessonInstance.update({
        where: { id: existing.id },
        data: { professorId: args.professorId },
      });
    }
    return existing.id;
  }
  const created = await tx.lessonInstance.create({
    data: {
      date: args.date,
      seriesCode: args.seriesCode,
      topicId: args.topicId,
      professorId: args.professorId,
    },
  });
  return created.id;
}

// ---------------- Main entry point ----------------

export const syncService = {
  async ingestBatch(userId: string, payload: SyncPayload): Promise<SyncResult> {
    const collections = assertBatchShape(payload);

    const accepted: string[] = [];
    const rejected: Array<{ id: string; code: string; message: string }> = [];

    await prisma.$transaction(
      async (tx) => {
        const touchedInstances = new Set<string>();

        for (const c of collections) {
          let instanceId: string | null = null;
          let preInstanceError: PerCollectionError | null = null;
          let dataError: PerCollectionError | null = null;

          // Step 1: fields needed to pin this row to a LessonInstance.
          try {
            validateInstanceStructure(c);
            const series = await resolveSeries(
              tx,
              c.lesson_instance.series_id,
              c.lesson_instance.series_code_fallback,
            );
            const topicId = await resolveTopic(
              tx,
              series.id,
              c.lesson_instance.topic_id,
              c.lesson_instance.topic_title_fallback,
            );
            const professorId = await resolveProfessor(
              tx,
              c.lesson_instance.professor_id,
              c.lesson_instance.professor_name_fallback,
            );
            instanceId = await upsertInstance(tx, {
              date: new Date(c.lesson_instance.date),
              seriesCode: series.code,
              topicId,
              professorId,
            });
          } catch (err) {
            if (!(err instanceof CollectionError)) throw err;
            preInstanceError = { code: err.code, message: err.message };
          }

          if (instanceId === null) {
            // Cannot persist without an instance id — response-only rejection.
            const fallback = preInstanceError ?? {
              code: 'invalid_collection_payload',
              message: 'Coleta inválida.',
            };
            rejected.push({ id: c.id, ...fallback });
            continue;
          }

          // Step 2: validate remaining fields. Failure is persistable — the
          // row is stored as REJECTED so FR-043 can surface the reason.
          try {
            validateCollectionData(c);
          } catch (err) {
            if (!(err instanceof CollectionError)) throw err;
            dataError = { code: err.code, message: err.message };
          }

          // Serialize concurrent writers on this instance (research §9).
          await tx.$executeRawUnsafe(
            `SELECT pg_advisory_xact_lock(hashtext($1))`,
            instanceId,
          );
          touchedInstances.add(instanceId);

          const existing = await tx.lessonCollection.findUnique({ where: { id: c.id } });
          const newUpdatedAt = new Date(c.client_updated_at);

          if (existing) {
            const existingUpdatedAt = existing.clientUpdatedAt;
            if (newUpdatedAt.getTime() > existingUpdatedAt.getTime()) {
              // Field-level merge — client-authored fields only.
              // Server-only fields (acceptedOverride, status, rejectionReason,
              // serverReceivedAt) are preserved per FR-021 + T028.
              await tx.lessonCollection.update({
                where: { id: c.id },
                data: {
                  clientUpdatedAt: newUpdatedAt,
                  expectedStart: c.times.expected_start,
                  expectedEnd: c.times.expected_end,
                  realStart: c.times.real_start,
                  realEnd: c.times.real_end,
                  attendanceStart: c.attendance.start,
                  attendanceMid: c.attendance.mid,
                  attendanceEnd: c.attendance.end,
                  includesProfessor: c.attendance.includes_professor,
                  uniqueParticipants: c.unique_participants,
                  weather: c.weather,
                  notes: c.notes,
                },
              });
            }
            // Older-or-equal clientUpdatedAt: idempotent no-op (FR-021).
            // Report the id in accepted[] so the client sees it's durable.
            if (existing.status === 'REJECTED') {
              rejected.push({
                id: c.id,
                code: 'already_rejected_older',
                message: existing.rejectionReason ?? 'Rejeitada anteriormente.',
              });
            } else {
              accepted.push(c.id);
            }
            continue;
          }

          // New row — insert.
          if (dataError) {
            await tx.lessonCollection.create({
              data: {
                id: c.id,
                lessonInstanceId: instanceId,
                collectorUserId: userId,
                status: 'REJECTED',
                rejectionReason: `${dataError.code}:${dataError.message}`,
                clientCreatedAt: new Date(c.client_created_at),
                clientUpdatedAt: newUpdatedAt,
                expectedStart: isObject(c.times) && typeof c.times.expected_start === 'string' ? c.times.expected_start : '00:00',
                expectedEnd: isObject(c.times) && typeof c.times.expected_end === 'string' ? c.times.expected_end : '00:00',
                realStart: isObject(c.times) && typeof c.times.real_start === 'string' ? c.times.real_start : null,
                realEnd: isObject(c.times) && typeof c.times.real_end === 'string' ? c.times.real_end : null,
                attendanceStart: isObject(c.attendance) && Number.isInteger(c.attendance.start) && c.attendance.start >= 0 ? c.attendance.start : 0,
                attendanceMid: isObject(c.attendance) && Number.isInteger(c.attendance.mid) && c.attendance.mid >= 0 ? c.attendance.mid : 0,
                attendanceEnd: isObject(c.attendance) && Number.isInteger(c.attendance.end) && c.attendance.end >= 0 ? c.attendance.end : 0,
                includesProfessor: isObject(c.attendance) && typeof c.attendance.includes_professor === 'boolean' ? c.attendance.includes_professor : false,
                uniqueParticipants: Number.isInteger(c.unique_participants) && c.unique_participants >= 0 ? c.unique_participants : 0,
                weather: c.weather ?? null,
                notes: c.notes ?? null,
              },
            });
            rejected.push({ id: c.id, ...dataError });
          } else {
            await tx.lessonCollection.create({
              data: {
                id: c.id,
                lessonInstanceId: instanceId,
                collectorUserId: userId,
                status: 'SYNCED',
                rejectionReason: null,
                clientCreatedAt: new Date(c.client_created_at),
                clientUpdatedAt: newUpdatedAt,
                expectedStart: c.times.expected_start,
                expectedEnd: c.times.expected_end,
                realStart: c.times.real_start,
                realEnd: c.times.real_end,
                attendanceStart: c.attendance.start,
                attendanceMid: c.attendance.mid,
                attendanceEnd: c.attendance.end,
                includesProfessor: c.attendance.includes_professor,
                uniqueParticipants: c.unique_participants,
                weather: c.weather,
                notes: c.notes,
              },
            });
            accepted.push(c.id);
          }
        }

        // Recompute every touched instance (FR-022) inside the same tx.
        for (const instanceId of touchedInstances) {
          await aggregateService.recompute(tx, instanceId);
        }
      },
      { isolationLevel: 'Serializable' },
    );

    return {
      accepted,
      rejected,
      server_now: new Date().toISOString(),
    };
  },
};
