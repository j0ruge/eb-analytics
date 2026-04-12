# Quickstart — Export Data Contract v2

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data Model**: [data-model.md](./data-model.md)

This is the manual verification script for spec 005. Run it after `/speckit.implement` finishes, before opening a PR. Every step is either a pass or a fail; no "looks good" allowed.

## Prerequisites

- Working branch: `005-export-contract-v2`
- Node + npm installed and `node_modules` present
- Expo CLI reachable via `npm start`
- A physical phone or emulator with the Expo Go app (or a dev build)
- A text editor that can open raw JSON files

## 0. Sanity

Run in the project root:

```bash
npm run lint
npm test
npx tsc --noEmit
```

All three commands must exit 0. If any fails, stop and fix before continuing.

## 1. Fresh install smoke test (primary path)

**Setup**:

1. On the device, uninstall the app if present, then reinstall via Expo Go scan. Do NOT log in anywhere (no spec 006 yet; there is no login screen to use).
2. In the app, go to `Configurações` → `Desenvolvimento` → `Carregar dados de exemplo`. Wait for the success toast.
3. Go to the home tab (lesson list). Verify at least 5 lessons are visible with various series codes (`Eb354`, `Eb355`, etc.).

**Exercise the new fields**:

4. Open any lesson in status `COMPLETED`. (If none are completed by the seed, open an `IN_PROGRESS` one and tap through to complete it.)
5. Verify the toggle **"Contei o professor nestas contagens"** is visible immediately below the attendance counters.
6. Verify the new **"Observações"** card is visible below the attendance card, containing:
   - A short text input labeled `Clima` with placeholder `Ex: Ensolarado 28°C`
   - A multi-line text input labeled `Observações` with placeholder `Observações livres sobre a aula`
7. Toggle `includes_professor` to ON.
8. Type `Ensolarado 28°C` into the `Clima` field.
9. Type `Teste quickstart 005` into the `Observações` field.
10. Wait at least 1 second to let the 500ms debounced autosave fire.

**Export**:

11. Go to the `Sync` tab. Tap `Exportar Dados (JSON)`.
12. The OS share sheet MUST open. Save the file to a location where you can open it (Drive, Files, email to yourself).

**Inspect the file** in a text editor and assert ALL of the following:

- [ ] `schema_version === "2.0"`
- [ ] `collector === null` (not omitted, not `undefined`, literal `null`)
- [ ] `client.app_version` is a non-empty string (likely matches `app.json`'s version; if it's literally `"unknown"`, the `expo-constants` read failed — investigate)
- [ ] `client.device_id` is a valid UUID v4 (36 chars, 4 hyphens, lowercase)
- [ ] `exported_at` is a valid ISO 8601 UTC timestamp (ends in `Z`) with milliseconds
- [ ] `collections` is a non-empty array
- [ ] Locate the entry whose `notes === "Teste quickstart 005"`:
  - [ ] Its `attendance.includes_professor === true`
  - [ ] Its `weather === "Ensolarado 28°C"`
  - [ ] Its `status === "COMPLETED"`
  - [ ] Its `client_created_at` is an ISO timestamp
  - [ ] Its `client_updated_at` is an ISO timestamp, and is `>=` `client_created_at`
  - [ ] Its `id` is a UUID v4

## 2. XOR enforcement

**Goal**: prove that the write-path never emits both `*_id` and `*_name_fallback` for the same entity.

