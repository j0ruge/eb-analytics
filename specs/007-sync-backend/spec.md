# Feature Specification: Cloud Sync Backend

**Feature Branch**: `007-sync-backend`
**Created**: 2026-04-11
**Status**: Draft
**Input**: Roadmap item #2 — "Criar um backend, para poder sincronizar com a nuvem". Source PRD: [prd.md](prd.md).

## Clarifications

### Session 2026-04-17

- Q: Is a rejected collection persisted on the server, and does each collection carry an explicit status? → A: Yes, two-state status persisted: `SYNCED` (persisted, eligible for aggregation subject to moderation) or `REJECTED` (persisted with a rejection reason for audit, never enters an aggregate). Both statuses are visible through the "my collections" read-back endpoint.
- Q: What is the Professor catalog's natural key? → A: `email` (non-sensitive, operator-assigned). Unique when present; nullable for auto-created pending professors so EC-002 can still create placeholders from free-text names. No governmental document id is persisted on the Professor catalog entity.
- Q: What is the password policy baseline? → A: Minimum 8 characters, no composition rules (aligned with NIST 800-63B). No upper/lower/number/symbol requirement. Registration rejects shorter passwords with a clear, translatable error.
- Q: Does the per-submission `acceptedOverride` field ship with a setter endpoint in MVP? → A: No. The field exists on the Lesson Collection entity and the aggregation algorithm honors it, but no MVP endpoint mutates it. Setting it is explicitly deferred to post-MVP. US-3 scenario 5 remains valid as an aggregation-correctness property (if the field is set by any means, per-submission override wins over user-level `accepted`), not as an end-to-end API acceptance test in MVP.
- Q: What is the language and shape of error responses from the backend? → A: Every error response is a JSON object with two fields: `code` (stable, English `snake_case` identifier such as `invalid_credentials`, `password_too_short`, `schema_version_required`, `professor_referenced`) and `message` (human-readable Brazilian Portuguese). Acceptance tests assert on `code`; the Portuguese `message` is for humans (operators, `curl` debugging) and may be refined without breaking tests. No `Accept-Language` negotiation in MVP.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Receive Idempotent Batch from Client (Priority: P1)

As the backend, I want to accept batches of collection records from authenticated collectors and persist them idempotently, so that collectors on unstable church Wi-Fi can retry freely without corrupting the aggregated numbers.

**Why this priority**: Core reason the backend exists. Without this, there is no point to the rest of the system.

**Independent Test**: Submit a batch of 3 collections with valid credentials. Verify all 3 persist. Submit the same batch again. Verify no duplicates and a success response.

**Acceptance Scenarios**:

1. **Given** a valid session for user `U1` and a batch of 3 collections `[A, B, C]` where none exist on the server, **When** the batch is submitted, **Then** all 3 records are stored, the response reports `{ accepted: [A,B,C], rejected: [] }`, and affected lesson aggregates are recomputed.
2. **Given** the same batch is submitted a second time, **Then** the response still reports `{ accepted: [A,B,C], rejected: [] }` but the stored record count is unchanged.
3. **Given** the batch contains collection `C` with a newer client update timestamp than the stored version, **Then** the stored record is updated (only fields that changed), not duplicated.
4. **Given** the batch contains collection `C` with an older client update timestamp than the stored version, **Then** the stored record is left alone (older writes are ignored).
5. **Given** the session is missing or invalid, **Then** the response is an authentication error and nothing is persisted.

---

### User Story 2 - Serve Catalog to Clients (Priority: P1)

As a collector app, I want to download the latest list of lesson series, topics (with ordering), and professors from the server so that my dropdowns are always populated with the canonical catalog.

**Why this priority**: Without the catalog, the client falls back to free-text entry, which defeats the whole point of having a central data model.

**Independent Test**: Request the catalog with a valid session. Verify the response contains the three arrays. Request it again with an "updated since" filter and verify only recently-updated items are returned.

**Acceptance Scenarios**:

1. **Given** a valid session and no "updated since" filter, **When** the catalog is requested, **Then** the response contains all three catalog arrays plus a server timestamp usable for subsequent incremental pulls.
2. **Given** the client requests again passing the previous server timestamp as "updated since", **Then** the response contains only items whose update timestamp is newer.
3. **Given** the catalog has items marked as pending (auto-created from sync), **Then** those items are excluded from the default catalog feed. A coordinator-only variant of the endpoint exposes them.
4. **Given** topics are returned, **Then** each topic carries its sequence order and the array is sorted by series, then sequence order ascending.

