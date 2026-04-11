# Feature Specification: Statistics Dashboard

**Feature Branch**: `009-statistics-dashboard`
**Created**: 2026-04-11
**Status**: Draft
**Input**: Roadmap addition — "Dashboard com dados estatísticos coletados até o momento, serve como estímulo para quem coleta o dado possa ver sentido no que está fazendo. Exemplo: índice de chegada tardia."

## Context

The collectors are putting real effort into counting people, timing classes, and recording who interacts. Today that data leaves the app as a JSON file and disappears into a spreadsheet that only the coordinator looks at. This is demotivating — the collector never sees the fruit of their work. This spec adds an in-app **Statistics Dashboard** that turns the collected data into simple, meaningful charts visible to every user. The goal is purely motivational: "look what you're measuring — it matters".

The dashboard must **ship independently** of specs 007/008. It should work from day one on **local SQLite data only**. Later, when the backend is live, it can optionally show aggregated data across all collectors — but that's a P3 enhancement, not a blocker.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Late Arrival Index (Priority: P1)

As a Collector, I want to see a bar chart of "% of the final audience that arrived late" per Saturday, so that I can see a concrete problem the data is revealing and feel that my counting work is producing insights.

**Why this priority**: This was the user's explicit example. It's the chart that best communicates "your data tells a story". Formula: `(attendance_end - attendance_start) / attendance_end × 100`.

**Independent Test**: Open the dashboard screen with at least 2 completed lessons in local SQLite. Verify a bar chart shows one bar per lesson labeled with the % late value. A horizontal reference line at 50% marks "half the class arrived late".

**Acceptance Scenarios**:

1. **Given** I have 4 completed lessons in local SQLite with attendance `(start, end)`: `(7, 25), (10, 28), (16, 26), (4, 24)`, **When** I open the dashboard, **Then** I see a bar chart with bars at 72%, 64.3%, 38.5%, 83.3% respectively, sorted by date.
2. **Given** the bar is above 50%, **Then** it is colored in the "warning" palette (darker red). Below 50%, lighter.
3. **Given** there is a horizontal dashed line at y=50, **Then** it is labeled "50% de atraso".
4. **Given** fewer than 2 lessons exist, **Then** the chart shows an empty state "Coleta pelo menos 2 aulas para ver seu primeiro gráfico".
5. **Given** I tap a bar, **Then** a tooltip or modal shows the absolute numbers (`Início: 7, Fim: 25, Atrasaram: 18`).

---

### User Story 2 - Attendance Curve per Lesson (Priority: P1)

As a Collector, I want to see how attendance grew during each class (start → mid → end), so I can visualize whether people arrive late, stay, or leave.

**Why this priority**: Complements the late-arrival chart. Shows the full curve, not just the start/end delta. Especially interesting for lessons where people LEAVE early.

**Independent Test**: For one recent lesson, see a mini line chart with 3 points (start, mid, end) showing the attendance flow.

**Acceptance Scenarios**:

1. **Given** the most recent lesson has `(start, mid, end) = (16, 25, 31)`, **When** I view the dashboard, **Then** I see a line chart with three labeled points forming an ascending curve.
2. **Given** a lesson shows `(20, 31, 28)` (decline from mid to end), **Then** the line visibly descends in the final segment.
3. **Given** I scroll horizontally or swipe, **Then** I can browse the curve of different lessons.

---

### User Story 3 - Attendance Trend Over Time (Priority: P2)

As a Collector, I want a line chart of `attendance_end` across all Saturdays, so I can see if the class is growing, stable, or shrinking over time.

**Why this priority**: The "is the church growing?" question. Secondary to individual-lesson insights but extremely motivating when trending upward.

**Independent Test**: With 4+ completed lessons, verify a line chart shows `attendance_end` on Y axis, date on X axis, one point per lesson, connected.

**Acceptance Scenarios**:

1. **Given** 4 lessons with final attendances `[25, 28, 26, 27]` on dates `[24/01, 31/01, 07/02, 14/02]`, **Then** the line chart shows these 4 points in order.
2. **Given** a simple linear regression would show a positive slope, **Then** a subtle trend indicator (arrow or label) shows "+X%" growth month-over-month. If there's not enough data, no trend label.
3. **Given** I tap a point, **Then** a tooltip shows the exact value and date.

---

### User Story 4 - Punctuality of Class Start (Priority: P2)

As a Coordinator, I want to see how many minutes the class actually started after the planned 10:00, so I can flag punctuality as a discussion topic if needed.

**Why this priority**: Punctuality is a discipline metric. Valuable to coordinators but less to collectors — hence P2.

