-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('COLLECTOR', 'COORDINATOR');

-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('SYNCED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'COLLECTOR',
    "accepted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonSeries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isPending" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonTopic" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "suggestedDate" TIMESTAMP(3),
    "isPending" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Professor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "isPending" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Professor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonInstance" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "seriesCode" TEXT NOT NULL,
    "topicId" TEXT,
    "professorId" TEXT,
    "aggStart" DOUBLE PRECISION,
    "aggMid" DOUBLE PRECISION,
    "aggEnd" DOUBLE PRECISION,
    "aggDist" DOUBLE PRECISION,
    "aggCollectorCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LessonInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonCollection" (
    "id" TEXT NOT NULL,
    "lessonInstanceId" TEXT NOT NULL,
    "collectorUserId" TEXT NOT NULL,
    "status" "CollectionStatus" NOT NULL DEFAULT 'SYNCED',
    "rejectionReason" TEXT,
    "clientCreatedAt" TIMESTAMP(3) NOT NULL,
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL,
    "serverReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedStart" TEXT NOT NULL,
    "expectedEnd" TEXT NOT NULL,
    "realStart" TEXT,
    "realEnd" TEXT,
    "attendanceStart" INTEGER NOT NULL,
    "attendanceMid" INTEGER NOT NULL,
    "attendanceEnd" INTEGER NOT NULL,
    "includesProfessor" BOOLEAN NOT NULL,
    "uniqueParticipants" INTEGER NOT NULL,
    "weather" TEXT,
    "notes" TEXT,
    "acceptedOverride" BOOLEAN,

    CONSTRAINT "LessonCollection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "LessonSeries_code_key" ON "LessonSeries"("code");

-- CreateIndex
CREATE INDEX "LessonTopic_seriesId_sequenceOrder_idx" ON "LessonTopic"("seriesId", "sequenceOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Professor_email_key" ON "Professor"("email");

-- CreateIndex
CREATE INDEX "LessonInstance_date_idx" ON "LessonInstance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "LessonInstance_date_seriesCode_topicId_key" ON "LessonInstance"("date", "seriesCode", "topicId");

-- CreateIndex
CREATE INDEX "LessonCollection_lessonInstanceId_idx" ON "LessonCollection"("lessonInstanceId");

-- CreateIndex
CREATE INDEX "LessonCollection_collectorUserId_idx" ON "LessonCollection"("collectorUserId");

-- AddForeignKey
ALTER TABLE "LessonTopic" ADD CONSTRAINT "LessonTopic_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "LessonSeries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonInstance" ADD CONSTRAINT "LessonInstance_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "LessonTopic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonInstance" ADD CONSTRAINT "LessonInstance_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonCollection" ADD CONSTRAINT "LessonCollection_lessonInstanceId_fkey" FOREIGN KEY ("lessonInstanceId") REFERENCES "LessonInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonCollection" ADD CONSTRAINT "LessonCollection_collectorUserId_fkey" FOREIGN KEY ("collectorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Check constraint: rejectionReason required iff status = REJECTED (data-model §LessonCollection)
ALTER TABLE "LessonCollection"
  ADD CONSTRAINT rejection_reason_required
  CHECK (("status" = 'REJECTED' AND "rejectionReason" IS NOT NULL)
      OR ("status" = 'SYNCED'   AND "rejectionReason" IS NULL));

-- Partial unique index: prevent two topicless instances on the same day/series
-- (Postgres treats NULL as distinct in standard unique indexes — see data-model §LessonInstance)
CREATE UNIQUE INDEX lesson_instance_date_series_no_topic_key
  ON "LessonInstance"("date", "seriesCode")
  WHERE "topicId" IS NULL;
