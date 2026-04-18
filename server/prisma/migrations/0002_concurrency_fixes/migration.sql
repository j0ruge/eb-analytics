-- Concurrency fixes (code review H1/H2). The Phase 3 code auto-creates
-- pending catalog rows via findFirst+create, which races under concurrent
-- sync batches. Two partial unique indexes let us switch to atomic
-- INSERT ... ON CONFLICT DO UPDATE in syncService without constraining
-- coordinator-managed rows.
--
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