**Independent Test**: With lessons having `time_real_start` values `["10:07", "10:00", "10:02", "10:10"]`, verify a bar chart shows `[7, 0, 2, 10]` minutes.

**Acceptance Scenarios**:

1. **Given** lessons have `time_real_start` values, **Then** the chart shows minutes-late (positive = late, 0 = on time) per lesson.
2. **Given** a reference line at 5 minutes ("margem aceitável"), **Then** bars above the line are visually emphasized.
3. **Given** a lesson has no `time_real_start` (captured after this feature), **Then** it is excluded from the chart with a footnote.

---

### User Story 5 - Engagement Rate (Priority: P2)

As a Collector, I want to see the percentage of the final audience that interacted (asked questions, participated), so I can feel proud when interaction is high.

**Why this priority**: Another motivational metric. Formula: `unique_participants / attendance_end × 100`.

**Independent Test**: With a lesson `(unique_participants = 5, attendance_end = 25)`, verify the chart shows 20%.

**Acceptance Scenarios**:

1. **Given** the metric, **Then** it is shown as a bar chart over time or as a single "big number" summary on the dashboard header.
2. **Given** a lesson has `unique_participants = 0`, **Then** the bar shows 0% (not missing).

---

### User Story 6 - Lesson Coverage Calendar (Priority: P3)

As a Coordinator, I want to see which Saturdays have collection and which are missing, as a small calendar heatmap.

**Why this priority**: Operational. Useful to identify gaps but not motivational.

**Acceptance Scenarios**:

1. **Given** the last 12 Saturdays, **Then** a horizontal row of squares shows green (has data) or gray (no data).

---

### User Story 7 - Ranking by Topic/Professor (Priority: P3)

As a Coordinator, I want to see which topics or professors drew the largest audience, to identify what resonates.

**Why this priority**: Analytical, not motivational for collectors. Ships after everything else.

**Acceptance Scenarios**:

1. **Given** lessons grouped by `lesson_topic_id`, **Then** a horizontal bar chart shows median `attendance_end` per topic.
2. **Given** lessons grouped by `professor_id`, **Then** a similar chart shows median attendance per professor.

---

### User Story 8 - Professor Influence on Attendance (Priority: P3)

As a Coordinator, I want to see whether specific professors correlate with higher or lower attendance than the overall average, so that I can understand which voices draw the class and which don't — while being clearly warned when the sample is too small to trust.

**Why this priority**: Analytical question the stakeholder explicitly asked ("o professor tem alguma influência no aumento ou diminuição da participação na classe bíblica?"). Requires enough data to be meaningful (at least 3 lessons per professor); with less, the chart shows a warning instead of misleading bars. Targets coordinators, not collectors.

**Independent Test**: With a dataset where professor A taught 5 lessons averaging 30 people and professor B taught 5 averaging 20, verify the delta chart shows A at `+5` and B at `-5` relative to the overall mean of 25.

**Acceptance Scenarios**:

1. **Given** lessons exist and are grouped by `professor_id`, **When** I open the "Influência do Professor" card, **Then** I see a horizontal bar chart where each bar is a professor and the bar value is `avg(attendance_end for lessons by this professor) − avg(attendance_end for all lessons)`. The X axis is signed (positive to the right, negative to the left, zero in the middle).
2. **Given** a professor has `n ≥ 3` lessons, **Then** their bar is rendered in a solid color (green if positive, red if negative) and their name is shown normally.
3. **Given** a professor has `n < 3` lessons, **Then** their bar is rendered in a muted/striped pattern AND labeled "amostra pequena (n=X)". This prevents over-interpretation. Low-sample professors are still shown but visually de-emphasized.
4. **Given** fewer than 2 professors have `n ≥ 3`, **Then** the chart shows a banner "Dados insuficientes para comparar professores — colete mais algumas aulas" instead of bars.
5. **Given** I tap a bar, **Then** a tooltip shows: total lessons taught, average `attendance_end`, delta from baseline, list of included lesson dates.
6. **Given** the `Obs` (or `notes`) field of a lesson contains any of the keywords `cerimônia`, `posse`, `batismo`, `especial`, `feriado`, **Then** the lesson is flagged as "evento especial". A toggle at the top of the chart lets the user include or exclude these lessons from the calculation. Default: excluded, with a footnote "X eventos especiais excluídos do cálculo".
7. **Given** the engagement angle is also relevant, **Then** a secondary toggle shows `avg(unique_participants / attendance_end)` per professor — who inspires more interaction, independent of raw headcount.

---

