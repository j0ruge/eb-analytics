# Feature Specification: Export Data Contract v2

**Feature Branch**: `005-export-contract-v2`
**Created**: 2026-04-11
**Status**: Draft
**Input**: Roadmap item #1 — "Ajustar o formato JSON que o eb-insights exporta para poder alinhar com o backend"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Anonymous Local Export (Priority: P1)

As a Class Secretary not logged in to any backend, I want to export my completed lessons as a JSON file via the device share sheet (WhatsApp, Drive, email), exactly like I do today, so that my data stays portable even without an account.

**Why this priority**: Baseline functionality. The app today works 100% offline; adding cloud sync must not regress the anonymous workflow.

**Independent Test**: Open the app fresh (no login), create and complete at least one lesson, tap "Exportar JSON", and verify the OS share sheet opens with a valid v2-schema JSON file whose `collector` field is `null`.

**Acceptance Scenarios**:

1. **Given** I have completed lessons and I am not logged in, **When** I navigate to `/sync` and tap "Exportar JSON", **Then** the app generates a v2-schema payload with `"collector": null` and opens the share sheet.
2. **Given** the file is generated, **When** I inspect it, **Then** it contains `schema_version: "2.0"`, a `client` object with `app_version` and `device_id`, an `exported_at` ISO timestamp, and an array `collections[]` with at least one item.
3. **Given** I re-export the same set of completed lessons, **Then** each `collections[].id` is identical to the previous export (stable, not regenerated).

---

### User Story 2 - Authenticated Sync-Ready Export (Priority: P1)

As a logged-in Collector, I want the same export to include my identity so that the backend can attribute each submission to me when I send it.

**Why this priority**: Required for the cloud sync path. Without collector identity in the payload, the backend cannot apply moderation or per-collector aggregation.

**Independent Test**: Log in as a test user, complete a lesson, export, and verify `collector.user_id` matches the logged-in user.

**Acceptance Scenarios**:

1. **Given** I am logged in as user `U1` with display name "Paulo Amaral", **When** I export, **Then** the payload has `collector: { user_id: "<U1>", display_name: "Paulo Amaral" }`.
2. **Given** I log out and re-export, **Then** the payload reverts to `collector: null` for the same lessons.
3. **Given** I try to send the payload to the backend via HTTP without being logged in, **Then** the server returns 401 and the client shows "Faça login para enviar para a nuvem".

---

### User Story 3 - Idempotent Batch Retry (Priority: P1)

As the server receiving a batch, I want repeated uploads of the same batch (due to unstable church internet) to be idempotent so that a collector's readings are never counted twice.

**Why this priority**: Church internet is unreliable. Without idempotency, retries silently corrupt aggregated numbers.

**Independent Test**: POST the same batch three times in a row; verify the server returns success each time but no duplicate rows are created in `lesson_collections`.

**Acceptance Scenarios**:

1. **Given** a batch with 3 collections (UUIDs `A`, `B`, `C`) is successfully POSTed, **When** the same batch is POSTed again, **Then** the server responds 200 with `{ accepted: [A, B, C], rejected: [] }` and the database still has exactly 3 rows.
2. **Given** a batch where `A` was already synced and `B`, `C` are new, **When** the batch is POSTed, **Then** `A` is treated as an update (if `client_updated_at` is newer) or no-op (if older/equal), and `B`, `C` are inserted.
3. **Given** a partial-success response from the server (e.g., `C` was rejected for missing fields), **Then** the client marks `A`, `B` as `SYNCED` locally and keeps `C` in `QUEUED` with the server's error reason.

---

### User Story 4 - Topic and Professor Override at Collection Time (Priority: P2)

As a Collector, I want to override the scheduled professor or topic when a substitution happens (e.g., the planned preacher is replaced at the last minute), so that my reading reflects what actually happened.

**Why this priority**: Substitutions are common in church contexts. The payload must distinguish "catalog item selected" from "free-text entered on the fly".

**Independent Test**: Start a lesson with a pre-populated professor from the catalog; change it to a free-text name; verify the payload has `professor_id: null` and `professor_name_fallback: "<new name>"`.

**Acceptance Scenarios**:

1. **Given** the collector picks "Alex Tolomei" (who exists in the local catalog with `id = X`), **When** the export runs, **Then** the payload has `professor_id: "X"` and `professor_name_fallback: null`.
2. **Given** the collector overrides to "Jefferson Pedro" who is NOT in the catalog, **When** the export runs, **Then** the payload has `professor_id: null` and `professor_name_fallback: "Jefferson Pedro"`.
3. **Given** both `professor_id` and `professor_name_fallback` are present, **Then** the server ignores `professor_name_fallback` (the ID wins) and logs a warning.

---

### User Story 5 - Attendance Semantics Clarification (Priority: P1)

As a Collector, I want to explicitly state whether I counted the professor in my attendance numbers, so that server-side aggregation can normalize readings from different collectors who use different conventions.

**Why this priority**: The manual collection test proved that collectors disagree systematically about whether to include the professor. Making it explicit eliminates the ambiguity.

**Independent Test**: Create two lessons, one with "include professor" checked and one without; verify both export with the correct `includes_professor` boolean.

**Acceptance Scenarios**:

1. **Given** the attendance form has a "Contei o professor nestes números" toggle, **When** I leave it off, **Then** `attendance.includes_professor: false`.
2. **Given** I toggle it on, **Then** the value persists to SQLite and exports as `true`.
3. **Given** no toggle is shown to the user (old lessons from before this spec), **Then** the migration defaults existing rows to `false` and new lessons to a user-configurable default.

---

### Edge Cases

