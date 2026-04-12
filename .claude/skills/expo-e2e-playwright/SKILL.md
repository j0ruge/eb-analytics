---
name: expo-e2e-playwright
description: >
  Generate and maintain Playwright E2E tests for Expo/React Native apps running on web
  (metro + react-native-web). Use this skill whenever the user asks to create E2E tests,
  add browser tests, test the UI end-to-end, validate screens with Playwright, or mentions
  "e2e", "end-to-end", "playwright", "browser test" in the context of an Expo or React Native
  project. Also activate when the user wants to verify UI behavior after implementing a
  feature — even if they don't mention "E2E" explicitly, this skill applies whenever manual
  UI validation can be automated via the web build.
---

# Expo E2E with Playwright

Generate reliable E2E tests for Expo/React Native apps by running them against the web
build (`npx expo start --web`). The web build uses `react-native-web` to render RN
components as HTML, and `wa-sqlite` for expo-sqlite — this gives us a real app running in
a real browser, testable with standard Playwright.

## When to use

- After implementing a feature that changes UI screens (new fields, toggles, cards, navigation)
- To validate form persistence (debounce autosave round-trips)
- To verify Settings preferences propagate to other screens
- To check empty states and guard conditions (alerts, disabled buttons)
- To smoke-test that the app loads without crash after schema/migration changes

## What works on Expo web (and what doesn't)

This is the single most important thing to understand. Expo's web build supports most of
the framework but has gaps in native-only APIs. Read `references/expo-web-compat.md` for
the full matrix, but the critical points are:

**Works on web** (safe to test):
- All UI rendering (View, Text, TextInput, Switch, ScrollView, FlatList)
- expo-router navigation (file-based routing maps to URL paths)
- expo-sqlite (uses wa-sqlite WebAssembly — full CRUD works)
- AsyncStorage (uses localStorage on web)
- expo-constants (reads app.json config)
- Alerts via `Alert.alert` (becomes `window.alert` — Playwright intercepts these)
- Theme switching, state management, debounced persistence

**Does NOT work on web** (skip or mock):
- `expo-file-system` (`Paths.cache`, `File.write()` — web stub logs warning and returns empty)
- `expo-sharing` (`shareAsync` — needs HTTPS + Web Share API, fails on localhost)
- `expo-camera`, `expo-sensors`, `expo-location` — hardware APIs
- `expo-secure-store` — no web implementation
- Push notifications, deep linking to native apps

When designing tests, never write a test that touches the broken APIs. Instead, test
everything UP TO the point where the broken API is called, and rely on unit tests for
the untestable path.

## Test architecture

### Directory structure

```
tests/
├── unit/           # Jest unit tests (existing)
├── e2e/            # Playwright E2E tests (this skill)
│   ├── *.spec.ts   # Test files
│   └── helpers/    # Shared page helpers (optional, add when 3+ specs share logic)
playwright.config.ts  # At repo root
```

