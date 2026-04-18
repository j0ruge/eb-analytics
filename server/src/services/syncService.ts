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
  // Atomic INSERT ... ON CONFLICT (code) DO UPDATE — uses RETURNING so the
  // row id is available even when a peer inserted concurrently. Prisma's
  // upsert is SELECT-then-INSERT and races under concurrent writes.
  // DO UPDATE SET code = EXCLUDED.code is a no-op that still drives the
  // RETURNING clause to fire on conflict.
  const inserted = await tx.$queryRawUnsafe<Array<{ id: string; code: string }>>(
    `INSERT INTO "LessonSeries" ("id", "code", "title", "isPending", "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, TRUE, NOW())
     ON CONFLICT ("code") DO UPDATE SET "code" = EXCLUDED."code"
     RETURNING "id", "code"`,
    fallback,
    `${fallback} (auto)`,
  );
  const row = inserted[0];
  if (!row) throw new Error('upsert returned no row');
  return { id: row.id, code: row.code };
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
  // Prefer a curated row if one already exists with this title.
  const curated = await tx.lessonTopic.findFirst({
    where: { seriesId, title: fallback, isPending: false },
  });
  if (curated) return curated.id;
  // Atomic pending-row upsert, protected by the partial unique index
  // `lesson_topic_pending_unique_series_title` added in 0002 migration.
  const maxOrder = await tx.lessonTopic.aggregate({
    where: { seriesId },
    _max: { sequenceOrder: true },
  });
  const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO "LessonTopic"
       ("id", "seriesId", "title", "sequenceOrder", "isPending", "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, $3, TRUE, NOW())
     ON CONFLICT ("seriesId", "title") WHERE "isPending" = true
     DO UPDATE SET "title" = EXCLUDED."title"
     RETURNING "id"`,
    seriesId,
    fallback,
    (maxOrder._max.sequenceOrder ?? 0) + 1,
  );
  const row = rows[0];
  if (!row) throw new Error('topic upsert returned no row');
  return row.id;
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
  // Prefer curated.
  const curated = await tx.professor.findFirst({
    where: { name: fallback, isPending: false },
  });
  if (curated) return curated.id;
  // Atomic pending upsert via partial unique index
  // `professor_pending_unique_name` (0002 migration).
  const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO "Professor" ("id", "name", "email", "isPending", "updatedAt")
     VALUES (gen_random_uuid(), $1, NULL, TRUE, NOW())
     ON CONFLICT ("name") WHERE "isPending" = true
     DO UPDATE SET "name" = EXCLUDED."name"
     RETURNING "id"`,
    fallback,
  );
  const row = rows[0];
  if (!row) throw new Error('professor upsert returned no row');
  return row.id;
}

// ---------------- LessonInstance upsert ----------------

async function upsertInstance(
  tx: Tx,
  args: { date: Date; seriesCode: string; topicId: string | null; professorId: string | null },
): Promise<string> {
  // Atomic insert-or-return-existing. We have two unique indexes covering
  // the (date, seriesCode, topicId) triple:
  //   - @@unique([date, seriesCode, topicId]) when topicId IS NOT NULL
  //   - lesson_instance_date_series_no_topic_key partial index when NULL
  // Postgres handles the NULL case naturally only through the partial
  // index. We issue two ON CONFLICT clauses in a DO-NOTHING branch and
  // select the surviving row by its triple.
  const dateStr = args.date.toISOString().slice(0, 10);
  if (args.topicId === null) {
    const rows = await tx.$queryRawUnsafe<Array<{ id: string; professorId: string | null }>>(
      `INSERT INTO "LessonInstance"
         ("id", "date", "seriesCode", "topicId", "professorId", "aggCollectorCount")
       VALUES (gen_random_uuid(), $1::date, $2, NULL, $3, 0)
       ON CONFLICT ("date", "seriesCode") WHERE "topicId" IS NULL
       DO UPDATE SET "seriesCode" = EXCLUDED."seriesCode"
       RETURNING "id", "professorId"`,
      dateStr,
      args.seriesCode,
      args.professorId,
    );
    const row = rows[0];
    if (!row) throw new Error('instance upsert (no-topic) returned no row');
    if (!row.professorId && args.professorId) {
      await tx.lessonInstance.update({
        where: { id: row.id },
        data: { professorId: args.professorId },
      });
    }
    return row.id;
  }
  const rows = await tx.$queryRawUnsafe<Array<{ id: string; professorId: string | null }>>(
    `INSERT INTO "LessonInstance"
       ("id", "date", "seriesCode", "topicId", "professorId", "aggCollectorCount")
     VALUES (gen_random_uuid(), $1::date, $2, $3, $4, 0)
     ON CONFLICT ("date", "seriesCode", "topicId")
     DO UPDATE SET "seriesCode" = EXCLUDED."seriesCode"
     RETURNING "id", "professorId"`,
    dateStr,
    args.seriesCode,
    args.topicId,
    args.professorId,
  );
  const row = rows[0];
  if (!row) throw new Error('instance upsert returned no row');
  if (!row.professorId && args.professorId) {
    await tx.lessonInstance.update({
      where: { id: row.id },
      data: { professorId: args.professorId },
    });
  }
  return row.id;
}