- **EC-001 (Empty Export)**: If user taps export with 0 completed lessons, show "No data to export" alert and do NOT open share sheet. (Carried over from spec 001 EC-001.)
- **EC-002 (Anonymous HTTP Send Attempt)**: If `collector` is `null` and the client attempts `POST /sync/batch`, the server returns 401 and the client shows "Faça login para enviar para a nuvem". The JSON export via share sheet is NOT blocked.
- **EC-003 (Large Batch)**: If `collections[]` serializes to > 1MB, the client splits the export into multiple batches, each with its own `exported_at` timestamp. All batches share the same `client.device_id`.
- **EC-004 (Free-text Topic)**: When `topic_id` is null and `topic_title_fallback` is provided, the server attempts a fuzzy match by `(series_code, normalize(topic_title))`. If no match, a new `LessonTopic` is created with `isPending: true` for coordinator review.
- **EC-005 (Both ID and Fallback)**: If both `professor_id` and `professor_name_fallback` are present, the server uses `professor_id` and logs a warning. This should not happen in practice (UI enforces XOR) but is handled defensively.
- **EC-006 (Schema Mismatch)**: If the server receives a payload with `schema_version` != `"2.0"`, it responds 400 with a clear migration-required error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The exported JSON MUST include a top-level `schema_version` field with the value `"2.0"`.
- **FR-002**: The `collector` field MUST be either `null` (anonymous export, user not logged in) or an object `{ user_id: string, display_name: string }` (logged-in export). Export via share sheet MUST work regardless; HTTP POST to `/sync/batch` MUST require a non-null `collector`.
- **FR-003**: Each `collections[].id` MUST be a client-generated UUID v4, stable across edits and re-exports of the same underlying lesson record.
- **FR-004**: Each collection MUST have `attendance.includes_professor` as a required boolean.
- **FR-005**: Only lessons with status `COMPLETED` are eligible for export. `IN_PROGRESS` lessons MUST be excluded.
- **FR-006**: The server MUST deduplicate incoming collections by `id`. Reposting an existing UUID is a no-op (or a field-level update if `client_updated_at` is newer).
- **FR-007**: Each collection MUST carry `client_created_at` and `client_updated_at` ISO 8601 UTC timestamps, used for ordering and lock-after-send logic.
- **FR-008**: An empty export (no completed lessons) MUST show a "No data to export" alert and MUST NOT open the share sheet.
- **FR-009**: For each of `series`, `topic`, `professor`, the collection MUST carry either an `*_id` (selected from catalog) OR an `*_fallback` string (free text). Never both. The UI MUST enforce this invariant.
- **FR-010**: The payload MUST include `client.device_id` — a UUID persisted in AsyncStorage at first app launch and stable across sessions on the same installation.
- **FR-011**: The export MUST include `exported_at` as an ISO 8601 UTC timestamp, distinct from individual collection timestamps.
- **FR-012**: The v1 export format MUST be fully deprecated in the same release that ships v2. No runtime toggle — v2 is the only format from day one.

### Key Entities *(include if feature involves data)*

- **ExportBatch**: Envelope for a single export operation. Fields: `schema_version`, `client`, `collector`, `exported_at`, `collections[]`.
- **CollectorInfo**: Either `null` or `{ user_id, display_name }`. Populated from the logged-in user at export time.
- **CollectionSubmission**: A single reading of a lesson by a collector. Fields: `id`, `client_created_at`, `client_updated_at`, `status`, `lesson_instance`, `times`, `attendance`, `unique_participants`, `weather`, `notes`.
- **LessonInstanceRef**: Identifies the canonical lesson event this reading belongs to. Fields: `date`, `series_id` + `series_code_fallback`, `topic_id` + `topic_title_fallback`, `professor_id` + `professor_name_fallback`.
- **AttendanceReading**: Fields: `start`, `mid`, `end`, `includes_professor`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **Zero Duplicates on Retry**: 3 consecutive POSTs of the same batch result in exactly 1 row per collection in the server database. Property-tested in CI.
- **SC-002**: **Feature Parity with v1**: Every field present in the v1 export format is representable (with the same or richer semantics) in v2. Verified by a unit test that imports a v1 sample and maps it to v2 without information loss.
- **SC-003**: **Anonymous Export Still Works**: An installation with no login can export a JSON file via share sheet without any error, 100% of the time.
- **SC-004**: **Coordinator Readability**: A coordinator opening a v2 export file in a text editor can identify, within 30 seconds, (a) who the collector was, (b) when it was exported, (c) how many lessons it contains, and (d) any ambiguities flagged (e.g., `includes_professor: true`).
- **SC-005**: **Batch Size Limit Respected**: Batches larger than 1MB are automatically split client-side without user intervention.

## Assumptions

- The client device has a working clock (same assumption as spec 001). ISO timestamps are trustworthy within ±5 minutes.
- The server is the authoritative source for the `series` / `topics` / `professors` catalog. The client uses its local cache for ID lookups, and falls back to text when no local match exists.
- `expo-secure-store` is available for JWT storage (required by spec 006, but `client.device_id` uses AsyncStorage since it's non-sensitive).
- UUID v4 generation is available via `react-native-get-random-values` + `uuid` (already installed).

## Open Questions

None at time of writing. All design decisions were resolved in the roadmap planning session:

- Anonymous export: allowed (collector null, share sheet only).
- Idempotency: client UUID is the key.
- Substitution: XOR between `*_id` and `*_fallback`.
- `includes_professor`: required boolean on every collection.
- Schema version: "2.0" from day one, no runtime v1/v2 switch.

## Related Specs

- **006-auth-identity** — defines how `collector.user_id` is populated from the logged-in user.
- **007-sync-backend** — consumes this payload format at `POST /sync/batch`.
- **008-offline-sync-client** — uses this format for both local export and HTTP send.