### Edge Cases

- **EC-001 (Empty State)**: With 0 or 1 completed lessons, the dashboard shows a friendly empty state with tips: "Coleta pelo menos 2 aulas para ver seu primeiro gráfico".
- **EC-002 (Missing Fields)**: Lessons with missing `time_real_start`, `time_real_end`, or `unique_participants` are excluded from the charts that need those fields. A footnote explains the exclusion.
- **EC-003 (Outliers)**: A lesson with unusually high/low numbers (e.g., a special event with 100 people) is still shown but the chart's y-axis auto-scales. No automatic outlier removal — the data tells its own story.
- **EC-004 (Local-Only vs Server Data)**: In the pre-backend state, the dashboard shows data from local SQLite only. After backend ships, it CAN optionally pull aggregated data from `GET /instances` — but only if the user is logged in AND is a coordinator. For collectors, even after backend, the dashboard stays local.
- **EC-005 (Data from Multiple Users on Same Device)**: If the device has lessons from several users (per spec 006), the dashboard filters by the currently-logged-in user (if logged in) or shows all (if anonymous). Same filter as the Home list.
- **EC-006 (Date Format)**: Dates on the X axis are in the format `DD/MM` (compact) to save screen space on mobile. Full date appears on tooltip tap.

## Requirements *(mandatory)*

### Functional Requirements

#### Navigation & Layout

- **FR-001**: A new screen `app/dashboard.tsx` MUST exist, reachable via a new tab in the bottom navigator OR a button on the Home screen. The exact entry point will be decided during implementation; both are valid.
- **FR-002**: The dashboard MUST be accessible to ALL users (logged in or not) — it's a motivational feature, not gated by auth.
- **FR-003**: The dashboard MUST work 100% offline using local SQLite data.
- **FR-004**: The screen MUST be scrollable, with each chart in its own card. Cards are stacked vertically for mobile ergonomics.
- **FR-005**: Each card MUST have a title, a brief explanatory subtitle, and the chart. Example: "Índice de Chegada Tardia — % de pessoas que chegaram depois do início".

#### Chart Library

- **FR-010**: Use `victory-native` as the chart library. Rationale: mature, well-documented, works with Reanimated 3, SVG-based (theme-friendly), actively maintained.
- **FR-011**: All charts MUST respect the existing theme (`useTheme()`) — colors, spacing, typography from `@/theme`.
- **FR-012**: All chart colors MUST be added as semantic tokens to `ColorTokens` in `src/theme/colors.ts` (e.g., `chartPrimary`, `chartWarning`, `chartNeutral`, `chartAxis`, `chartGrid`, `chartReferenceLine`).
- **FR-013**: All charts MUST be responsive — width adapts to screen width minus padding, height fixed per card.

#### Data & Service

- **FR-020**: A new service `src/services/dashboardService.ts` (object literal pattern per CLAUDE.md section 5) MUST expose pure async functions to compute each chart's dataset from local SQLite:
  - `async getLateArrivalIndex(filters?: DashboardFilters): Promise<LateArrivalDatum[]>`
  - `async getAttendanceCurves(filters?): Promise<AttendanceCurveDatum[]>`
  - `async getAttendanceTrend(filters?): Promise<TrendDatum[]>`
  - `async getPunctuality(filters?): Promise<PunctualityDatum[]>`
  - `async getEngagementRate(filters?): Promise<EngagementDatum[]>`
  - (more as features ship)
- **FR-021**: `DashboardFilters` is an optional object for future extensibility. MVP supports at minimum `{ from?: Date, to?: Date, currentUserId?: string }`.
- **FR-022**: All queries MUST exclude lessons where `status = 'IN_PROGRESS'` — only completed/exported/synced count.
- **FR-023**: When the logged-in user's `collector_user_id` is known (from spec 006), the queries filter by it. Otherwise show all local data.

#### Charts Specifications

- **FR-030** (Late Arrival Index — P1):
  - Type: vertical bar chart
  - X axis: lesson dates (DD/MM format)
  - Y axis: percentage (0–100)
  - Bars colored with 3 shades based on value thresholds: `<40%` = light, `40–60%` = medium, `>60%` = dark (warning)
  - Horizontal dashed reference line at 50%, labeled "50% de atraso"
  - Value label above each bar (e.g., "72.0%")
  - Formula: `((end - start) / end) * 100`

- **FR-031** (Attendance Curve — P1):
  - Type: horizontal scrollable row of small line charts, one per lesson
  - Each mini-chart shows 3 points: `[Início, Meio, Fim]`
  - X axis: categorical (Início, Meio, Fim) — not time
  - Y axis: attendance count
  - Below each mini-chart, the lesson date and topic title
  - Tap opens full-size detail view

