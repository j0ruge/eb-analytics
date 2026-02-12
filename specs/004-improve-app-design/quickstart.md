# Quickstart: 004-improve-app-design

**Date**: 2026-02-11

## Prerequisites

- Node.js 18+
- Expo CLI (`npx expo`)
- Expo Go app on device/simulator (SDK 54)
- Branch `004-improve-app-design` checked out

## New Dependencies

Install these packages (all are Expo Go compatible — no custom dev client needed):

```bash
npx expo install react-native-reanimated @react-native-async-storage/async-storage
```

> `@expo/vector-icons` is already bundled with Expo — no install needed.
> `@react-navigation/bottom-tabs` is a transitive dependency of `expo-router` — no install needed.

## Configuration Changes

### 1. app.json — Enable automatic theme detection

Change `userInterfaceStyle` from `"light"` to `"automatic"`:

```json
{
  "expo": {
    "userInterfaceStyle": "automatic"
  }
}
```

### 2. babel.config.js — Reanimated plugin

Reanimated Babel plugin is auto-configured by `babel-preset-expo` in SDK 54. **No manual plugin addition needed.** If you encounter issues, verify `babel-preset-expo` is the preset:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

## Development Workflow

### Start the app

```bash
npx expo start
```

### Test dark mode

- **iOS Simulator**: Settings → Developer → Dark Appearance
- **Android Emulator**: Settings → Display → Dark theme
- **Physical device**: System settings → Display → Dark mode

### Test theme toggle

Navigate to Settings screen (gear icon in header) and switch between Light / Dark / System.

### Verify no hardcoded values

After updating screens/components, grep for remaining hardcoded values:

```bash
# Check for hardcoded colors (hex values in screen/component files)
grep -rn "#[0-9A-Fa-f]\{6\}" app/ src/components/ --include="*.tsx" --include="*.ts" | grep -v "theme/" | grep -v "node_modules"

# Check for hardcoded spacing (numeric padding/margin not from tokens)
grep -rn "padding: [0-9]" app/ src/components/ --include="*.tsx" | grep -v "theme/"
grep -rn "margin: [0-9]" app/ src/components/ --include="*.tsx" | grep -v "theme/"
```

Target: zero results from these searches (SC-003).

## File Structure Overview

### New files to create

```
src/theme/colors.ts           # Light + dark color palettes
src/theme/typography.ts        # Typography scale
src/theme/shadows.ts           # Cross-platform shadow presets
src/theme/ThemeProvider.tsx     # Theme context + provider
src/hooks/useTheme.ts          # Theme consumption hook
src/hooks/useThemePreference.ts # Persisted theme preference hook
src/components/EmptyState.tsx   # Reusable empty state
src/components/FAB.tsx          # Floating action button
src/components/SkeletonLoader.tsx # Skeleton placeholder
src/components/ErrorRetry.tsx   # Inline error + retry
app/(tabs)/_layout.tsx          # Tab navigator
app/(tabs)/index.tsx            # Aulas tab (moved from app/index.tsx)
app/(tabs)/series.tsx           # Séries tab (moved from app/series/index.tsx)
app/(tabs)/professors.tsx       # Professores tab (moved from app/professors/index.tsx)
app/(tabs)/sync.tsx             # Sincronizar tab (moved from app/sync/index.tsx)
app/settings.tsx                # Theme toggle screen
```

### Files to modify

```
app.json                        # userInterfaceStyle → "automatic"
app/_layout.tsx                 # Root Stack wrapping (tabs) + detail routes
src/theme/index.ts              # Re-export expanded theme
src/components/*.tsx            # All 7 existing components → use design tokens
app/lesson/*.tsx                # Use design tokens + icons
app/series/*.tsx                # Use design tokens + icons (detail/create only)
app/professors/*.tsx            # Use design tokens + icons (detail/create only)
app/topics/*.tsx                # Use design tokens + icons
```

## Implementation Order

1. **Theme system** (colors, typography, shadows, ThemeProvider) — foundation
2. **Tab navigation** (file restructuring, tab layout) — structural change
3. **Update existing components** (7 components → design tokens) — systematic
4. **Update existing screens** (13 screens → design tokens + icons) — systematic
5. **New components** (EmptyState, FAB, SkeletonLoader, ErrorRetry) — additive
6. **Animations** (press feedback, screen transitions) — polish
7. **Settings screen** (theme toggle) — final

## Verification Checklist

- [ ] App launches in Expo Go without errors
- [ ] Bottom tabs visible with 4 labeled icons
- [ ] Tab switching works with 1 tap
- [ ] Dark mode activates when device is in dark mode
- [ ] In-app theme toggle persists across app restart
- [ ] All screens use design tokens (no hardcoded values)
- [ ] All interactive elements show press feedback
- [ ] Screen transitions are animated
- [ ] Empty states display on all list screens with no data
- [ ] All existing CRUD/export/sync features still work
