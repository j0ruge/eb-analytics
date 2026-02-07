-- Schema Migration: 003-migrate-schema-structure
-- Date: 2026-01-31
-- Description: Normalização do schema com lesson_series e lesson_topics

--------------------------------------------------------------------------------
-- PHASE 1: CREATE NEW TABLES
--------------------------------------------------------------------------------

-- Tabela de Séries de Lições
CREATE TABLE IF NOT EXISTS lesson_series (
    id TEXT PRIMARY KEY NOT NULL,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Índice para busca por código
CREATE INDEX IF NOT EXISTS idx_lesson_series_code ON lesson_series(code);

-- Tabela de Tópicos de Lições
CREATE TABLE IF NOT EXISTS lesson_topics (
    id TEXT PRIMARY KEY NOT NULL,
    series_id TEXT NOT NULL,
    title TEXT NOT NULL,
    suggested_date TEXT,
    sequence_order INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (series_id) REFERENCES lesson_series(id)
);

-- Índices para tópicos
CREATE INDEX IF NOT EXISTS idx_lesson_topics_series_id ON lesson_topics(series_id);
CREATE INDEX IF NOT EXISTS idx_lesson_topics_sequence ON lesson_topics(series_id, sequence_order);

--------------------------------------------------------------------------------
-- PHASE 2: ADD FOREIGN KEY TO lessons_data
--------------------------------------------------------------------------------

-- Adicionar coluna lesson_topic_id (nullable inicialmente para migração)
ALTER TABLE lessons_data ADD COLUMN lesson_topic_id TEXT;

-- Índice para foreign key
CREATE INDEX IF NOT EXISTS idx_lessons_topic_id ON lessons_data(lesson_topic_id);

--------------------------------------------------------------------------------
-- PHASE 3: DATA MIGRATION (executado via código TypeScript)
--------------------------------------------------------------------------------

-- A migração de dados é executada via lessonService para:
-- 1. Criar séries a partir de series_name únicos normalizados
-- 2. Criar tópicos a partir de lesson_title únicos por série
-- 3. Atualizar lesson_topic_id em lessons_data

-- Exemplo de queries que serão executadas pelo código:

-- Obter séries únicas para criação:
-- SELECT DISTINCT UPPER(TRIM(series_name)) as normalized_series, series_name
-- FROM lessons_data
-- WHERE series_name IS NOT NULL AND series_name != ''
-- ORDER BY normalized_series;

-- Obter tópicos únicos por série:
-- SELECT DISTINCT
--   UPPER(TRIM(lesson_title)) as normalized_title,
--   lesson_title,
--   UPPER(TRIM(series_name)) as normalized_series
-- FROM lessons_data
-- WHERE lesson_title IS NOT NULL AND lesson_title != ''
-- ORDER BY normalized_series, normalized_title;

-- Atualizar lessons_data com lesson_topic_id:
-- UPDATE lessons_data
-- SET lesson_topic_id = (
--   SELECT lt.id FROM lesson_topics lt
--   JOIN lesson_series ls ON lt.series_id = ls.id
--   WHERE UPPER(TRIM(ls.title)) = UPPER(TRIM(lessons_data.series_name))
--     AND UPPER(TRIM(lt.title)) = UPPER(TRIM(lessons_data.lesson_title))
-- );

--------------------------------------------------------------------------------
-- PHASE 4: DEFAULT ENTRIES (para valores vazios)
--------------------------------------------------------------------------------

-- Série padrão para registros sem série
INSERT OR IGNORE INTO lesson_series (id, code, title, description)
VALUES ('00000000-0000-0000-0000-000000000001', 'SEM-SERIE', 'Sem Série', 'Série padrão para registros migrados sem informação');

-- Tópico padrão para registros sem tópico
INSERT OR IGNORE INTO lesson_topics (id, series_id, title, sequence_order)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Sem Tópico', 1);

--------------------------------------------------------------------------------
-- ROLLBACK SCRIPT (se necessário)
--------------------------------------------------------------------------------

-- Para reverter a migração:
--
-- DROP INDEX IF EXISTS idx_lessons_topic_id;
--
-- -- SQLite não suporta DROP COLUMN diretamente, necessário recriar tabela
-- -- Alternativa: manter coluna mas ignorá-la no código
--
-- DROP TABLE IF EXISTS lesson_topics;
-- DROP TABLE IF EXISTS lesson_series;

--------------------------------------------------------------------------------
-- SCHEMA VERSION
--------------------------------------------------------------------------------

-- Versão do schema: 3.0.0
-- Predecessor: 2.0.0 (feature 002-professors-catalog)