// ---------------- Main entry point ----------------

const MAX_SERIALIZATION_RETRIES = 5;

function isSerializationFailure(err: unknown): boolean {
  // Retry-worthy Postgres error codes surfaced by Prisma as `P2034` (SERIALIZATION_FAILURE),
  // and raw driver errors with SQLSTATE 40001 (Serializable conflict) or 40P01 (deadlock).
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { code?: string; meta?: { driverAdapterError?: { cause?: { originalCode?: string } } } };
  if (anyErr.code === 'P2034') return true;
  const original = anyErr.meta?.driverAdapterError?.cause?.originalCode;
  return original === '40001' || original === '40P01';
}

export const syncService = {
  async ingestBatch(userId: string, payload: SyncPayload): Promise<SyncResult> {
    const collections = assertBatchShape(payload);

    let lastErr: unknown;
    for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
      try {
        return await runOnce(userId, collections);
      } catch (err) {
        if (!isSerializationFailure(err)) throw err;
        lastErr = err;
        // Small backoff so the losing tx doesn't immediately re-collide.
        await new Promise((r) => setTimeout(r, 10 + attempt * 20));
      }
    }
    throw lastErr;
  },
};

async function runOnce(
  userId: string,
  collections: CollectionInput[],
): Promise<SyncResult> {
    const accepted: string[] = [];
    const rejected: Array<{ id: string; code: string; message: string }> = [];

    await prisma.$transaction(
      async (tx) => {
        // Pass 1: validate structure, resolve catalog, upsert instance.
        // We don't hold advisory locks yet — catalog upserts are atomic
        // via ON CONFLICT, so there's nothing to protect here.
        type Resolved = {
          c: CollectionInput;
          instanceId: string | null;
          preInstanceError: PerCollectionError | null;
          dataError: PerCollectionError | null;
        };
        const resolved: Resolved[] = [];

        for (const c of collections) {
          let instanceId: string | null = null;
          let preInstanceError: PerCollectionError | null = null;
          let dataError: PerCollectionError | null = null;
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

          if (instanceId !== null) {
            try {
              validateCollectionData(c);
            } catch (err) {
              if (!(err instanceof CollectionError)) throw err;
              dataError = { code: err.code, message: err.message };
            }
          }
          resolved.push({ c, instanceId, preInstanceError, dataError });
        }

        // Response-only rejections for rows that couldn't pin to an instance.
        for (const r of resolved) {
          if (r.instanceId === null) {
            const fallback = r.preInstanceError ?? {
              code: 'invalid_collection_payload',
              message: 'Coleta inválida.',
            };
            rejected.push({ id: r.c.id, ...fallback });
          }
        }

        // Pass 2: acquire per-instance advisory locks in canonical ID order
        // (matches moderationService.cascade). Deadlock-free.
        const lockOrder = Array.from(
          new Set(
            resolved
              .map((r) => r.instanceId)
              .filter((id): id is string => id !== null),
          ),
        ).sort();
        for (const id of lockOrder) {
          await tx.$executeRawUnsafe(
            `SELECT pg_advisory_xact_lock(hashtext($1))`,
            id,
          );
        }

        // Pass 3: insert/update each collection under its lock.
        for (const { c, instanceId, dataError } of resolved) {
          if (instanceId === null) continue;

          const existing = await tx.lessonCollection.findUnique({ where: { id: c.id } });
          const newUpdatedAt = new Date(c.client_updated_at);

          if (existing) {
            const existingUpdatedAt = existing.clientUpdatedAt;
            const isNewer = newUpdatedAt.getTime() > existingUpdatedAt.getTime();

            if (isNewer) {
              // Re-classify based on the new payload (data-model.md allows
              // REJECTED → SYNCED flip when the client corrects malformed
              // data). Server-only fields (acceptedOverride, serverReceivedAt)
              // remain preserved.
              const nextStatus = dataError ? 'REJECTED' : 'SYNCED';
              const nextReason = dataError ? `${dataError.code}:${dataError.message}` : null;
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
                  status: nextStatus,
                  rejectionReason: nextReason,
                },
              });
              if (nextStatus === 'REJECTED' && dataError) {
                rejected.push({ id: c.id, ...dataError });
              } else {
                accepted.push(c.id);
              }
            } else {
              // Older-or-equal clientUpdatedAt: idempotent no-op (FR-021).
              if (existing.status === 'REJECTED') {
                rejected.push({
                  id: c.id,
                  code: 'already_rejected_older',
                  message: existing.rejectionReason ?? 'Rejeitada anteriormente.',
                });
              } else {
                accepted.push(c.id);
              }
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

        // Pass 4: recompute every touched instance (FR-022) in the same
        // canonical order so recompute respects the lock we're already
        // holding. aggregateService.recompute re-acquires the advisory
        // lock re-entrantly — harmless.
        for (const id of lockOrder) {
          await aggregateService.recompute(tx, id);
        }
      },
      // ReadCommitted (default) is sufficient — per-instance serialization
      // is provided by pg_advisory_xact_lock below (research §9 alternative).
      // Serializable adds commit-time retries (P2034) without extra safety
      // once the advisory lock is held.
    );

    return {
      accepted,
      rejected,
      server_now: new Date().toISOString(),
    };
}
