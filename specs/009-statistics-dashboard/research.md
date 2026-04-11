# Phase 0 Research — Statistics Dashboard

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-04-11

## 1. Chart Library Selection

### Decision

**`react-native-gifted-charts` + `react-native-svg`** (peer dependency).

### Rationale

- **Expo Go compatibility**: works with Expo's managed workflow without any native config plugin, so developers can run the app from Expo Go on their phones with zero setup. This is how the team currently onboards; breaking that loop would be a significant cost.
- **No Skia requirement**: victory-native XL (the currently maintained version of victory-native, v41+) is built on `@shopify/react-native-skia`, which needs `expo-build-properties` configuration, a custom dev client, or a prebuild. None of that is justified for a feature whose MVP is two charts.
- **Chart coverage**: gifted-charts supports all MVP chart types — vertical bar charts (FR-030), line charts with multiple points (FR-031, FR-032), and diverging bar charts (FR-037) — with a consistent props API.
- **Theming**: accepts plain props for bar/line color, axis color, gridlines, label typography. This maps cleanly onto the theme-token approach required by FR-011.
- **Tooltip support**: has a built-in `onPress` per bar/point plus a `pointerConfig` for pointer-following interactions. The FR-015 tooltip pattern can be built on top without fighting the library.
- **Package footprint**: single dependency plus `react-native-svg` (already a transitive dep of many Expo libs, so close to zero cost).
- **Active maintenance**: regular releases; open issues are responded to.

### Alternatives Considered

| Library | Verdict | Why rejected |
|---|---|---|
| **victory-native XL (v41+)** | Rejected | Requires `@shopify/react-native-skia` + config plugin. Breaks Expo Go workflow. Strong rendering quality but overkill for 2 MVP charts. |
| **victory-native (v36, legacy)** | Rejected | Unmaintained on modern RN; compatibility with RN 0.81 + Reanimated 4.1 is not guaranteed. The spec's original assumption of "victory-native" was based on this version, which is now effectively abandoned. |
| **react-native-chart-kit** | Rejected | Older API, weaker TypeScript types, no first-class support for scroll + tooltip interactions as we need for FR-031. Still uses SVG so the perf is fine, but the DX is worse. |
| **Hand-drawn with react-native-svg only** | Rejected for MVP | Maximum control and smallest dep, but requires writing axis, gridlines, label positioning, and tooltip anchoring ourselves. Would roughly triple the component budget. Worth revisiting only if gifted-charts blocks us on a specific chart. |
| **Victory Native via web-only fallback** | Rejected | Not applicable for a mobile-first feature. |

### Follow-up work created by this decision

- Add `react-native-gifted-charts` and `react-native-svg` to `package.json` as `dependencies`. The task list will make these the first two tasks so any compatibility issue surfaces early.
- Verify that `react-native-svg` does not trigger a new Android/iOS native build step in Expo Go (it is already a transitive dep of Expo).
- Document in `CLAUDE.md` §17 (operational runbooks) or the `research.md` for the next feature if the team decides to switch libraries.

## 2. Schema Gap — `notes` Field for FR-037

### Finding

The `lessons_data` table (see `src/db/schema.ts`) has no `notes` column. The spec's FR-037 (Professor Influence, P3) assumes a `notes` field exists and uses it for special-event detection (keywords like `cerimônia`, `posse`, `batismo`).

### Impact

- **P1 (MVP)**: zero impact. FR-030 and FR-031 do not touch `notes`.
- **P2**: zero impact. FR-032/033/034 do not touch `notes`.
- **P3 (FR-037)**: this chart cannot be implemented as specified until either (a) a `notes` column is added via a future schema migration, or (b) the detection mechanism is changed (e.g., a dedicated `is_special_event` boolean, or manual tagging via lesson_topic).

### Decision

**Defer FR-037 schema decision past MVP.** The spec already marks FR-037 as P3 and out of MVP. This plan formalizes that deferral: the dashboardService in this branch will NOT expose a `getProfessorInfluence` function, and the dashboard screen will NOT render that card. When the team decides to ship FR-037, a new spec (or an amendment to this one) will define the schema change and the migration.

### Alternatives Considered