- **FR-032** (Attendance Trend — P2):
  - Type: line chart
  - X axis: dates
  - Y axis: `attendance_end`
  - Optional trend indicator: simple linear slope sign (`+` or `-`) with % change over the period

- **FR-033** (Punctuality — P2):
  - Type: vertical bar chart
  - X axis: dates
  - Y axis: minutes late (positive = late, 0 = on time, negative shown as "earlier")
  - Reference line at 5 minutes
  - Formula: `(time_real_start as minutes) - (time_expected_start as minutes)`

- **FR-034** (Engagement Rate — P2):
  - Type: vertical bar chart OR single "big number" summary
  - Y axis: percentage (0–100)
  - Formula: `unique_participants / attendance_end * 100`

- **FR-035** (Coverage Calendar — P3):
  - Type: horizontal row of square cells (12–16 cells for last 3–4 months)
  - Color: green if lesson exists for that Saturday, gray if missing
  - Tap cell: jump to lesson detail or show "No data for this Saturday"

- **FR-036** (Topic/Professor Ranking — P3):
  - Type: horizontal bar chart
  - Toggle between "by topic" and "by professor"
  - X axis: median `attendance_end`
  - Y axis: topic or professor name
  - Top 10 only

- **FR-037** (Professor Influence on Attendance — P3):
  - Type: horizontal bar chart, zero-centered (diverging)
  - Y axis: professor name (sorted by absolute delta descending)
  - X axis: `avg(attendance_end for prof) − avg(attendance_end overall)`
  - Bar color: green for positive delta, red for negative, muted/striped for `n < 3` lessons
  - Annotation on each bar: `Δ +3.2 (n=5)` format
  - Header toggles: (a) "Incluir eventos especiais" (default off), (b) "Mostrar engajamento ao invés de presença" (default off — toggles to `unique_participants / attendance_end` delta)
  - Banner when insufficient data: "Dados insuficientes — colete pelo menos 3 aulas por professor para análise confiável"
  - Service function: `async getProfessorInfluence(opts?: { includeSpecialEvents?: boolean, metric?: 'attendance' | 'engagement' }): Promise<ProfessorInfluenceDatum[]>`
  - Special-event detection: case-insensitive regex match on `notes` field against `\b(cerim[ôo]nia|posse|batismo|especial|feriado)\b`
  - Correlation is NOT causation: the spec explicitly documents this in a small info icon next to the chart title. Tapping the icon opens a brief explainer modal.

### Key Entities *(include if feature involves data)*

Pure in-memory types, no new DB tables:

- **LateArrivalDatum**: `{ date: string, percent: number, attendanceStart: number, attendanceEnd: number, lessonId: string }`
- **AttendanceCurveDatum**: `{ date: string, lessonId: string, topicTitle: string, start: number, mid: number, end: number }`
- **TrendDatum**: `{ date: string, attendanceEnd: number, lessonId: string }`
- **PunctualityDatum**: `{ date: string, minutesLate: number, lessonId: string }`
- **EngagementDatum**: `{ date: string, rate: number, uniqueParticipants: number, attendanceEnd: number }`
- **ProfessorInfluenceDatum**: `{ professorId: string, professorName: string, lessonCount: number, avgAttendance: number, deltaFromBaseline: number, isLowSample: boolean, lessonDates: string[] }`
- **DashboardFilters**: `{ from?: Date, to?: Date, currentUserId?: string }`

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **First Chart Visible in < 1 Second**: Opening the dashboard with 10 local lessons renders the late-arrival chart in under 1 second on a mid-range device.
- **SC-002**: **Zero Crashes on Empty Data**: With 0 lessons, the dashboard shows empty states and does not crash or throw.
- **SC-003**: **Motivational Intent**: Verified qualitatively — at least 3 collectors (users) report that seeing a chart of their work made them feel more engaged in measuring accurately. Not a hard test, but a go/no-go for the feature review.
- **SC-004**: **Theme Consistency**: All chart colors are theme tokens. Zero hardcoded hex values in the dashboard screen or service. Verified by grep.
- **SC-005**: **Local-First**: The dashboard works offline, with or without login, without errors. Verified by enabling airplane mode and opening the screen.
- **SC-006**: **Incremental Rollout**: Ships P1 (late arrival + curve) standalone without requiring P2 or P3 charts. Each chart is independently implementable and testable.

## Assumptions

