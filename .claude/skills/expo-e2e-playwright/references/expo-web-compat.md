# Expo SDK 54 — Web Platform Compatibility Matrix

This reference documents what works and what doesn't when running an Expo app on web
via `npx expo start --web`. This is critical for deciding which E2E test scenarios
are feasible via Playwright.

## Core platform

| Module | Web support | Implementation | Notes |
|---|---|---|---|
| `react-native-web` | ✅ Full | Translates RN components to HTML/CSS | Required dep for web builds |
| `expo-router` | ✅ Full | File-based routing maps to URL paths | `/settings` → `app/settings.tsx` |
| `expo-constants` | ✅ Full | Reads `app.json` config | `Constants.expoConfig?.version` works |

## Storage

| Module | Web support | Implementation | Notes |
|---|---|---|---|
| `expo-sqlite` | ✅ Full | `wa-sqlite` (WebAssembly) | Full SQL support, persists to IndexedDB |
| `@react-native-async-storage/async-storage` | ✅ Full | `localStorage` | Sync read/write, 5MB limit |
| `expo-secure-store` | ❌ None | No web stub | Crashes on import |

## File system & sharing

| Module | Web support | Implementation | Notes |
|---|---|---|---|
| `expo-file-system` (legacy API) | ⚠️ Partial | Web stub logs warnings | `downloadAsync` works, `Paths`/`File` do NOT |
| `expo-file-system` (new `File` API) | ❌ None | `Paths.cache` is undefined | `file.write()` throws on web |
| `expo-sharing` | ⚠️ Limited | `navigator.share` | Requires HTTPS + modern browser; `isAvailableAsync()` returns false on HTTP localhost |

## UI rendering

| Component | Web support | Notes |
|---|---|---|
| `View`, `Text`, `ScrollView` | ✅ Full | Standard HTML divs |
| `TextInput` | ✅ Full | Renders as `<input>` or `<textarea>` |
| `Switch` | ✅ Full | Renders as `<input type="checkbox" role="switch">` — see quirk note below |
| `FlatList` | ✅ Full | Windowed rendering works |
| `Alert.alert` | ✅ Mapped | Becomes `window.alert()` — Playwright auto-dismisses |
| `Pressable`, `TouchableOpacity` | ✅ Full | Cursor and hover events work |
| `StyleSheet` | ✅ Full | Converted to CSS-in-JS |

### Switch rendering quirk

React Native's `<Switch>` on web renders as two nested elements:
1. An outer `<div role="switch">` (visual track/thumb)
2. A hidden `<input type="checkbox" role="switch">` (actual form element)

The Playwright accessibility snapshot reports the outer div's state, which may NOT
include `[checked]`. To reliably assert the checked state:

```typescript
// Use the inner input element directly
const switchInput = page.locator(
  'input[role="switch"][aria-label="My Label"]'
);
await expect(switchInput).toBeChecked();
```

## Animations & gestures

| Module | Web support | Notes |
|---|---|---|
| `react-native-reanimated` | ✅ Full | Web-compatible JS animations |
| `react-native-gesture-handler` | ✅ Full | Touch events mapped to pointer events |
| `expo-linear-gradient` | ✅ Full | CSS gradient fallback |

## Hardware & native APIs

| Module | Web support | Notes |
|---|---|---|
| `expo-camera` | ❌ None | Hardware API |
| `expo-sensors` | ❌ None | Accelerometer, gyroscope |
| `expo-location` | ⚠️ Partial | Uses browser geolocation API |
| `expo-notifications` | ❌ None | Push notifications |
| `expo-device` | ⚠️ Partial | Some properties available via navigator |
| `expo-application` | ⚠️ Partial | `nativeApplicationVersion` returns null on web |

## Testing implications

### What to test via Playwright (web)
- Screen rendering (does it crash?)
- Form input and persistence (TextInput, Switch, CounterStepper)
- Navigation flows (tab switches, screen transitions)
- Settings preferences propagating to other screens
- Empty states and guard conditions (alerts before touching native APIs)
- Data seeding and CRUD via expo-sqlite (wa-sqlite)

### What to test via unit tests only
- File system operations (export to JSON file)
- Share sheet interactions
- Secure storage operations
- The actual payload shape of exports (mock the service layer)
- Migration safety (mock SQLite in-memory)

### What requires a physical device
- Full export → share sheet → verify JSON file contents
- Camera/sensor integration
- Push notification delivery
- Deep linking from other apps
