# Feature Specification: Improve App Design

**Feature Branch**: `004-improve-app-design`
**Created**: 2026-02-11
**Status**: Draft
**Input**: User description: "Improve app design with complete design system, tab navigation, icons, dark mode, animations, and visual standardization"

## Clarifications

### Session 2026-02-11

- Q: Should tab labels and screen titles use Portuguese (PT-BR) or English? → A: Portuguese (PT-BR) — tab labels: "Aulas", "Séries", "Professores", "Sincronizar".
- Q: Should the user have an in-app manual theme override beyond device setting? → A: Yes — provide an in-app toggle with three options: Light / Dark / System (default).
- Q: How should loading failures be handled when skeletons are displayed? → A: Replace skeletons with an inline error message and a "Tentar novamente" (retry) button.
- Q: Should the design system enforce a minimum color contrast ratio? → A: Yes — WCAG AA: minimum 4.5:1 for text, 3:1 for UI components, in both light and dark themes.
- Q: What is the fallback when device color scheme detection is unsupported? → A: Default to light theme.

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

### User Story 1 - Consistent Visual Identity (Priority: P1)

As a user, I want the app to have a cohesive, modern look across all screens so that the experience feels polished and professional.

**Why this priority**: A unified design system is the foundation that all other visual improvements build upon. Without consistent typography, colors, and spacing tokens, every other design change would be ad-hoc and unmaintainable. This delivers the highest visual impact for the least ongoing cost.

**Independent Test**: Can be fully tested by navigating through every screen in the app and verifying that typography, colors, spacing, and component styling are consistent. Delivers a polished, professional appearance even without tabs, dark mode, or animations.

**Acceptance Scenarios**:

1. **Given** any screen in the app, **When** the user views it, **Then** all text uses sizes and weights from the typography scale (no hardcoded font values).
2. **Given** any screen in the app, **When** the user views it, **Then** all colors come from semantic color tokens (no hardcoded hex/rgb values in screen or component files).
3. **Given** any screen in the app, **When** the user views it, **Then** all spacing and padding use spacing tokens (no hardcoded numeric spacing values in screen or component files).
4. **Given** list screens (Aulas, Séries, Professores), **When** the user views them, **Then** card components share a consistent elevation, border radius, and padding style.

---

### User Story 2 - Tab-Based Navigation (Priority: P1)

As a user, I want to access main sections (Aulas, Séries, Professores, Sincronizar) via bottom tabs with icons so I can navigate quickly without relying on header text links.

**Why this priority**: Navigation structure fundamentally shapes usability. Bottom tabs are the standard mobile pattern for primary sections - replacing text links with icon tabs removes friction from every user session and is independently valuable even without design tokens or dark mode.

**Independent Test**: Can be fully tested by tapping each bottom tab and verifying that the correct screen loads, the active tab is visually distinguished, and nested navigation (e.g., lesson detail from Lessons tab) works correctly. Delivers quick section switching even with the current visual styling.

**Acceptance Scenarios**:

1. **Given** the app is open on any screen, **When** the user looks at the bottom of the screen, **Then** a tab bar with 4 labeled icons (Aulas, Séries, Professores, Sincronizar) is visible.
2. **Given** the tab bar is visible, **When** the user taps a tab, **Then** the corresponding section loads and the tapped tab is visually highlighted as active.
3. **Given** the user is on a detail screen within a tab (e.g., lesson detail), **When** the user taps a different tab, **Then** they navigate to that section's root screen.
4. **Given** the user is on a detail screen within a tab, **When** the user taps the same tab again, **Then** they return to that section's root/list screen.

---

### User Story 3 - Dark Mode Support (Priority: P1)

As a user, I want the app to respect my device's light/dark preference so the app is comfortable in all lighting conditions.

**Why this priority**: Dark mode is an accessibility and comfort feature that a significant portion of users expect. It directly improves usability in low-light environments. It is independently testable by toggling device theme settings and has high perceived value.

**Independent Test**: Can be fully tested by toggling the device between light mode, dark mode, and auto/system mode, then navigating all screens to verify correct theme application. Delivers comfortable viewing in all lighting conditions even without tab navigation or animations.

**Acceptance Scenarios**:

1. **Given** the device is set to dark mode and the in-app toggle is set to "System" (default), **When** the user opens the app, **Then** all screens render with the dark color palette (dark backgrounds, light text).
2. **Given** the device is set to light mode and the in-app toggle is set to "System" (default), **When** the user opens the app, **Then** all screens render with the light color palette (light backgrounds, dark text).
3. **Given** the in-app toggle is set to "System" and the device switches between light and dark, **When** the system theme changes, **Then** the app theme updates accordingly without requiring an app restart.
4. **Given** the user sets the in-app toggle to "Dark", **When** the device is in light mode, **Then** the app still renders with the dark color palette (manual override takes precedence).
5. **Given** the user sets the in-app toggle to "Light", **When** the device is in dark mode, **Then** the app still renders with the light color palette (manual override takes precedence).
6. **Given** any screen in dark mode, **When** the user views modals, overlays, or dropdowns, **Then** they render correctly with dark theme colors and remain readable.

---

### User Story 4 - Visual Feedback & Animations (Priority: P2)

As a user, I want smooth transitions and micro-interactions (button presses, screen transitions, loading states) so the app feels responsive and alive.

**Why this priority**: Animations and feedback are polish that make the app feel professional, but the app is fully usable without them. They enhance perceived performance and user delight but do not unlock new functionality.

**Independent Test**: Can be fully tested by interacting with buttons, navigating between screens, and triggering loading states, then observing that visual feedback (opacity changes, scale effects, transitions) occurs. Delivers a more responsive feel even with the current navigation and color scheme.

**Acceptance Scenarios**:

1. **Given** any tappable element (button, card, list item), **When** the user presses it, **Then** the element provides immediate visual feedback (e.g., opacity change, scale reduction).
2. **Given** the user navigates between screens, **When** the transition occurs, **Then** a smooth animation (slide, fade) plays rather than an instant jump.
3. **Given** a screen is loading data, **When** the user waits, **Then** a loading indicator (spinner or skeleton) is displayed until content appears.

---

### User Story 5 - Icon-Based Actions (Priority: P2)

As a user, I want action buttons (FABs, status badges, form elements) to use recognizable icons alongside text so I can identify actions faster.

**Why this priority**: Icons improve scannability and reduce cognitive load, but the app remains functional with text-only controls. This is an enhancement layer on top of the core design system.

**Independent Test**: Can be fully tested by navigating to list screens and verifying FABs display icons, checking that status badges use icon indicators, and confirming form controls include appropriate icons. Delivers faster action identification even without dark mode or animations.

**Acceptance Scenarios**:

1. **Given** a list screen (Aulas, Séries, Professores), **When** the user views the floating action button, **Then** it displays a recognizable "add" icon (with or without accompanying text).
2. **Given** a list item with a status indicator, **When** the user views it, **Then** the status is conveyed through both color and an icon (not color alone).
3. **Given** a form screen, **When** the user views input fields, **Then** relevant fields include leading icons that hint at the expected input type.

---

### User Story 6 - Improved Empty States (Priority: P2)

As a user, I want helpful empty state screens with icons and clear calls to action so I know what to do when there's no data.

**Why this priority**: Empty states are the first thing new users see. Clear guidance reduces confusion and encourages first actions. However, this is only relevant for specific scenarios (new users, cleared data) so it ranks below always-visible improvements.

**Independent Test**: Can be fully tested by viewing each list screen with no data present and verifying that a descriptive message, icon/illustration, and a call-to-action button appear. Delivers better onboarding guidance even with current styling.

**Acceptance Scenarios**:

1. **Given** a list screen with no items (e.g., no lessons created), **When** the user views it, **Then** an icon/illustration, a descriptive message, and a primary action button (e.g., "Create your first lesson") are displayed.
2. **Given** the empty state is displayed, **When** the user taps the call-to-action button, **Then** they are taken to the appropriate creation flow.
3. **Given** the empty state is displayed in dark mode, **When** the user views it, **Then** the icon, text, and button are legible and correctly themed.

---

### User Story 7 - Loading Skeletons (Priority: P3)

As a user, I want skeleton placeholders instead of spinners while content loads so the app feels faster.

**Why this priority**: Skeleton screens are a premium polish feature. They improve perceived performance but the app loads correctly with standard spinners. This is the lowest-priority visual enhancement.

**Independent Test**: Can be fully tested by triggering data loads on list screens (e.g., pull-to-refresh or initial load) and verifying that skeleton placeholders matching the content layout appear before real data renders. Delivers improved perceived speed even with current design.

**Acceptance Scenarios**:

1. **Given** a list screen is loading data, **When** the user views the screen during loading, **Then** skeleton placeholders mimicking the shape of content cards are displayed instead of a generic spinner.
2. **Given** skeletons are displayed, **When** data finishes loading, **Then** skeletons transition smoothly to real content without a jarring flash.
3. **Given** skeletons are displayed in dark mode, **When** the user views them, **Then** the skeleton colors are appropriate for the dark theme (not light-mode gray on dark background).
4. **Given** skeletons are displayed and the data request fails, **When** the error occurs, **Then** skeletons are replaced with an inline error message and a "Tentar novamente" (retry) button.
5. **Given** the error state with retry button is displayed, **When** the user taps "Tentar novamente", **Then** skeletons reappear and the data load is retried.

---

### Edge Cases

- What happens when the device theme is set to "auto" (follow system schedule) and switches while the app is in the foreground?
- How do screens with mixed content types (forms combined with lists) maintain readability in both light and dark themes?
- How do modals and bottom sheets render correctly in dark mode, including their overlay/backdrop colors?
- Status badges MUST remain distinguishable in dark mode by meeting WCAG AA contrast ratios (3:1 minimum against their background) in both themes.
- When the device does not support system color scheme detection, the app defaults to light theme. The user can still manually override via the in-app toggle.
- How does the tab bar behave when a deep-linked URL opens a detail screen (does it highlight the correct tab)?
- When skeleton loaders are displayed and the data request fails, skeletons are replaced with an inline error message and a "Tentar novamente" (retry) button. Tapping retry re-triggers the data load and shows skeletons again.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an expanded design system with a typography scale (at least 5 sizes), shadow/elevation presets, and semantic color tokens for both light and dark themes. All color token pairings MUST meet WCAG AA contrast ratios (minimum 4.5:1 for text, 3:1 for UI components) in both themes.
- **FR-002**: System MUST implement bottom tab navigation for 4 main sections (Aulas, Séries, Professores, Sincronizar), each with a labeled icon in Portuguese (PT-BR).
- **FR-003**: System MUST automatically switch between light and dark color themes based on the device's current appearance setting by default, AND provide an in-app toggle with three options (Light / Dark / System) that overrides the device setting when explicitly chosen. The "System" option (default) follows the device setting. When the device does not support color scheme detection, the "System" option defaults to light theme.
- **FR-004**: All 13 screens and 7 components MUST reference design tokens for colors, spacing, and typography (no hardcoded color, spacing, or font values in screen or component files).
- **FR-005**: System MUST integrate icons throughout the app including navigation tabs, floating action buttons, status badges, and form controls.
- **FR-006**: System MUST provide basic screen transition animations and immediate visual feedback on all interactive element presses.
- **FR-007**: System MUST apply a consistent floating action button design across all list screens that support item creation.
- **FR-008**: System MUST display improved empty states with an icon/illustration, descriptive guidance text, and a primary call-to-action button on all list screens when no data is present.
- **FR-009**: System MUST preserve all existing functionality identically (CRUD for lessons, series, professors, topics; export; sync) with no behavioral changes.

### Key Entities

- **Theme**: Represents the visual configuration of the app. Contains light and dark color palettes (semantic color tokens), a typography scale, a spacing scale, and shadow/elevation presets. The active theme is determined by the user's in-app preference (Light / Dark / System), where "System" (default) follows the device's appearance setting. The user's choice persists across app restarts.
- **Navigation Structure**: Defines how users move through the app. Consists of a bottom tab bar with 4 tabs, each containing its own stack of screens for drill-down navigation within that section.
- **Component Library**: The set of standardized, reusable UI components (cards, buttons, FABs, badges, form inputs, empty states, skeletons) that all screens compose from, ensuring visual consistency.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can switch between all 4 main sections (Aulas, Séries, Professores, Sincronizar) in a single tap via bottom tab navigation.
- **SC-002**: App defaults to the device's light/dark mode preference ("System") and allows the user to override it via an in-app toggle (Light / Dark / System). The chosen preference persists across app restarts.
- **SC-003**: Zero hardcoded color, spacing, or font values remain in any screen or component file (all values reference design tokens).
- **SC-004**: All interactive elements (buttons, cards, list items, FABs) provide visual feedback within 100ms of a press event.
- **SC-005**: Screen transitions play a smooth animation (no instant jumps between screens).
- **SC-006**: App maintains full functionality in Expo Go without requiring a custom development client.
- **SC-007**: All existing features (CRUD for lessons, series, professors, topics; CSV export; data sync) continue working identically after the design overhaul.
- **SC-008**: Every list screen displays a descriptive empty state (icon + message + action button) when no data is present.
- **SC-009**: All text and UI component color pairings meet WCAG AA contrast ratios (4.5:1 for text, 3:1 for UI components) in both light and dark themes.
