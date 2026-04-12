# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`  
**Created**: [DATE]  
**Status**: Draft  
**Input**: User description: "$ARGUMENTS"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently - e.g., "Can be fully tested by [specific action] and delivers [specific value]"]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- What happens when [boundary condition]?
- How does system handle [error scenario]?

### Write-Path Impact Checklist *(mandatory when feature adds or modifies entity fields)*

<!--
  Lessons learned from spec 005: three bugs that reached implementation could have
  been caught at spec time by answering these questions upfront. Each question maps
  to a real failure mode discovered during the 005 implementation cycle.

  Fill this section out ONLY when the feature adds new columns, changes field
  semantics, or introduces new invariants on an existing entity. Delete it entirely
  if the feature is purely UI or does not touch the data model.
-->

For each new or modified field, answer:

1. **Smart-defaults exception?** — Does this field behave DIFFERENTLY from existing
   fields in the `createLesson` (or equivalent) smart-defaults chain? If the project
   inherits field values from the last record (e.g., professor, series, times), and
   this new field should NOT be inherited (e.g., it is a personal preference, not a
   per-record carry-forward), document the exception explicitly in the FR. Without
   this, the implementer will extend the existing pattern by inertia.
   *(Origin: spec 005 — `includes_professor` was inherited from the last lesson
   instead of reading the user's Settings preference, causing a bug found via E2E.)*

2. **All write-paths covered?** — List every function/method that INSERTs or UPDATEs
   the entity: `createX`, `updateX`, `seedService`, migration backfill. Verify that
   every invariant (XOR, NOT NULL, default value, normalization) is enforced in ALL
   of them, not just CREATE. If the spec says "field A and field B are mutually
   exclusive", both the INSERT and UPDATE paths must enforce the exclusion.
   *(Origin: spec 005 — FR-017 XOR was initially specified only for `createLesson`;
   `updateLesson` was missed, caught by `/speckit.analyze`.)*

3. **Write-path efficiency?** — If the project uses auto-save (debounced writes), does
   the UPDATE send only changed fields or the entire entity? Adding N new columns
   means the auto-save UPDATE grows by N SET clauses per save. Under rapid saves +
   concurrent reads, this can overwhelm the database driver (especially expo-sqlite
   on Android). If the entity gains 3+ new fields, consider whether the UPDATE path
   should filter out immutable fields (id, created_at, status) to keep the SET clause
   lean.
   *(Origin: spec 005 — 4 new columns + `client_updated_at` injection caused
   expo-sqlite Android to crash under 14 rapid concurrent saves.)*

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST [specific capability, e.g., "allow users to create accounts"]
- **FR-002**: System MUST [specific capability, e.g., "validate email addresses"]  
- **FR-003**: Users MUST be able to [key interaction, e.g., "reset their password"]
- **FR-004**: System MUST [data requirement, e.g., "persist user preferences"]
- **FR-005**: System MUST [behavior, e.g., "log all security events"]

*Example of marking unclear requirements:*

- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION: auth method not specified - email/password, SSO, OAuth?]
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Key Entities *(include if feature involves data)*

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: [Measurable metric, e.g., "Users can complete account creation in under 2 minutes"]
- **SC-002**: [Measurable metric, e.g., "System handles 1000 concurrent users without degradation"]
- **SC-003**: [User satisfaction metric, e.g., "90% of users successfully complete primary task on first attempt"]
- **SC-004**: [Business metric, e.g., "Reduce support tickets related to [X] by 50%"]
