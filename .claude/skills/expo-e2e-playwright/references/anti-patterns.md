# Anti-Patterns for Expo + Playwright E2E Tests

These are patterns we discovered the hard way during spec 005 implementation.
Each one caused real test failures or false positives.

## 1. Testing native-only APIs on web

**Problem**: `expo-file-system` (`File`, `Paths.cache`) and `expo-sharing`
(`shareAsync`) crash on web. Any test that clicks an export button and
expects a file to appear will fail.

**What to do instead**: Test everything BEFORE the native API call. For
example, the empty-guard alert (`completedCount === 0`) fires before
`exportService.exportData()` touches the filesystem — that's testable.
The actual file content is covered by unit tests that mock the filesystem.

## 2. Strict-mode text locator collisions

**Problem**: `page.getByText('0')` matches every "0" on the page. On a
sync screen with "Aulas Finalizadas: 0" and "Aulas Exportadas: 0",
Playwright throws a strict-mode violation.

**What to do instead**: Use a parent-scoped locator or a more specific
text:

```typescript
// BAD
await expect(page.getByText('0')).toBeVisible();

// GOOD — assert the label, not the number
await expect(page.getByText('Aulas Finalizadas:')).toBeVisible();
```

## 3. Trusting the accessibility snapshot for Switch checked state

**Problem**: React Native Web renders `<Switch>` as two nested elements.
The Playwright accessibility snapshot may show the OUTER div (no `checked`
attribute) instead of the INNER input checkbox. Code like
`expect(snapshot).toContain('[checked]')` silently passes even when the
switch is OFF, because it matches a different `[checked]` somewhere else.

**What to do instead**: Query the actual DOM element:

```typescript
const switchInput = page.locator(
  'input[role="switch"][aria-label="My Label"]'
);
await expect(switchInput).toBeChecked();
```

## 4. Forgetting the debounce wait

**Problem**: The app uses 500ms debounced autosave. If you fill a field
and immediately navigate away, the save never fires. The field appears
empty when you come back.

**What to do instead**: Wait 3x the debounce interval after the last
field interaction:

```typescript
await page.getByRole('textbox', { name: 'Clima' }).fill('Ensolarado');
await page.waitForTimeout(1500); // 3x 500ms debounce
await page.goto('/');
```

This is the ONE legitimate use of `waitForTimeout` in these tests.

## 5. Using testID for locators

**Problem**: React Native's `testID` prop maps to `data-testid` on
web — but ONLY in some cases. The mapping is inconsistent across RN
Web versions and component types. Some components strip it entirely.

**What to do instead**: Use `accessibilityLabel` (maps to `aria-label`)
and query with `getByRole` or `getByLabel`:

```typescript
// In your component
<TextInput accessibilityLabel="Clima" ... />

// In your test
page.getByRole('textbox', { name: 'Clima' })
```

## 6. Shared state between test files

**Problem**: wa-sqlite on web persists to IndexedDB. If Test A creates
a lesson and Test B assumes an empty database, Test B fails when running
after Test A.

**What to do instead**: Each test should either:
- Create its own data (navigate to form, fill, save)
- Use the dev seed button (idempotent — skips if already seeded)
- Accept whatever data exists and assert relative conditions

Never assert exact counts unless you control the starting state.

## 7. Clicking through overlapping elements

**Problem**: React Native Web's layout sometimes places invisible overlay
divs (for pointer events, absolute positioning) that intercept clicks.
A button that works on mobile may timeout on web because Playwright
can't click through the overlay.

**What to do instead**: Navigate by URL instead of clicking:

```typescript
// BAD — may timeout due to overlay
await page.getByRole('link', { name: 'Settings' }).click();

// GOOD — direct navigation
await page.goto('/settings');
```

Use click-based navigation only when testing the navigation itself.

## 8. Auto-dismissed dialogs with no assertion

**Problem**: Playwright auto-dismisses `window.alert()` dialogs by
default. If your test expects an alert but doesn't register a handler,
the alert fires and disappears silently — the test passes even if the
alert had the wrong message.

**What to do instead**: Register a dialog handler BEFORE the action:

```typescript
page.on('dialog', async (dialog) => {
  expect(dialog.message()).toContain('expected text');
  await dialog.accept();
});

await page.getByText('Button that triggers alert').click();
```

## 9. Hardcoding lesson UUIDs

**Problem**: Lesson IDs are generated at runtime with `uuid.v4()`.
A test that navigates to `/lesson/abc-123` will get a 404 because
that ID doesn't exist.

**What to do instead**: Create the lesson via the UI, then capture the
URL from the page:

```typescript
await page.getByText('Nova Aula').click();
const lessonUrl = page.url(); // e.g., /lesson/a9520580-ebb1-...
// ... do stuff ...
await page.goto(lessonUrl);   // Come back to the same lesson
```

## 10. Port conflicts

**Problem**: Expo's dev server binds to a port. If port 8081 is already
in use (common for metro), the `--port 8081` flag will fail in
non-interactive mode (metro asks "use 8082 instead?" but can't in CI).

**What to do instead**: Use a dedicated port in your playwright config
(e.g., 8082) that doesn't collide with the default metro port (8081).
The `reuseExistingServer: true` option in playwright.config.ts handles
the case where the server is already running.
