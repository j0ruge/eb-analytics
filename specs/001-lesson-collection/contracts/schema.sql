-- SQLite Schema for Lesson Data Collection

CREATE TABLE IF NOT EXISTS lessons_data (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL,
    coordinator_name TEXT DEFAULT '',
    professor_name TEXT DEFAULT '',
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

CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons_data(status);
CREATE INDEX IF NOT EXISTS idx_lessons_date ON lessons_data(date);
