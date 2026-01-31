# Data Model: Lesson Data Collection

## Entity: Lesson

**Source of Truth**: `lessons_data` table in SQLite.

### Fields

| Field Name | Type (SQLite) | TS Type | Description | Default |
|:---|:---|:---|:---|:---|
| `id` | TEXT (PK) | `string` | UUID v4 | Generated |
| `date` | TEXT | `string` | ISO 8601 Date (YYYY-MM-DD) | Current Date |
| `coordinator_name` | TEXT | `string` | Name of coordinator | `''` |
| `professor_name` | TEXT | `string` | Name of professor | `''` |
| `series_name` | TEXT | `string` | Name of lesson series | `''` |
| `lesson_title` | TEXT | `string` | Title of the lesson | `''` |
| `time_expected_start`| TEXT | `string` | Expected start time (HH:MM) | `'10:00'` |
| `time_real_start` | TEXT | `string` | Actual start time (HH:MM) | `null` |
| `time_expected_end` | TEXT | `string` | Expected end time (HH:MM) | `'11:00'` |
| `time_real_end` | TEXT | `string` | Actual end time (HH:MM) | `null` |
| `attendance_start` | INTEGER | `number` | Count at start | `0` |
| `attendance_mid` | INTEGER | `number` | Count at middle | `0` |
| `attendance_end` | INTEGER | `number` | Count at end | `0` |
| `unique_participants`| INTEGER | `number` | Total unique people | `0` |
| `status` | TEXT | `LessonStatus` | State of the lesson | `'IN_PROGRESS'` |
| `created_at` | TEXT | `string` | Timestamp | Current Time |

### Enums

**LessonStatus**:

- `'IN_PROGRESS'`: Active, editable.
- `'COMPLETED'`: Finished, ready for export.
- `'SYNCED'`: Exported/Uploaded (Logic for future).

### Validations

- `attendance_*` >= 0.
- `unique_participants` >= 0.
- `status` must be one of the enum values.

### Indexes

- `id` (Primary Key).
- `status` (For fast filtering of exportable items).
- `date` (For sorting history).
