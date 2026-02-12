# Research: 004-improve-app-design

**Date**: 2026-02-11
**Status**: Complete — all unknowns resolved

## Decision 1: Animation Library

**Decision**: Use `react-native-reanimated` v4 (bundled with Expo SDK 54)

**Rationale**: Reanimated v4 is pre-installed in Expo Go SDK 54 (`inExpoGo: true`). It provides worklet-based animations that run on the UI thread at 60fps. The Reanimated Babel plugin is auto-configured by `babel-preset-expo`, so no additional setup is required.

**Alternatives considered**:
- `Animated` (React Native built-in): Insufficient for complex animations; no worklet support; bridge-based causes jank.
- `react-native-moti`: Built on Reanimated but adds unnecessary abstraction for our use case (simple press feedback + screen transitions).
- No animation library: Would fail FR-006 (screen transitions + press feedback requirement).

**Constraint**: Reanimated v4 requires New Architecture. Expo SDK 54 enables this by default. Must use the exact version bundled in Expo Go (cannot pin a custom version).

---

## Decision 2: Icon Library

**Decision**: Use `@expo/vector-icons` (bundled with Expo SDK 54)

**Rationale**: Already included in Expo Go — no installation needed. Provides Ionicons, MaterialIcons, FontAwesome, and 10+ other icon sets. Ionicons is the best fit for an iOS-inspired app (matches current `#007AFF` primary color heritage).

**Alternatives considered**:
- `react-native-vector-icons`: Requires native linking; not compatible with Expo Go without custom dev client.
- SVG icons (custom): Excessive effort for this feature; no icon consistency guarantee.
- `@expo/vector-icons` with MaterialCommunityIcons set: Good alternative icon set, but Ionicons provides better outline/filled pairs for tab navigation.

**Icon set choice**: Ionicons — use `outline` variants for inactive tabs, filled variants for active tabs.

---

## Decision 3: Tab Navigation Approach

**Decision**: Use Expo Router file-based tabs via `app/(tabs)/_layout.tsx` with `Tabs` component from `expo-router`

**Rationale**: Expo Router 6.x has built-in tab support. Creating a `(tabs)` directory group with a `_layout.tsx` using the `Tabs` component produces a bottom tab bar automatically. No need to install `@react-navigation/bottom-tabs` separately — it's a transitive dependency of `expo-router`. This approach:
- Preserves file-based routing conventions
- Automatically handles tab stack history
- Supports typed routes (already enabled in app.json)
- Integrates with existing Stack screens for detail/create routes

**Alternatives considered**:
- Manual `@react-navigation/bottom-tabs` setup: Would conflict with Expo Router's file-based paradigm; requires manual route registration.
- Drawer navigation: Not suitable for 4 primary sections — bottom tabs are the mobile standard.
- Custom tab bar from scratch: Unnecessary since Expo Router's built-in tabs support full customization via `tabBar` prop.

**Structure**:
```
app/
├── _layout.tsx              # Root Stack (wraps tabs + detail screens)
├── (tabs)/
│   ├── _layout.tsx          # Tab navigator (4 tabs)
│   ├── index.tsx            # Aulas tab (lessons list)
│   ├── series.tsx           # Séries tab (series list)
│   ├── professors.tsx       # Professores tab (professors list)
│   └── sync.tsx             # Sincronizar tab (sync screen)
├── lesson/[id].tsx          # Detail (pushed from Aulas tab)
├── lesson/new.tsx           # Create (pushed from Aulas tab)
├── series/[id].tsx          # Detail (pushed from Séries tab)
├── series/new.tsx           # Create (pushed from Séries tab)
├── professors/[id].tsx      # Detail (pushed from Professores tab)
├── professors/new.tsx       # Create (pushed from Professores tab)
├── topics/[id].tsx          # Detail (pushed from Séries tab)
├── topics/new.tsx           # Create (pushed from Séries tab)
└── settings.tsx             # Theme toggle (pushed from any tab)
```

---

## Decision 4: Theme Preference Persistence

**Decision**: Use `@react-native-async-storage/async-storage` v2.2.0 (bundled with Expo SDK 54)

**Rationale**: AsyncStorage is included in Expo Go (`inExpoGo: true`). Theme preference is non-sensitive data (just "light", "dark", or "system" string), so plain-text storage is appropriate. AsyncStorage provides a simple key-value API perfect for this single setting.

**Alternatives considered**:
- `expo-secure-store`: Overkill — theme preference is not sensitive data.
- `expo-sqlite` (already in project): Could store in a settings table, but that couples UI preferences to the data layer. Constitution principle V (Separation of Concerns) favors keeping this separate.
- React state only (no persistence): Would fail SC-002 ("chosen preference persists across app restarts").

**Storage key**: `@eb-insights/theme-preference`
**Values**: `"light"` | `"dark"` | `"system"` (default: `"system"`)

---

## Decision 5: Theme Architecture

**Decision**: React Context provider with `useColorScheme` + AsyncStorage override

**Rationale**: The theme system needs to:
1. Read device color scheme via `useColorScheme()` (from `react-native`)
2. Allow manual override via persisted preference
3. Expose semantic tokens to all components via React Context
4. Re-render the entire tree on theme change

A `ThemeProvider` at the root layout provides the active theme via context. A `useTheme()` hook consumes it. This follows the pattern documented in the `react-native-design` skill (`styling-patterns.md` → Theme Context section).

**Alternatives considered**:
- Styled-components ThemeProvider: Adds a large dependency; not needed since StyleSheet + context achieves the same result.
- React Native Paper theme: Would impose Material Design aesthetics; app uses iOS-style design language.
- Zustand/Redux for theme state: Over-engineered for a single boolean-ish preference.

**Architecture**:
```
ThemeProvider (root)
  ├── reads: useColorScheme() (device)
  ├── reads: AsyncStorage (manual override)
  ├── computes: active theme (light or dark palette)
  └── provides: { theme, colorScheme, setThemePreference }
```

---

## Decision 6: Dark Mode Color Palette Strategy

**Decision**: Maintain iOS-style design language with adapted dark palette; all pairings WCAG AA compliant

**Rationale**: The existing app uses iOS system colors (`#007AFF`, `#34C759`, `#FF3B30`). For dark mode, use Apple's Dynamic System Colors convention: primary shifts slightly lighter for dark backgrounds, semantic colors remain recognizable but adjust luminance for contrast.

**Alternatives considered**:
- Material Design 3 dynamic color: Would require switching the entire design language — out of scope.
- Invert colors mechanically: Produces poor results; backgrounds, surfaces, and text need independent tuning.
- Single palette for both modes: Fails FR-003 (automatic light/dark switching).

**Contrast verification**: All token pairings will be checked against WCAG AA (4.5:1 text, 3:1 UI) per SC-009.

---

## Decision 7: app.json `userInterfaceStyle` Change

**Decision**: Change `userInterfaceStyle` from `"light"` to `"automatic"`

**Rationale**: Setting `"automatic"` tells Expo/React Native to report the device's actual color scheme via `useColorScheme()`. Without this change, `useColorScheme()` always returns `"light"` regardless of device setting, making FR-003 impossible to implement.

**Risk**: None — this is a configuration change with no impact on existing functionality when paired with the theme provider defaulting to light.
