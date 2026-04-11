# Quickstart — Statistics Dashboard

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This walkthrough verifies the MVP (P1) of the Statistics Dashboard end-to-end on a developer machine.

## Prerequisites

- Repository checked out, `npm install` run at least once.
- Expo Go installed on a phone OR an emulator booted.
- At least a handful of completed lessons on the device. If starting from an empty DB, seed with the existing dev seed service (`npm run seed` if available, or create a few lessons manually through the app and mark them complete).

## 1. Install the new chart dependency

Because this feature adds a runtime dependency, a fresh `npm install` is required the first time you pull the branch:

```bash
npm install
```

Expected: `react-native-gifted-charts` and `react-native-svg` appear in `node_modules`. No native rebuild is needed for Expo Go — `react-native-svg` is already a transitive dep of Expo SDK 54.

## 2. Start the dev server

```bash
npm start
```

Scan the QR code with Expo Go (or press `a` for Android emulator, `i` for iOS simulator).

## 3. Navigate to the Dashboard tab

The bottom tab bar now has **five** tabs: `Aulas`, `Dashboard`, `Séries`, `Professores`, `Sincronizar`. Tap **Dashboard** (icon: `stats-chart` / `stats-chart-outline`).

## 4. Verify the P1 charts

You should see (in order, scrolling vertically):

### 4.1 Late Arrival Index (FR-030)

- A vertical bar chart with one bar per lesson, up to the 12 most recent.
- Horizontal dashed line at 50% labeled **"50% de atraso"**.
- Each bar is colored by threshold: `<40%` light, `40–60%` medium, `>60%` dark (warning).
- Card title: **"Índice de Chegada Tardia"**.
- Subtitle: **"% de pessoas que chegaram depois do início"**.

**Tap a bar**: an inline tooltip appears with:

```text
Início: 7
Fim: 25
Atrasaram: 18
Ver aula →
```

Tap **Ver aula** → the app navigates to the detail screen of that lesson.
Tap outside the tooltip → it dismisses.

### 4.2 Attendance Curve per Lesson (FR-031)

- A horizontally scrollable row of small line charts, one per lesson, up to the 12 most recent.
- Each mini-chart has 3 points labeled `Início, Meio, Fim` on the X axis.
- Below each mini-chart: the lesson date (DD/MM format) and topic title (or blank if the lesson has no topic).
- Card title: **"Curva de Presença por Aula"**.
- Subtitle: **"Como a turma chega, fica e sai"**.

**Tap a point** on any mini-chart: the same FR-015 tooltip appears (raw counts + "Ver aula" link).

## 5. Edge-case verification

### 5.1 Empty state

If you open the dashboard with fewer than 2 lessons:

- The Late Arrival card shows the empty state **"Coleta pelo menos 2 aulas para ver seu primeiro gráfico"**.
- The Attendance Curve card shows a similar empty state.
- **No crash**, no console errors.

### 5.2 Data-entry error (EC-007)

Create a lesson where `attendance_end < attendance_start` (e.g., start=20, end=10). Mark it complete. Reopen the dashboard.

- The bar for this lesson appears with percent = 0.
- Tapping the bar shows the tooltip with a `⚠ Contagem inconsistente — verifique a aula` flag.

### 5.3 Zero denominator (EC-002, clarification session 2026-04-11)

Create a lesson with `attendance_end = 0` (possible if the collector marks complete before entering any counts). Mark it complete.

- The lesson is NOT rendered in the Late Arrival chart.
- A footnote under the chart reads **"1 aula excluída por dados incompletos"**.

### 5.4 Status filter

Create a lesson in `IN_PROGRESS` status.

- It is NOT visible on the dashboard.
- Move it to `COMPLETED` (e.g., finish it in the app).
- Reopen the dashboard; now it IS visible.

## 6. Theme verification (SC-004)

1. Open the dashboard.
2. Go to Settings and toggle light/dark theme.
3. Return to the dashboard.

Expected: every chart (bars, axes, gridlines, labels, tooltip) recolors immediately to match the new theme. There should be no hardcoded hex values visible — run this grep to confirm zero hardcoded hex in the dashboard code:

```bash
# From repo root — expect no matches
grep -nR "#[0-9a-fA-F]\{3,6\}" \
  src/services/dashboardService.ts \
  src/components/charts/ \
  app/\(tabs\)/dashboard.tsx
```

## 7. Offline verification (SC-005)

1. Enable airplane mode on the device.
2. Fully close Expo Go, reopen it, navigate to Dashboard.

Expected: charts render exactly as before, no network error, no spinner stuck.

## 8. Run the unit tests

```bash
npm test -- dashboardService
```

Expected: all tests in `tests/unit/dashboardService.test.ts` pass. Key cases covered: percent formula, status filter, 12-row limit, chronological order, empty DB, EC-002 exclusions, EC-007 inconsistency flag.

## What's NOT in MVP (verify by absence)

- No Trend chart (FR-032, P2).
- No Punctuality chart (FR-033, P2).
- No Engagement chart (FR-034, P2).
- No Coverage Calendar (FR-035, P3).
- No Topic/Professor Ranking (FR-036, P3).
- No Professor Influence (FR-037, P3 — also blocked by missing `notes` column, see `research.md` §2).

These cards should simply not appear on the dashboard. When the P2 slice ships, they will be appended under the P1 cards in the order listed in `spec.md` §Charts Specifications.
