# Feature Specification: Lesson Data Collection Flow

**Feature Branch**: `001-lesson-collection`
**Created**: 2026-01-24
**Status**: Draft
**Input**: User description (EBD Insights Domain)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start New Lesson (Priority: P1)

As a Class Secretary, I want to quickly start a new lesson for the day so that I can begin tracking attendance and times immediately.

**Why this priority**: Essential entry point for the application's core value.

**Independent Test**: Can be tested by launching the app, tapping "Nova Aula", and verifying a new record is created in the database with status 'IN_PROGRESS'.

**Acceptance Scenarios**:

1. **Given** I am on the Home Screen (`/`), **When** I tap "Nova Aula", **Then** the app creates a new record in `lessons_data` with status `IN_PROGRESS` and redirects me to the Lesson Form (`/lesson/[id]`).
2. **Given** a new lesson is created, **When** the form loads, **Then** the `time_expected_start` defaults to '09:00' and `time_expected_end` defaults to '10:15'.

---

### User Story 2 - Collect Lesson Data (Priority: P1)

As a Class Secretary, I want to record attendance and real-time events with minimal interaction so that I can focus on the class.

**Why this priority**: Core functionality of the app ("Zero Typing" principle).

**Independent Test**: Open an existing lesson, modify counters and times, restart the app, and verify data persists.

**Acceptance Scenarios**:

1. **Given** I am on the Lesson Form, **When** I tap `[+]` on "Attendance Start", **Then** the counter increments by 1 and the value is saved to the database (debounced).
2. **Given** any counter is at 0, **When** I tap `[-]`, **Then** the value remains 0 (cannot be negative).
3. **Given** the class is starting, **When** I tap the "Capture Start Time" button, **Then** the current system time is formatted as 'HH:MM' and saved to `time_real_start`.
4. **Given** I make changes to the form, **When** I force close and reopen the app, **Then** the values are restored exactly as they were (Auto-Save).

---

### User Story 3 - Export & Sync Data (Priority: P2)

As a Coordinator, I want to export completed lesson data so that I can aggregate it in the central BI tool.

**Why this priority**: Allows data to move out of the local device, completing the workflow.

**Independent Test**: Mark lessons as completed, trigger export, and verify the generated JSON payload.

**Acceptance Scenarios**:

1. **Given** I have lessons with status `COMPLETED`, **When** I navigate to `/sync` and tap "Export Data", **Then** the app generates a JSON payload containing only the completed lessons.
2. **Given** the JSON is generated, **When** the export finishes, **Then** the OS Share sheet opens (allowing share to WhatsApp/Drive).
3. **Given** lessons are successfully exported, **Then** their status remains `COMPLETED` (until explicitly synced/purged - *Clarification: User said "prepares for POST", implies status might change to SYNCED later, but for now just export*).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST persist all data locally in a SQLite database table named `lessons_data`.
- **FR-002**: The `lesson_title`, `coordinator_name`, `professor_name`, and `series_name` fields MUST be editable via text input (or select if available), but default to empty/previous if not specified.
- **FR-003**: The `attendance_start`, `attendance_mid`, `attendance_end`, and `unique_participants` fields MUST be controlled via Stepper components (Increment/Decrement).
- **FR-004**: Counter values MUST NOT be negative.
- **FR-005**: Database updates MUST occur automatically after a 500ms debounce on any field change.
- **FR-006**: The "Real Start" and "Real End" times MUST support one-tap capture from the system clock (`Date.now()` formatted to `HH:MM`).
- **FR-007**: The Export function MUST select only records where `status = 'COMPLETED'`.
- **FR-008**: Once a lesson status is `COMPLETED` or `SYNCED`, all form inputs (text fields, steppers, and time capture buttons) MUST be disabled to prevent further edits.

### Edge Cases & Constraints

- **EC-001 (Empty Export)**: If a user attempts to export with 0 'COMPLETED' lessons, the system MUST show a "No data to export" alert and NOT open the share sheet.
- **EC-002 (Storage Full)**: If SQLite writes fail due to device storage limits, the app MUST display a "Storage Full" error toast; data in memory is preserved until the app is closed.
- **EC-003 (Offline Export)**: Export generation happens locally. If the device is offline, the OS Share Sheet will still open, but cloud targets (Drive/WhatsApp) may queue the upload or fail depending on OS behavior. This is acceptable.
- **EC-004 (Battery)**: The auto-save mechanism (500ms debounce) is optimized to minimize CPU wake cycles. GPS is NOT used.

### Key Entities

- **Lesson (`lessons_data`)**:
    - `id` (UUID): Primary Key.
    - `date` (ISO8601): Date of the lesson.
    - `status`: 'IN_PROGRESS' | 'COMPLETED' | 'SYNCED'.
    - `time_expected_start/end`: Default '09:00'/'10:15'.
    - `time_real_start/end`: Actual captured times.
    - `attendance_*`: Integer counters.
    - `unique_participants`: Integer counter.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **Zero Data Loss**: 100% of input data persists after an immediate app force-close.
- **SC-002**: **Speed**: Creating a new lesson takes < 2 seconds (time to interactive form).
- **SC-003**: **Accuracy**: Exported JSON matches the internal SQLite state exactly for all completed lessons.
- **SC-004**: **Usability**: Time capture requires exactly 1 tap per field (Start/End).

## Assumptions

- The app is running in a context where `expo-sqlite` is available.
- The device clock is reasonably accurate for time capture.
- "Coordinator" and "Professor" names are manually entered or selected (mechanism not detailed, assumed simple text/select).