- **Add `notes` column now, defensively** — rejected. Violates "don't design for hypothetical future requirements" (CLAUDE.md §Clean Code). The column would sit empty and unused until FR-037 is picked up.
- **Change FR-037 to detect special events via `lesson_topic_id` matching a "special events" topic** — rejected. Muddles the topic taxonomy. The original spec intent (free-text marker on each lesson) is clearer and worth preserving for the future.

## 3. Theme Token Additions

### Decision

Add the following semantic chart tokens to `ColorTokens` in `src/theme/colors.ts`, with light- and dark-theme variants:

| Token | Light | Dark | Used by |
|---|---|---|---|
| `chartPrimary` | theme primary | theme primary | Default bar / line color |
| `chartWarning` | strong red-orange | slightly muted red-orange | Late-arrival bars above 60% threshold |
| `chartNeutral` | light gray | dark gray | Empty / below-threshold bars |
| `chartMuted` | medium gray | medium gray | Low-sample markers (future FR-037) |
| `chartAxis` | secondary text color | secondary text color | Axis labels and ticks |
| `chartGrid` | divider color with 30% alpha | divider color with 30% alpha | Background gridlines |
| `chartReferenceLine` | danger with 70% alpha | danger with 70% alpha | 50% reference line on FR-030, 5-min on FR-033 |
| `chartTooltipBackground` | surface elevated | surface elevated | FR-015 tooltip popover |
| `chartTooltipBorder` | border color | border color | FR-015 tooltip outline |

All tokens derive from existing semantic colors (primary, surface, danger, divider, text) via `hexToRgba()` where alpha is needed. No raw hex values are introduced.

### Rationale

- Matches the existing pattern in `colors.ts` (semantic names, light/dark pairs).
- Avoids coupling the dashboard to specific hue choices — swapping the theme palette later automatically restyles the charts.
- SC-004 (theme consistency) is enforced by grep: any chart file that imports from `src/theme/colors.ts` and uses `theme.colors.chart*` passes the check.

## 4. Status Filter Implementation

### Decision

All SQL queries in `dashboardService` use the literal:

```sql
WHERE status IN ('COMPLETED', 'EXPORTED', 'SYNCED')
```

rather than `WHERE status <> 'IN_PROGRESS'`. Rationale: explicit allow-list is safer against future status additions (e.g., an `ARCHIVED` status should not silently start contributing to the dashboard).

### Alternatives Considered

- **Negative filter (`status <> 'IN_PROGRESS'`)** — rejected for the forward-compatibility reason above.
- **No filter, trust the caller** — rejected. Violates Separation of Concerns (CLAUDE.md §5): "Validate business rules in the service".

## 5. Per-Chart Limit Implementation

### Decision

Limits from the clarifications (12 for FR-030/031/033/034, 26 for FR-032) are applied in SQL with `ORDER BY date DESC LIMIT N`, then reversed in JavaScript so the chart renders chronologically (oldest → newest, left → right). Implementing the limit in SQL is 10x+ faster than fetching everything and slicing in memory once the dataset grows beyond ~100 lessons.

### Rationale

- Clamping at the data layer means the screen component never sees data it won't render — cleaner separation.
- The constant is exported from `dashboardService` so tests can assert the limit without duplicating magic numbers.

## 6. Accessibility Deferral

### Finding

The spec's `/speckit.clarify` pass intentionally deferred accessibility to planning. With `react-native-gifted-charts` selected, the capabilities are:

- Chart bars accept `accessibilityLabel` via wrapper views, not natively.
- No built-in screen-reader announcement of chart data.

### Decision

**MVP scope for accessibility**:

1. Every `ChartCard` has an `accessibilityRole="summary"` and an `accessibilityLabel` summarizing the chart in one sentence (e.g., "Índice de Chegada Tardia das últimas 12 aulas, média 62%").
2. The tooltip popover (`ChartTooltip`) is `accessibilityRole="alert"` so VoiceOver/TalkBack announces its content when it appears.
3. Individual bars/points are NOT individually announced in MVP — a full accessibility pass (one `accessibilityLabel` per data point) is a follow-up.

This is the minimum that prevents the dashboard from being a black hole for screen-reader users while not blocking MVP delivery.

## 7. Open Questions

None. All `[NEEDS CLARIFICATION]` markers were resolved during `/speckit.clarify`.