---

### User Story 3 - Compute Aggregates Across Collectors (Priority: P1)

As a coordinator looking at a lesson instance, I want to see the median of all accepted collections for that lesson, so that I know the "official" numbers derived from multi-collector consensus.

**Why this priority**: The entire multi-collector model is pointless if the server doesn't compute the aggregate. This is the feature that makes divergent readings valuable instead of confusing.

**Independent Test**: Create 3 collections for the same `(date, series, topic)` with attendance starts `[10, 12, 15]`. Fetch the instance. Verify the aggregated start equals `12` (median).

**Acceptance Scenarios**:

1. **Given** 3 accepted collections for instance `I` with attendance starts `[10, 12, 15]`, **When** the instance is fetched, **Then** the aggregated start is `12`.
2. **Given** one of the collectors is marked as not accepted at the user level, **Then** that collector's collection is excluded from the aggregate and the aggregate's collector count reflects the exclusion.
3. **Given** one collection is flagged as "includes professor", **Then** its three attendance values are decremented by 1 before entering the aggregate (normalization to "without professor").
4. **Given** a coordinator toggles a collector from accepted to not accepted, **Then** every lesson instance aggregate that included any of that collector's collections is recomputed atomically with the toggle.
5. **Given** an explicit per-submission accepted override is set on a collection (via any mechanism — no public setter endpoint ships in MVP), **Then** it wins over the collector-level accepted flag. This scenario verifies the aggregation property, not an API flow.

---

### User Story 4 - Authenticate Users (Priority: P1)

As the backend, I want to register new users, authenticate them with email + password, and issue session credentials so that the client app can attach collector identity to every sync request.

**Why this priority**: The client spec (006) depends on these capabilities existing.

**Independent Test**: Register with a unique email. Log in with the same credentials. Fetch "me" with the resulting session. Verify identity and role.

**Acceptance Scenarios**:

1. **Given** an empty user table, **When** the first user registers, **Then** registration succeeds AND the user's role is automatically set to coordinator.
2. **Given** one user already exists, **When** a second user registers, **Then** the second user is assigned the default collector role.
3. **Given** bad credentials on login, **Then** the response is an authentication error with a generic "invalid credentials" message (no leak of whether the email or the password was the wrong part).
4. **Given** a valid session, **When** "me" is requested, **Then** the response includes identity, role, and accepted flag.
5. **Given** a registration attempt with a password shorter than 8 characters, **Then** the response is a validation error that states the minimum length is 8 characters, and no user is created.

---

### User Story 5 - Coordinator Moderation Endpoints (Priority: P2)

As a coordinator, I want to list users and toggle each user's accepted flag, so that I can control which collectors contribute to the aggregated numbers.

**Why this priority**: Ships after P1 core sync is working, because moderation is only useful once there are multiple collectors feeding the system.

**Independent Test**: With a coordinator session, list users. Toggle a user to not accepted. Verify the flag updates AND any affected aggregates are recomputed.

**Acceptance Scenarios**:

1. **Given** I am a coordinator and I list users, **Then** I see every user with their accepted flag.
2. **Given** I am a non-coordinator and I attempt to list users, **Then** I am refused with an authorization error.
3. **Given** I toggle user `U2` to not accepted, **Then** every lesson instance that had any contributing collection from `U2` is recomputed inside the same transaction as the toggle.

---

### User Story 6 - Coordinator Manages Catalog (Priority: P2)

As a coordinator, I want to create, update, and delete catalog items (series, topics, professors) so that I can curate the data collectors see.

**Why this priority**: Catalog quality directly affects collection quality. But it can ship after the initial sync is working, because auto-creation from sync provides a baseline catalog from day one.

**Independent Test**: With a coordinator session, create a new series with a unique code and title. Verify creation succeeds. Request the catalog and verify the new series appears.

**Acceptance Scenarios**:

1. **Given** I am a coordinator, **When** I create a series, topic, or professor, **Then** the item is stored with pending flag cleared and a fresh update timestamp.
2. **Given** I update a topic's sequence order, **Then** the topic's order changes and its update timestamp is refreshed.
3. **Given** I am not a coordinator, **When** I attempt any catalog mutation, **Then** I am refused with an authorization error.
4. **Given** I attempt to delete a professor that is still referenced by one or more lesson instances, **Then** the deletion is refused with a clear conflict message. Soft delete is not part of MVP.

