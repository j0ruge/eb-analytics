-- Concurrency fixes (code review H1/H2). The Phase 3 code auto-creates
-- pending catalog rows via findFirst+create, which races under concurrent
-- sync batches. Two partial unique indexes let us switch to atomic
-- INSERT ... ON CONFLICT DO UPDATE in syncService without constraining
-- coordinator-managed rows.
--
-- Preflight: a DB that already raced before this migration can contain
-- duplicate pending rows. Collapse them onto the oldest surviving row so
-- the unique index creation below succeeds. FK references to the
-- deduplicated rows are repointed to the survivor via LessonInstance.
-- We only touch isPending=true rows — coordinator-curated rows are left
-- alone.

-- Collapse duplicate pending LessonTopic rows: keep the oldest by createdAt,
-- point LessonInstance.topicId at the survivor, delete the duplicates.
WITH ranked AS (
  SELECT
    id,
    "seriesId",
    "title",
    ROW_NUMBER() OVER (
      PARTITION BY "seriesId", "title"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn,
    FIRST_VALUE(id) OVER (
      PARTITION BY "seriesId", "title"
      ORDER BY "createdAt" ASC, id ASC
    ) AS keeper_id
  FROM "LessonTopic"
  WHERE "isPending" = true
),
remap AS (
  SELECT id AS old_id, keeper_id AS new_id
  FROM ranked
  WHERE rn > 1
)
UPDATE "LessonInstance" li
   SET "topicId" = remap.new_id
  FROM remap
 WHERE li."topicId" = remap.old_id;

DELETE FROM "LessonTopic"
 WHERE id IN (
   SELECT id FROM (
     SELECT
       id,
       ROW_NUMBER() OVER (
         PARTITION BY "seriesId", "title"
         ORDER BY "createdAt" ASC, id ASC
       ) AS rn
     FROM "LessonTopic"
     WHERE "isPending" = true
   ) t
   WHERE t.rn > 1
 );

-- Same dedupe for pending Professors. Repoint LessonInstance.professorId.
WITH ranked AS (
  SELECT
    id,
    "name",
    ROW_NUMBER() OVER (
      PARTITION BY "name"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn,
    FIRST_VALUE(id) OVER (
      PARTITION BY "name"
      ORDER BY "createdAt" ASC, id ASC
    ) AS keeper_id
  FROM "Professor"
  WHERE "isPending" = true
),
remap AS (
  SELECT id AS old_id, keeper_id AS new_id
  FROM ranked
  WHERE rn > 1
)
UPDATE "LessonInstance" li
   SET "professorId" = remap.new_id
  FROM remap
 WHERE li."professorId" = remap.old_id;

DELETE FROM "Professor"
 WHERE id IN (
   SELECT id FROM (
     SELECT
       id,
       ROW_NUMBER() OVER (
         PARTITION BY "name"
         ORDER BY "createdAt" ASC, id ASC
       ) AS rn
     FROM "Professor"
     WHERE "isPending" = true
   ) t
   WHERE t.rn > 1
 );

-- - LessonTopic: a pending topic is identified by (seriesId, title). Two
--   concurrent auto-creates of the same fallback in the same series must
--   collide. Coordinator-managed (isPending=false) rows are excluded so
--   coordinators can rename without tripping the constraint.
CREATE UNIQUE INDEX lesson_topic_pending_unique_series_title
  ON "LessonTopic"("seriesId", "title")
  WHERE "isPending" = true;

-- - Professor: a pending professor is identified by name. Once a
--   coordinator curates the row (isPending=false) they own it and may
--   rename it freely without constraint conflicts.
CREATE UNIQUE INDEX professor_pending_unique_name
  ON "Professor"("name")
  WHERE "isPending" = true;