- `victory-native` is compatible with the current Expo SDK 54 + React Native 0.81 + Reanimated 4.1 setup. If it is not (breaking change), spec falls back to `react-native-gifted-charts` or `react-native-svg` with manual drawing. Verified during plan phase.
- The dashboard does NOT require the backend (007/008) to ship. It is a pure local feature of the client. Backend-powered aggregate views are a future extension (marked as such in FR-ED-004).
- The existing lesson schema already carries all the data needed for P1 and P2 charts. No migration is required.
- Users understand percentage math. Tooltips show absolute numbers for those who prefer raw counts.
- Motivation is best achieved by keeping the dashboard simple and fast to load. Avoid info overload — show 3–5 charts max on MVP, not 20.

## Out of Scope for MVP

- Server-side aggregation (pulling `GET /instances` from backend). Future enhancement.
- Exporting charts as images. Future enhancement.
- Comparing "my lessons" vs "all lessons" views. Future enhancement.
- Time-range filters (last month, last 3 months, all time) — MVP shows "all time" only. Time filters are a P3 enhancement.
- Drill-down interaction beyond simple tooltip tap. Future enhancement.
- Dashboard customization (pick which charts to show, reorder, hide). Future enhancement.

## Chart Suggestions Based on Sheet Data (reference for implementation)

The following charts were considered given the fields available in the current Google Sheet data (`Série, Tema, Professor, Data, Hora Início, Pessoas início/meio/fim, Participantes distintos, Hora Fim, Clima, Obs`). MVP ships the top 5.

| # | Chart | Formula / Source | Priority |
|---|---|---|---|
| 1 | **Índice de Chegada Tardia** | `(end - start) / end × 100` | P1 ⭐ |
| 2 | **Curva de Presença por Aula** | `(start, mid, end)` per lesson | P1 |
| 3 | **Tendência de Presença Final** | `attendance_end` over time | P2 |
| 4 | **Pontualidade do Início** | `real_start - expected_start` in minutes | P2 |
| 5 | **Taxa de Engajamento** | `unique_participants / attendance_end × 100` | P2 |
| 6 | **Calendário de Cobertura** | Green/gray squares per Saturday | P3 |
| 7 | **Ranking por Tema** | Median `attendance_end` by topic | P3 |
| 8 | **Ranking por Professor** | Median `attendance_end` by professor | P3 |
| 9 | **Influência do Professor** ⭐ | `avg(end per professor) - avg(end overall)`, com flag de amostra pequena | P3 |
| 10 | **Duração Real vs Esperada** | `real_end - real_start` vs 60 min | P3 |
| 11 | **Impacto do Clima** | Boxplot of attendance by weather category | Post-MVP |

### Nota sobre "Influência do Professor" (chart #9)

Essa análise responde à pergunta "o professor tem alguma influência no aumento ou diminuição da participação?". A fórmula é um delta simples da média, não um teste estatístico formal — com os volumes típicos de uma classe bíblica (uma aula por semana, ~10 professores rodando em meses), testes de hipótese formais teriam baixo poder estatístico por muito tempo.

**Limitações honestas que o chart DEVE comunicar visualmente:**

1. **Correlação, não causação**: presença pode subir por mil motivos não relacionados ao professor (clima, feriado, evento paralelo). O chart não isola a variável "professor".
2. **Amostra pequena**: com menos de 3 aulas por professor, o delta é ruído. O chart marca visualmente essas entradas e desencoraja leitura.
3. **Eventos especiais**: aulas com cerimônias, posses ou celebrações distorcem a média. O chart oferece um toggle para excluí-las.
4. **Novos professores**: um professor novo sempre começa com n=1 ou n=2; não é "ruim" — só é "ainda sem dados".

Como referência, uma análise preliminar feita sobre os 12 sábados coletados até 11/04/2026 mostrou que **apenas Alex Tolomei tem n ≥ 3 aulas** (n=5, delta de −0,75). Os demais professores (Augusto César n=3 com delta −1,08; Abimael, Jorge, Paulo, Jefferson todos com n=1) não oferecem amostra suficiente para conclusões. O chart é valioso para **o futuro**, quando o volume acumular — talvez em 3–6 meses de coleta consistente.

## Related Specs

- **001-lesson-collection** — source of the data fields used by all charts.
- **003-migrate-schema-structure** — added `lesson_topics` and `lesson_series`, which enable rankings in charts 7 and 8.
- **006-auth-identity** — provides `collector_user_id` for filtering "my own stats" vs "all stats".
- **007-sync-backend** — future enhancement: pulls aggregated cross-collector data into the dashboard for coordinators.