---

### User Story 7 - Health and Observability (Priority: P3)

As the operator (self-hosting), I want a healthcheck endpoint and structured request logs so that I can know the server is alive and debug issues.

**Why this priority**: Nice to have for operations. Can ship after the functional endpoints.

**Independent Test**: Call the health endpoint while the database is up; verify a healthy response. Stop the database and call again; verify a degraded response.

**Acceptance Scenarios**:

1. **Given** the database is up, the health endpoint reports healthy with database up.
2. **Given** the database is down, the health endpoint reports degraded with database down.
3. **Given** any request comes in, **Then** the server emits a structured log line containing at minimum a request identifier, method, path, status code, and latency.

---

### Edge Cases

- **EC-001 (Missing Catalog Reference)**: A batch contains a collection with a series id that does not exist on the server. The server falls back to the human-readable series code next. If that is also unknown, the collection is returned in the `rejected` list with a clear reason; other collections in the batch are processed normally.
- **EC-002 (Free-Text Auto-Create)**: A collection references an unknown series/topic/professor by code or name only (no id). The server creates a catalog entry from the supplied text, marks it pending, and uses its id. For an auto-created pending Professor, `email` is left null (uniqueness applies only when present); the coordinator later assigns an email when curating. Pending entries are excluded from the default catalog feed until a coordinator curates them.
- **EC-003 (Partial Batch Failure)**: A batch of 10 collections has 1 with malformed data. The other 9 are accepted. The response is a success response listing 9 accepted ids and 1 rejected id with reason (partial success is not treated as a batch failure).
- **EC-004 (Race on Aggregation)**: Two batches affecting the same lesson instance arrive concurrently. The server serializes aggregate updates per instance so readers always see aggregates consistent with the collections that existed at the time of the last write. Eventual consistency is not acceptable.
- **EC-005 (Coordinator Registers First)**: The first registered user becomes coordinator. If that user later deletes their own account (out of MVP scope), the system does not auto-promote a replacement — an operator must do it via direct database edit.
- **EC-006 (Schema Version Mismatch)**: A batch arrives missing or declaring an unsupported schema version. The server rejects the whole batch with a "schema version required/unsupported" error. The server never processes pre-v2 batches.
- **EC-007 (Over-Large Batch)**: A batch with more than 500 collections or larger than 5 MB total is rejected with a payload-too-large error. The client (spec 008) is responsible for chunking.

## Requirements *(mandatory)*

### Functional Requirements

#### Authentication

- **FR-010**: The system MUST provide user registration with email, password, and display name. A successful registration returns a valid session credential and the user record.
- **FR-011**: The system MUST provide login with email and password. A successful login returns a valid session credential. A failed login returns a generic "invalid credentials" response that does not distinguish between wrong email and wrong password.
- **FR-012**: The system MUST provide a "me" endpoint that returns the current session user's identity, display name, role, and accepted flag.
- **FR-013**: The first user to register in an empty system MUST be assigned the coordinator role automatically. All subsequent users MUST default to the collector role.
- **FR-014**: Passwords MUST be stored only as one-way hashes. Plaintext passwords MUST never be persisted or logged.
- **FR-015**: The system MUST enforce a minimum password length of 8 characters on registration. No additional composition rules (uppercase, lowercase, digits, symbols) are imposed. A registration attempt with a password shorter than 8 characters MUST be refused with a validation error that explicitly states the minimum length.

#### Sync

- **FR-020**: The system MUST expose a batch submission endpoint that accepts authenticated payloads conforming to the v2 export contract defined in spec 005.
- **FR-021**: The idempotency key for a batched collection MUST be the collection's client-generated id. Re-posting the same id MUST NOT create a duplicate; instead, the server MUST apply a field-level merge keyed by the client's last-update timestamp (newer wins; older is ignored).
- **FR-022**: On successful insert or update, the server MUST recompute affected lesson instance aggregates inside the same transaction as the write.
- **FR-023**: When a batched collection references a catalog item by free-text fallback rather than id, the server MUST auto-create a pending catalog item and use its id. Auto-created items MUST be flagged as pending.
- **FR-024**: A batch MUST be accepted partially when individual collections are malformed: accepted and rejected lists are reported separately; the overall response is still a success.
- **FR-025**: Every persisted collection MUST carry an explicit status: `SYNCED` (eligible for aggregation subject to moderation rules) or `REJECTED` (persisted for audit only, never enters aggregates). A rejected collection MUST also carry a human-readable `rejection_reason`. The server MUST persist rejected collections so their reasons can be retrieved later via FR-043.

