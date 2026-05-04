export const CREATE_LESSONS_TABLE = `
CREATE TABLE IF NOT EXISTS lessons_data (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL,
    coordinator_name TEXT DEFAULT '',
    professor_name TEXT DEFAULT '',
    professor_id TEXT,
    lesson_topic_id TEXT,
    series_name TEXT DEFAULT '',
    lesson_title TEXT DEFAULT '',
    time_expected_start TEXT DEFAULT '10:00',
    time_real_start TEXT,
    time_expected_end TEXT DEFAULT '11:00',
    time_real_end TEXT,
    attendance_start INTEGER DEFAULT 0,
    attendance_mid INTEGER DEFAULT 0,
    attendance_end INTEGER DEFAULT 0,
    unique_participants INTEGER DEFAULT 0,
    status TEXT CHECK(status IN ('IN_PROGRESS', 'COMPLETED', 'EXPORTED', 'SYNCED')) DEFAULT 'IN_PROGRESS',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    client_updated_at TEXT,
    includes_professor INTEGER NOT NULL DEFAULT 0,
    weather TEXT,
    notes TEXT
);
`;

export const CREATE_INDEX_STATUS = `CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons_data(status);`;
export const CREATE_INDEX_DATE = `CREATE INDEX IF NOT EXISTS idx_lessons_date ON lessons_data(date);`;
export const CREATE_INDEX_PROFESSOR_ID = `CREATE INDEX IF NOT EXISTS idx_lessons_professor_id ON lessons_data(professor_id);`;

// doc_id (CPF) is UNIQUE but nullable so the catalog sync can persist
// professors created via the backend before docId existed (legacy NULL rows
// remain valid; UNIQUE in SQLite allows multiple NULLs). Locally created
// professors must still supply a CPF — that's enforced at the service layer.
export const CREATE_PROFESSORS_TABLE = `
CREATE TABLE IF NOT EXISTS professors (
    id TEXT PRIMARY KEY NOT NULL,
    doc_id TEXT UNIQUE,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

export const CREATE_INDEX_PROFESSORS_DOC_ID = `CREATE INDEX IF NOT EXISTS idx_professors_doc_id ON professors(doc_id);`;
export const CREATE_INDEX_PROFESSORS_NAME = `CREATE INDEX IF NOT EXISTS idx_professors_name ON professors(name);`;

// ============================================================================
// LESSON SERIES TABLE (003-migrate-schema-structure)
// ============================================================================
export const CREATE_LESSON_SERIES_TABLE = `
CREATE TABLE IF NOT EXISTS lesson_series (
    id TEXT PRIMARY KEY NOT NULL,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

export const CREATE_INDEX_SERIES_CODE = `CREATE INDEX IF NOT EXISTS idx_lesson_series_code ON lesson_series(code);`;

// ============================================================================
// LESSON TOPICS TABLE (003-migrate-schema-structure)
// ============================================================================
export const CREATE_LESSON_TOPICS_TABLE = `
CREATE TABLE IF NOT EXISTS lesson_topics (
    id TEXT PRIMARY KEY NOT NULL,
    series_id TEXT NOT NULL,
    title TEXT NOT NULL,
    suggested_date TEXT,
    sequence_order INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (series_id) REFERENCES lesson_series(id)
);
`;

export const CREATE_INDEX_TOPICS_SERIES_ID = `CREATE INDEX IF NOT EXISTS idx_lesson_topics_series_id ON lesson_topics(series_id);`;
export const CREATE_INDEX_TOPICS_SEQUENCE = `CREATE INDEX IF NOT EXISTS idx_lesson_topics_sequence ON lesson_topics(series_id, sequence_order);`;

// Index for lesson_topic_id in lessons_data
export const CREATE_INDEX_LESSON_TOPIC_ID = `CREATE INDEX IF NOT EXISTS idx_lessons_topic_id ON lessons_data(lesson_topic_id);`;

// ============================================================================
// 008-offline-sync-client
// Columns added to `lessons_data` via ALTER TABLE in migrations.ts
// (migrateAddSyncStatus). CHECK constraint enforced at runtime by
// syncService writes; SQLite cannot add CHECK via ALTER TABLE.
//
// Columns:
//   sync_status TEXT NOT NULL DEFAULT 'LOCAL' — LOCAL|QUEUED|SENDING|SYNCED|REJECTED
//   sync_error TEXT NULL
//   sync_attempt_count INTEGER NOT NULL DEFAULT 0
//   sync_next_attempt_at TEXT NULL   — ISO 8601
//   synced_at TEXT NULL              — ISO 8601, set once on SENDING→SYNCED
//
// Supporting catalog sync adds:
//   professors.email TEXT NULL
//   professors.updated_at TEXT NULL
//   lesson_series.updated_at TEXT NULL
//   lesson_topics.updated_at TEXT NULL
// ============================================================================

export const CREATE_INDEX_SYNC_STATUS = `CREATE INDEX IF NOT EXISTS idx_lessons_sync_status ON lessons_data(sync_status);`;

// Partial index — only QUEUED rows are ever scheduled, so this stays small.
export const CREATE_INDEX_SYNC_NEXT_ATTEMPT = `CREATE INDEX IF NOT EXISTS idx_lessons_sync_next_attempt ON lessons_data(sync_next_attempt_at) WHERE sync_status = 'QUEUED';`;
