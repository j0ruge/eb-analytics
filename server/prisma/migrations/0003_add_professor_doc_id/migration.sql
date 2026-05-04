-- Add docId (CPF) to Professor. Nullable so legacy rows synced before
-- the field existed remain valid; new mobile creates always send it.
-- UNIQUE in Postgres allows multiple NULLs, so legacy rows don't collide.

ALTER TABLE "Professor" ADD COLUMN "docId" TEXT;

CREATE UNIQUE INDEX "Professor_docId_key" ON "Professor"("docId");