13. In the seed dataset, find a lesson whose professor was selected from the catalog (most of them — the seed links `professor_id` to a seed professor row).
14. Export again; open the file.
15. Locate that lesson's entry in the payload and assert:
    - [ ] `lesson_instance.professor_id` is a UUID
    - [ ] `lesson_instance.professor_name_fallback === null` (NOT the professor's actual name, NOT an empty string — literal `null`)
16. Now open the lesson detail, change the professor to a free-text value (pick "Outro" or use the free-text entry flow — if the ProfessorPicker doesn't support free text in 005, skip this step and note it in the PR).
17. Re-export. Locate the same lesson by `id`.
    - [ ] `lesson_instance.professor_id === null`
    - [ ] `lesson_instance.professor_name_fallback` equals the free-text name you typed
18. Repeat the same check for the series/topic pair on a lesson where the topic was originally catalog-selected:
    - [ ] `lesson_instance.topic_id` is a UUID, `lesson_instance.topic_title_fallback === null`
    - [ ] `lesson_instance.series_id` is a UUID (resolved via JOIN), `lesson_instance.series_code_fallback === null`

## 3. Re-exportability (SC-006)

19. Without modifying anything, tap `Exportar Dados (JSON)` on the `/sync` tab a second time.
20. Save the file under a different name and open both exports side-by-side.
21. Pick any entry and compare:
    - [ ] `collections[n].id` is identical between the two files
    - [ ] `collections[n].client_created_at` is identical
    - [ ] `collections[n].client_updated_at` is identical (assuming you did not edit the lesson between exports)
22. Verify the lesson you exported in step 11 is STILL listed in the `/sync` tab's "Aulas finalizadas" counter. It did NOT disappear after export.
    - [ ] Counter shows the same number before and after the second export.

## 4. Edit bumps `client_updated_at` (EC-005)

23. Open the same lesson from step 4. Change the `notes` field to `Teste quickstart 005 edited`.
24. Wait 1 second for autosave.
25. Export again. Open the file.
26. Locate the entry by `id`:
    - [ ] `notes === "Teste quickstart 005 edited"`
    - [ ] `client_updated_at` is strictly newer than `client_created_at`
    - [ ] `client_updated_at` is strictly newer than the `client_updated_at` value from step 22's file

## 5. Empty export guard (FR-008, EC-001)

27. In `Configurações` → `Desenvolvimento`, tap `Remover dados de exemplo`. Confirm the toast.
28. Go to `/sync`. The "Aulas finalizadas" counter should show `0`.
29. Tap `Exportar Dados (JSON)`.
    - [ ] An alert appears: `Não há aulas finalizadas para exportar.` (or the existing localized variant in `app/(tabs)/sync.tsx`)
    - [ ] The OS share sheet does NOT open
    - [ ] No file is created

## 6. Migration safety (SC-007)

**Only runs if you have a device with pre-existing 005 data — i.e., you were using this app before the migration.**

30. Before running the migration for the first time, back up the SQLite file (or take note of the `lessons_data` row count via `sqlite3` or a dev tool).
31. Launch the app post-migration. It should start without errors.
32. Verify the row count is unchanged.
33. Run a direct SQL query (via a debug tool or adding a one-off `console.log`):
    ```sql
    SELECT COUNT(*) FROM lessons_data WHERE client_updated_at IS NULL;
    ```
    - [ ] Result is `0` (every pre-existing row has been backfilled)
34. Verify no `status` value was changed by the migration:
    ```sql
    SELECT status, COUNT(*) FROM lessons_data GROUP BY status;
    ```
    - [ ] Pre-existing `EXPORTED` rows are still `EXPORTED` (not downgraded to `COMPLETED` or anything else)

## 7. Settings default preference

35. Go to `Configurações` → `Padrões` → toggle `Incluir professor nas contagens por padrão` ON.
36. Go back to the lesson list and tap `+ Nova Aula`.
37. Open the newly-created lesson:
    - [ ] The `Contei o professor nestas contagens` toggle is already ON
38. Go back to Settings and toggle the default OFF. Create another lesson.
39. Open it:
    - [ ] The per-lesson toggle is OFF

## 8. Constitution re-check

Confirm the final implementation respects all five constitution principles from [plan.md](./plan.md):

- [ ] **I. Local-First**: no network call was made during any of steps 1–38. If the app made a network request during export, fail.
- [ ] **II. Zero-Friction UX**: adding the three new fields did not introduce any mandatory keyboard interaction — `weather` and `notes` can be left empty and the lesson still completes.
- [ ] **III. Auto-Save & Fail-Safe**: all three new fields persisted via debounce, never via an explicit "Salvar" button.
- [ ] **IV. Backward Compatibility**: step 6 proved migration safety. Zero legacy `EXPORTED` rows were disturbed.
- [ ] **V. Separation of Concerns**: no screen imports `getDatabase()` directly; `exportService` does not import from `app/`; `lessonService` has no React imports.

## Failure handling

If any checkbox fails, stop and fix the implementation before proceeding. Do NOT open a PR with unchecked items. Mark the PR body with the step number and exact failure observed so the next reviewer can reproduce.
