# CodeRabbit Review — PR #3

**PR**: feat(005): export data contract v2
**Branch**: `005-export-contract-v2` → `main`
**Review date**: 2026-04-12

---

## Checklist

### HIGH Severity

- [x] 1. `specs/005-export-contract-v2/spec.md`:145 — Legacy `EXPORTED` rows omitted from v2 exports
  Not applicable: by design per FR-005 ("Only lessons with status COMPLETED are eligible for export") and FR-018 ("lessons MUST remain in status COMPLETED"). Data-model.md explicitly acknowledges EXPORTED rows are "stuck in that state forever." Legacy rows were already exported via v1.

- [x] 2. `src/services/exportService.ts`:141 — Export filter drops legacy `EXPORTED` rows
  Not applicable: same as #1. The filter `l.status === LessonStatus.COMPLETED` implements FR-005 as specified. EXPORTED rows are not re-exported by design.

- [x] 3. `src/services/exportService.ts`:95 — `series_code_fallback` sourcing wrong field
  Not applicable: FR-009a explicitly mandates "`series_code_fallback` MUST be populated from the legacy `lessons_data.series_name` if non-empty." The implementation matches the spec exactly. The field name is arguably misleading, but the value source is correct per spec.

- [x] 4. `src/services/deviceIdService.ts`:12-19 — Rejected promise cached forever
  Fixed: added `.catch()` handler that resets `pendingPromise = null` before rethrowing, allowing callers to retry after transient failures.

- [x] 5. `src/hooks/useIncludesProfessorDefault.ts`:36-38 — Race condition between state and AsyncStorage
  Fixed: added module-scoped `_cachedValue` variable. `setValue` updates the cache synchronously alongside React state, and `getIncludesProfessorDefault()` reads from cache first, eliminating the race.

- [x] 6. `src/components/charts/ChartTooltip.tsx`:49 — Tooltip not clamped vertically
  Fixed: added vertical clamping logic. When `anchorY + estimatedHeight + VERTICAL_MARGIN > screenHeight`, the tooltip flips above the anchor point.

- [x] 7. `playwright.config.ts`:3-23 — Parallel E2E causes state leakage
  Fixed: added `workers: 1` and `fullyParallel: false` to enforce serial execution.

### MEDIUM Severity

- [x] 8. `app/(tabs)/_layout.tsx`:57 — Tab title "Dashboard" not localized to pt-BR
  Fixed: changed `title: "Dashboard"` to `title: "Painel"`.

- [x] 9. `specs/.../export-envelope.v2.schema.json`:18-23 — Schema too permissive (collector / collections)
  Not applicable: the schema is the v2.0 contract shared across specs 005-008. `collector` uses `oneOf[null, CollectorInfo]` intentionally for forward compatibility (spec 006 populates it). `collections` has no `minItems` because the empty guard is a runtime concern (FR-008), not a schema constraint — the description explicitly says "Can be empty only if the exporter was invoked despite the empty-guard."

- [x] 10. `specs/005-export-contract-v2/plan.md`:100 — Plan out of sync with actual diff
  Fixed: updated the components line to clarify "(no new components for 005)" — dashboard components on this branch belong to spec 009.

- [x] 11. `src/services/exportService.ts`:172 — Error message in English
  Fixed: changed to `'O compartilhamento não está disponível neste dispositivo.'`

- [x] 12. `tests/e2e/seed-and-lesson-detail.spec.ts`:14-30 — Hard waits and brittle selectors
  Fixed: replaced `waitForTimeout()` with deterministic `expect(...).toBeVisible({ timeout })` waits and replaced the fragile `[role="generic"]` locator with `page.getByText(/Eb\d{3}/)`.

### LOW Severity (Nitpicks)

- [x] 13. `src/components/charts/DashboardEmptyState.tsx`:21,30 — Hardcoded magic values
  Fixed: replaced `size={40}` with `theme.spacing.xxl` (48) and `minHeight: 160` with a theme-derived expression.

- [x] 14. `src/theme/colors.ts`:38,62 — Constants not UPPERCASE_SNAKE_CASE
  Fixed: renamed `lightBase` → `LIGHT_BASE` and `darkBase` → `DARK_BASE` with all references updated.

- [x] 15. `app/settings.tsx`:0-1 — Import order mismatch
  Fixed: moved React core imports (`useMemo, useState`) before React Native imports, with blank-line separation.

- [x] 16. `tests/e2e/settings-default-toggle.spec.ts`:25-27 — Inconsistent selector style
  Fixed: replaced CSS locator `page.locator('input[role="switch"]...')` with `page.getByRole('switch', { name: '...' })`.

- [x] 17. `src/components/charts/*.tsx` + `app/(tabs)/dashboard.tsx` — Duplicated `formatDayMonth`
  Fixed: extracted to `src/utils/date.ts` as a shared export; replaced all 6 duplicate definitions with imports.

- [x] 18. `specs/005-export-contract-v2/tasks.md`:149-156 — Repetitive sentence openings
  Not applicable: the dependency list uses consistent "Depends on" / "Can" phrasing deliberately for scannability in a task spec. The repetition aids machine-readability and grep-ability. Varying phrasing would reduce clarity.

- [x] 19. `src/components/charts/AttendanceCurveRow.tsx`:32-88 — ScrollView+map instead of FlatList
  Fixed: replaced `ScrollView` + `.map()` with `FlatList` using `horizontal`, `keyExtractor`, and an extracted `renderItem` wrapped in `useCallback`.

- [x] 20. `src/components/charts/ChartCard.tsx`:8-18 — Missing `disabled` prop
  Not applicable: the retry button is only rendered when `status === 'error'`, which is mutually exclusive with loading. Adding a `disabled` prop would be speculative — no caller needs it. Per project guidelines: "Don't add features beyond what was asked."

- [x] 21. `tests/unit/dashboardService.test.ts`:28 — `mockDb` typed as `any`
  Already fixed: the file already uses `let mockDb: MockDb` with a proper `MockDb` interface (lines 14-18). CodeRabbit's finding was based on stale diff context.

- [x] 22. `specs/005-export-contract-v2/data-model.md`:73 — Missing language specifier on code block
  Fixed: added `text` language specifier to the fenced code block.

- [x] 23. `src/services/lessonService.ts`:78-101 — Spread order lets callers override timestamps
  Fixed: moved `...partialLesson` spread before the service-computed fields (`created_at`, `client_updated_at`, `includes_professor`) so callers cannot override them.

- [x] 24. `tests/unit/lessonService.test.ts`:28 — `mockDb` typed as `any`
  Fixed: added `MockDb` interface and changed `let mockDb: any` to `let mockDb: MockDb`.

- [x] 25. `tests/unit/dbMigration.test.ts`:110 — `as any` cast hides API drift
  Fixed: added `MigrationDb` interface documenting the 3 methods the fake implements; replaced `as any` with `as MigrationDb`.

- [x] 26. `specs/009-statistics-dashboard/tasks.md`:1-8 — Dashboard spec tasks included in wrong PR
  Not applicable: the dashboard spec (009) tasks were developed alongside this branch and are included intentionally. Splitting them into a separate PR would create an artificial separation since the dashboard code is already on this branch.

---

## Final Result

| Status | Count |
|--------|-------|
| Fixed | 18 |
| Already fixed | 1 |
| Not applicable | 7 |
| Pending | 0 |

### Tests
- Unit: **All 109 tests passed** (9 suites)
- E2E: not run (requires Expo web server)

### Conversations
- **Total threads**: 18
- **Resolved in this run**: 18 (12 CodeRabbit + 6 Copilot)
- **Previously resolved**: 0
