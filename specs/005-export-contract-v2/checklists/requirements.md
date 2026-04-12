# Specification Quality Checklist: Export Data Contract v2

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-04-11
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
  - Note: the spec names `AsyncStorage`, `react-native-get-random-values`, `expo-sharing`, and SQLite migration tooling as **Assumptions** and as part of FR-014/FR-015, but only because 005 explicitly includes a local-data-model migration whose behavior cannot be described without naming the storage layer. The payload contract itself (`schema_version`, envelope shape) remains technology-agnostic.
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
  - Note: the "Payload schema (reference)" JSON block is technical by necessity — it is the contract. All surrounding prose stays readable for a coordinator.
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
  - Note: SC-007 mentions "migration", which is a process, not a specific tool — acceptable.
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
  - The new "Scope Statement" at the top of the spec explicitly lists what 005 does and does not cover, and the "Related Specs" section maps each deferred concern to its owner.
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
  - US1 (anonymous export), US2 (re-exportability), US3 (professor/topic XOR), US4 (includes_professor), US5 (weather + notes).
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification
  - The FR section names some technical building blocks (AsyncStorage keys, hook names, file paths) so that the plan can be validated against them, but nothing prescribes a framework choice that could reasonably be swapped.

## Notes

**Decisions recorded during /speckit.specify** (from conversation Q1/Q2/Q3):

1. **005 ships standalone** without waiting for 006. `collector` is always `null` in 005; 006 will flip it to a real object without changing the schema version.
2. **Toggle UI for `includes_professor` is in scope for 005** — placed on Lesson Detail (below attendance counters) and mirrored by a default preference in Settings.
3. **`weather` and `notes` columns + UI are in scope for 005** with minimal free-text inputs. Automated weather ingestion via a weather API is deferred to a future spec and will not require a schema change.

**Items deliberately descoped from 005** (moved to 007/008 or deleted):

- Server-side idempotency, partial-success response handling, 401 behavior on unauthenticated POST → spec 007.
- Batch splitting for oversized uploads → spec 008.
- `sync_status` column replacing the legacy `EXPORTED` enum → spec 008.
- Login, JWT, `collector` population → spec 006.

Items marked incomplete would require spec updates before `/speckit.plan`. All items currently pass — spec is ready for implementation.
