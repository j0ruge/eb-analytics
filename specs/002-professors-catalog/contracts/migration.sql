-- Migration: Add professor_id to lessons_data
-- Date: 2026-01-25
-- Feature: 002-professors-catalog

-- Step 1: Add professor_id column (nullable)
ALTER TABLE lessons_data ADD COLUMN professor_id TEXT;

-- Step 2: Create index for foreign key
CREATE INDEX IF NOT EXISTS idx_lessons_professor_id ON lessons_data(professor_id);

-- Step 3: Data migration (handled in application code)
-- For each distinct professor_name:
--   1. Create professor record with doc_id = "cpf" (placeholder)
--   2. Update lessons_data.professor_id with new professor.id
--   3. Keep professor_name for backwards compatibility (deprecated)

-- Step 4: (Future) Remove professor_name column
-- SQLite doesn't support DROP COLUMN in older versions
-- Requires: Create new table → Copy data → Rename table
-- For now: Keep professor_name as deprecated field

-- Note: Run this migration via application code, not directly
-- See: src/db/migrations.ts
