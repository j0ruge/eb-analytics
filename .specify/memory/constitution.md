<!--
Sync Impact Report:
- Version change: (New) -> 1.0.0
- List of modified principles: Established Principles I through V (Initial Ratification)
- Added sections: Technology Stack, Governance
- Removed sections: None (Template placeholders filled)
- Templates requiring updates:
  - .specify/templates/plan-template.md (✅ Aligned via generic placeholder)
  - .specify/templates/spec-template.md (✅ Aligned)
  - .specify/templates/tasks-template.md (✅ Aligned)
- Follow-up TODOs: None
-->

# EBD Insights (App Mobile) Constitution

## Core Principles

### I. Local-First Architecture
**NON-NEGOTIABLE:** The application must be fully functional without network connectivity. All user input and data collection MUST be persisted immediately to the local SQLite database (`expo-sqlite/next`). Network synchronization is a secondary, background concern and must never block the user interface or data entry flow.

### II. Minimalism & Native-First
**MANDATE:** Strict limit on external dependencies. Develop using native Expo APIs and standard React Native `StyleSheet` wherever possible. Heavy UI libraries (e.g., NativeBase, Tamagui) are PROHIBITED unless a specific component is impossible to build natively. Complexity must be justified by critical business value.

### III. Fail-Safe UX & State Recovery
**RULE:** The application must withstand crashes or OS-initiated termination without data loss. Complex flows (like the 3-stage class form) MUST automatically save "in-progress" state to persistent storage. Upon relaunch, the application MUST offer to restore the user's previous context/session exactly where they left off.

### IV. Decoupled Export Strategy
**DESIGN PATTERN:** The data collection domain is architecturally separated from the reporting/BI domain. Local data remains on the device until explicitly exported or synced. The export mechanism (JSON generation or API Sync) MUST be decoupled from the core data entry loops, ensuring performance and stability during class time.

### V. Zero-Friction UX
**UX STANDARD:** "Zero Typing" is the goal. Input interfaces MUST prioritize single-tap interactions (Steppers, Native Selects, Toggles) over text fields. Automated data capture (e.g., using the system clock for timestamps) is mandatory to reduce cognitive load and manual entry effort.

## Technology Stack & Constraints

**Core Stack:**
- **Language:** TypeScript (Strict Mode required)
- **Framework:** React Native with Expo (Optimized for Expo Go)
- **Router:** Expo Router (File-based routing)
- **Database:** SQLite (`expo-sqlite/next`)
- **Styling:** Native `StyleSheet` (No CSS-in-JS runtimes or heavy UI kits)

**Compliance:**
- All code must pass `tsc` with strict settings.
- UI must be responsive across standard mobile screen sizes.
- Application must be "Eject-free" compatible with Expo Go workflow where feasible.

## Governance

This Constitution acts as the supreme source of truth for architectural and design decisions within the **EBD Insights** project.

1.  **Supremacy:** In conflicts between this document and other documentation (PRs, tickets, casual discussions), this Constitution prevails.
2.  **Amendments:** Changes to these principles require a formal "Constitutional Amendment" process, involving a version bump and rationale documentation.
3.  **Enforcement:** Code Reviews must explicitly verify alignment with these principles (e.g., rejecting a PR that adds a heavy UI library without justification).
4.  **Version Policy:**
    - **MAJOR:** Change in core philosophy (e.g., moving away from Local-First).
    - **MINOR:** New principle added or significant clarification.
    - **PATCH:** Wording tweaks, typos, non-substantive updates.

**Version**: 1.0.0 | **Ratified**: 2026-01-24 | **Last Amended**: 2026-01-24