#### Catalog Reads

- **FR-030**: The system MUST expose an authenticated catalog-read endpoint returning all non-pending series, topics, and professors plus a server-side timestamp the client can use for subsequent incremental pulls. When an "updated since" parameter is supplied, only items with a newer update timestamp MUST be returned. Topics MUST be sorted by series, then by sequence order ascending.
- **FR-031**: A coordinator-only variant of the catalog-read endpoint MUST include pending items.

#### Catalog Mutations

- **FR-032**: Only coordinators MUST be able to create items in any catalog collection (series, topics, professors). Created items are stored with pending flag cleared.
- **FR-033**: Only coordinators MUST be able to partially update any catalog item. The server MUST refresh the item's update timestamp on successful change.
- **FR-034**: Only coordinators MUST be able to delete catalog items. A delete of an item still referenced by any lesson instance MUST be refused with a conflict error. Soft-delete is explicitly out of scope for MVP.

#### Lesson Instances

- **FR-040**: Lesson-instance read endpoints are coordinator-only. Coordinators MUST be able to list lesson instances filtered by a date range, each with its contributing collections and aggregate fields expanded. Plain collectors MUST NOT call these endpoints at all (not just hide aggregates) — any request from a non-coordinator MUST be refused with an authorization error. Collectors can still read their own submissions via FR-043.
- **FR-041**: Coordinators MUST be able to fetch a single lesson instance with full expansion.
- **FR-042**: Coordinators MUST be able to request a forced re-aggregation of a single lesson instance (debug/repair tool).
- **FR-043**: Any authenticated user MUST be able to fetch only their own collections (filter "mine = true"), optionally with an "updated since" filter. The response MUST include both `SYNCED` and `REJECTED` collections with their status and, when applicable, the `rejection_reason`, so the client can surface per-submission moderation and validation outcomes as described in spec 008 P6.

#### Moderation

- **FR-050**: Coordinators MUST be able to list all users along with each user's accepted flag. Non-coordinators MUST be refused.
- **FR-051**: Coordinators MUST be able to toggle a user's accepted flag. The toggle MUST recompute every affected lesson instance's aggregate in the same transaction as the flag change.

#### Security & Policy

- **FR-060**: Every endpoint except registration, login, and health MUST require a valid session credential.
- **FR-061**: Role-based access control MUST gate all catalog mutations, user listing, moderation actions, and lesson-instance reads behind the coordinator role.
- **FR-062**: Cross-origin access MUST be restricted to one or more operator-configured origins (single origin for most deploys; multiple origins supported to cover the self-host + preview/staging case). Every other origin MUST be refused.
- **FR-063**: Mutating endpoints MUST be rate-limited per session to reasonable limits (for example, 60 requests per minute). Read endpoints MAY be unthrottled within reason.
- **FR-064**: Session credentials MUST have a bounded lifetime (for example, 7 days) after which re-authentication is required. Refresh flows are out of scope for MVP.
- **FR-065**: Every error response (any 4xx or 5xx) MUST be a JSON object containing at least two fields: `code` — a stable, English `snake_case` identifier (for example `invalid_credentials`, `password_too_short`, `schema_version_required`, `batch_too_large`, `professor_referenced`) — and `message` — a human-readable Brazilian Portuguese (pt-BR) string. Automated tests and client logic MUST key off `code`; `message` is advisory and may be rephrased without versioning. `Accept-Language` negotiation is not supported in MVP.

### Aggregation Rules

The aggregate on a lesson instance is derived from its contributing collections using the following rules:

1. **Eligibility**: a collection contributes only if its stored status is `SYNCED` AND (its per-submission accepted override is true, OR the override is unset and the contributing collector's user-level accepted flag is true). `REJECTED` collections are never eligible.
2. **Normalization**: if a contributing collection is flagged as "includes professor", its three attendance counts (start, middle, end) are each decremented by 1 before entering the aggregate (the aggregate's unit is "without professor").
3. **Aggregation**: each of `aggStart`, `aggMid`, `aggEnd` is the median of the normalized attendance array from eligible collections. `aggDist` (unique participants) is the median of the unique-participant counts from eligible collections (no normalization). The aggregate's collector count is the number of eligible collections. **Tie-break for even-length arrays**: return the lower middle element (i.e., `sorted[(n-1)/2]` with integer division, not the mean of the two middle values). Example: `[10, 12]` → `10`. This is an intentional choice so the result stays an integer and matches what a collector actually observed, avoiding fractional attendance counts.
4. **Empty**: if no collections are eligible, every aggregate value is cleared (null) and the collector count is zero.
5. **Consistency**: recomputation for a given lesson instance MUST be serialized against concurrent writes to the same instance so readers never observe stale aggregates.

### Key Entities

- **User**: A person registered with the system. Attributes: identity, email (unique), display name, password hash, role (collector or coordinator), accepted flag (whether contributions count toward aggregates), creation timestamp.
- **Lesson Series**: A named curriculum series. Attributes: identity, short code (unique, human-readable), title, optional description, pending flag, update timestamp.
- **Lesson Topic**: A single lesson within a series. Attributes: identity, owning series, title, sequence order within the series, optional suggested date, pending flag, update timestamp.
- **Professor**: A teacher in the catalog. Attributes: identity, display name, email (non-sensitive natural key — unique when present, nullable so that auto-created pending entries from free-text can be stored without an email), pending flag, update timestamp. No governmental document id is stored on this entity.
- **Lesson Instance**: A specific occurrence of a topic on a specific date, distinguished by `(date, series code, topic)`. Attributes: identity, date, series code, optional topic reference, optional professor reference, aggregate values (start/mid/end attendance, unique participants), aggregate collector count.
- **Lesson Collection**: One collector's submission for a lesson instance. Attributes: client-generated identity (idempotency key), owning lesson instance, contributing collector, status (`SYNCED` or `REJECTED`), optional rejection reason (required when status is `REJECTED`, null otherwise), client-side created and updated timestamps, server-side received timestamp, expected and real start/end times, attendance values (start/mid/end), includes-professor flag, unique participants count, optional weather and notes, optional per-submission accepted override.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **Idempotency Correctness** — 1000 consecutive re-submissions of the same batch result in exactly one stored record per collection. Property-tested in CI with randomized batch sizes.
- **SC-002**: **Aggregation Correctness** — For any set of eligible collections, the resulting aggregate values equal the median of the includes-professor-normalized attendance arrays. Property-tested with generated collections.
- **SC-003**: **Latency** — A batch of 50 collections is accepted, persisted, and aggregates recomputed in under 500 ms at the 95th percentile on a modest self-hosted environment (2 vCPU, 2 GB RAM).
- **SC-004**: **First Deploy Time** — From a clean environment with container tooling installed, the operator can bring the backend online in under 5 minutes.
- **SC-005**: **Zero Data Loss on Concurrent Writes** — Ten parallel batches affecting the same lesson instance produce a final state in which every submitted collection is persisted and the aggregate reflects all of them. Verified via load test.
- **SC-006**: **Moderation Recompute Latency** — Toggling a user's accepted flag when that user has contributed to roughly 100 lesson instances recomputes all affected aggregates in under 1 second.

## Assumptions

- A single backend instance serves the entire congregation. Horizontal scaling is not a goal for MVP (load is tiny — tens of collectors, hundreds of submissions per month at most).
- Self-hosting is the default deployment target. Managed-cloud alternatives are acceptable but not prescribed by this spec.
- The client (spec 008) is responsible for splitting large batches. The server rejects overlarge batches and does not attempt streaming.
- Moderation is performed by one coordinator at a time. There is no workflow for two coordinators disagreeing on a user's acceptance.
- Backup and disaster recovery are the operator's responsibility. MVP does not include automated backups.
- Email verification at registration is not required for MVP.
- Password reset is performed manually by the coordinator (direct data edit) for MVP.

## Open Questions

- Should email verification be required at registration? Default for MVP: no. May be reconsidered post-MVP.
- Should an admin endpoint exist to promote/demote roles after the first-user rule? Default for MVP: no. Direct data edit is acceptable. Flagged for post-MVP.
- Refresh tokens / long-lived sessions? Out of scope for MVP.
- Public setter endpoint for per-submission `acceptedOverride` (fine-grained moderation of a single collection rather than a whole collector)? Out of scope for MVP. The field is persisted and honored by aggregation; a coordinator-only endpoint can be added post-MVP without migration.

## Related Specs

- **005-export-contract-v2** — defines the payload this backend accepts at batch submission.
- **006-auth-identity** — client-side counterpart of the authentication capabilities here.
- **008-offline-sync-client** — consumer of this backend; implements the retry/queue logic on the app side.