### Config pattern

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:8082',
    headless: true,
  },
  webServer: {
    command: 'npx expo start --web --port 8082',
    url: 'http://localhost:8082',
    timeout: 60_000,
    reuseExistingServer: true,  // Don't kill an already-running server
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
```

The `reuseExistingServer: true` is important — during development the dev server is
often already running. On CI, set `reuseExistingServer: !process.env.CI`.

### Jest isolation

Add `tests/e2e/` to Jest's ignore list so the two runners don't collide:

```javascript
// jest.config.js
testPathIgnorePatterns: ["/node_modules/", "tests/e2e/"],
```

## Writing tests — patterns and principles

### 1. Use web-first assertions, not snapshots or hard waits

Playwright's `expect(locator).toBeVisible()` auto-retries until the condition is met.
This is far more reliable than `page.waitForTimeout()`.

```typescript
// GOOD — auto-waits up to the test timeout
await expect(page.getByText('Aulas Finalizadas:')).toBeVisible();

// BAD — flaky, wastes time when fast, too short when slow
await page.waitForTimeout(2000);
expect(await page.getByText('Aulas Finalizadas:').isVisible()).toBe(true);
```

The ONE exception: debounced autosave. If the app uses a 500ms debounce (like
eb-analytics does), you need a brief wait AFTER filling a field and BEFORE navigating
away, to ensure the save fires. Use `page.waitForTimeout(1500)` — 3x the debounce
interval is a safe margin. Document why in a comment.

### 2. Prefer role-based and label-based locators

React Native Web renders components with ARIA roles. Use them:

```typescript
// BEST — stable, accessible, framework-agnostic
page.getByRole('switch', { name: 'Incluir professor nas contagens' })
page.getByRole('textbox', { name: 'Clima' })
page.getByRole('tab', { name: /Sincronizar/ })
page.getByRole('button', { name: 'Carregar dados de exemplo' })
page.getByRole('heading', { name: 'EB Insights' })

// GOOD — when ARIA role isn't available or is generic
page.getByText('Aulas Finalizadas:')

// AVOID — brittle, breaks on class name changes
page.locator('.css-view-g5y9jx')
page.locator('[data-testid="export-btn"]')  // RN Web doesn't emit testID as data-testid reliably
```

### 3. Handle `Alert.alert` as browser dialogs

React Native's `Alert.alert` maps to `window.alert()` on web. Playwright auto-dismisses
dialogs by default. To assert the dialog content, register a handler BEFORE the action
that triggers it:

```typescript
page.on('dialog', async (dialog) => {
  expect(dialog.message()).toContain('Não há aulas finalizadas');
  await dialog.accept();
});

await page.getByText('Exportar Dados (JSON)').click();
```

### 4. Navigate by URL, not by clicking through the app

Expo Router maps file-based routes to URL paths. Going directly to a URL is faster
and more reliable than clicking through tabs:

```typescript
// GOOD — direct, fast, no intermediate state
await page.goto('/settings');
await page.goto('/lesson/some-uuid');

// SLOWER — clicks can fail if the tap target is intercepted by another element
await page.getByRole('tab', { name: /Sincronizar/ }).click();
```

Use click-based navigation only when testing the actual navigation flow is the point.

### 5. React Native Web Switch quirk

RN Web renders `<Switch>` as a hidden `<input type="checkbox" role="switch">`. The
Playwright accessibility snapshot may NOT show `[checked]` even when the switch is ON.
To reliably assert switch state, query the DOM directly:

```typescript
const switchEl = page.locator(
  'input[role="switch"][aria-label="My Switch Label"]'
);
await expect(switchEl).toBeChecked();    // Works correctly
await expect(switchEl).not.toBeChecked();
```

### 6. Avoid ambiguous text locators

`page.getByText('0')` will fail if multiple elements show "0". Be specific:

```typescript
// BAD — strict mode violation when "0" appears in multiple counters
await expect(page.getByText('0')).toBeVisible();

// GOOD — scoped to a parent or using a more specific locator
await expect(page.getByText('Aulas Finalizadas:')).toBeVisible();
```

### 7. Test structure template

Each E2E test file should follow this pattern:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature — Scenario Name (quickstart §N)', () => {
  test('description of what is being validated', async ({ page }) => {
    // Auto-dismiss any alert dialogs
    page.on('dialog', (d) => d.accept());

    // 1. Navigate to the starting point
    await page.goto('/some-route');

    // 2. Perform actions
    await page.getByRole('button', { name: 'Action' }).click();

    // 3. Assert outcomes with web-first assertions
    await expect(page.getByText('Expected Result')).toBeVisible();
  });
});
```

### 8. Testing debounced field persistence

When the app uses debounced autosave, the test needs to fill → wait → navigate away →
come back → assert:

```typescript
test('field values survive navigation round-trip', async ({ page }) => {
  await page.goto('/some-form');

  await page.getByRole('textbox', { name: 'Field' }).fill('Test value');

  // Wait for debounce (500ms) + safety margin
  await page.waitForTimeout(1500);

  await page.goto('/');              // Navigate away
  await page.goto('/some-form');     // Come back

  await expect(page.getByRole('textbox', { name: 'Field' })).toHaveValue('Test value');
});
```

## Anti-patterns to avoid

Read `references/anti-patterns.md` for the full list, but the critical ones are:

1. **Testing expo-file-system / expo-sharing on web** — they crash. Test the logic that
   builds the data (unit test), not the file I/O.

2. **Using `waitForTimeout` where `expect().toBeVisible()` works** — flaky and slow. The
   ONLY legitimate use is waiting for a debounce timer.

3. **Relying on testID** — React Native Web does NOT reliably emit `data-testid`. Use
   `accessibilityLabel` → `getByRole`/`getByLabel` instead.

4. **Testing the same lesson instance across test files** — wa-sqlite on web persists to
   IndexedDB. Tests that share state become order-dependent and flaky. Each test should
   create its own data or use a fresh seed.

5. **Hardcoding UUIDs in assertions** — lesson IDs are generated at runtime. Capture the
   URL after creation (`const url = page.url()`) and re-navigate to it.

6. **Ignoring the accessibility tree** — the Playwright snapshot shows the RN Web
   accessibility tree, which is your best friend for writing robust locators. Always
   check `browser_snapshot` or `page.getByRole` before resorting to CSS selectors.

## Execution workflow

When asked to create E2E tests for a feature:

1. **Read the feature spec/quickstart** to understand what scenarios exist.
2. **Classify each scenario** as web-testable or not (using the compat matrix above).
3. **Start the Expo web server** if not already running: `npx expo start --web --port 8082`.
4. **Explore the UI interactively** via Playwright MCP tools (browser_navigate, browser_snapshot, browser_click) to discover locators and understand the rendered HTML structure.
5. **Write the spec files** in `tests/e2e/`, one file per logical scenario.
6. **Run `npx playwright test --reporter=list`** and fix any failures.
7. **Commit** the passing tests alongside the feature implementation.

## Running tests

```bash
# Full E2E suite (starts server automatically via webServer config)
npm run test:e2e

# Single file
npx playwright test tests/e2e/my-test.spec.ts

# With visible browser (debugging)
npx playwright test --headed

# Generate HTML report
npx playwright test --reporter=html
```
