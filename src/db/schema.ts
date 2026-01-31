export const CREATE_LESSONS_TABLE = `
CREATE TABLE IF NOT EXISTS lessons_data (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL,
    coordinator_name TEXT DEFAULT '',
    professor_name TEXT DEFAULT '',
    professor_id TEXT,
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
    status TEXT CHECK(status IN ('IN_PROGRESS', 'COMPLETED', 'SYNCED')) DEFAULT 'IN_PROGRESS',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

export const CREATE_INDEX_STATUS = `CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons_data(status);`;
export const CREATE_INDEX_DATE = `CREATE INDEX IF NOT EXISTS idx_lessons_date ON lessons_data(date);`;
export const CREATE_INDEX_PROFESSOR_ID = `CREATE INDEX IF NOT EXISTS idx_lessons_professor_id ON lessons_data(professor_id);`;

export const CREATE_PROFESSORS_TABLE = `
CREATE TABLE IF NOT EXISTS professors (
    id TEXT PRIMARY KEY NOT NULL,
    doc_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

export const CREATE_INDEX_PROFESSORS_DOC_ID = `CREATE INDEX IF NOT EXISTS idx_professors_doc_id ON professors(doc_id);`;
export const CREATE_INDEX_PROFESSORS_NAME = `CREATE INDEX IF NOT EXISTS idx_professors_name ON professors(name);`;
