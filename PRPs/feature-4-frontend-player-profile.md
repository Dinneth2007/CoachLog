# PRP — Feature 4 Frontend: Player Profile & Analytics Dashboard

> Source: `INITIAL.md`. Global rules: `CLAUDE.md`. Predecessor state — Features 0–3 frontend complete (auth, players list with chip palette in `api/players.ts`, sessions list/wizard/detail, `ScoreDisplay` reusable component, TanStack Query patterns with `keepPreviousData`/`useInfiniteQuery` patterns established). Feature 4 backend live — `GET /api/players/{id}/progress` (all sessions, ASC by date, raw scores) and `GET /api/players/{id}/observations` (paginated, DESC by date, scores+notes) verified. Recharts ^3.8 already in `package.json`.

---

## 1. Summary

Build the player profile page at `/players/:id` — the analytical heart of the coaching app. A single scrollable page with a header (name, age, notes, quick stats with directional trend arrow) and six analytics cards: four charts (per-category dimension trend lines in a 2×2 grid, latest-vs-historical radar, category-averages-over-time area chart, dimension×session heatmap), one computed summary block (top 3 strengths and weaknesses), and a paginated observation history accordion that reuses the existing `ScoreDisplay`. All analytics are computed client-side from the progress endpoint via pure functions in a new `scoreAnalytics.ts` utility. Player cards on the existing PlayersPage are rewired to navigate here on click; the edit affordance moves to an explicit icon. No new dependencies — Recharts handles every chart (line, radar, area), and the heatmap is a custom Tailwind grid for design control and zero deps. Empty/sparse data is handled: 0 sessions shows an empty state; 1 session hides trend-dependent panels; categories with no scored dimensions are hidden entirely.

---

## 2. Architecture decisions

| # | Decision | Choice | Why | Alternatives rejected |
|---|---|---|---|---|
| 1 | Charting library | **Recharts only**, plus a custom Tailwind-grid heatmap | Recharts is already installed, ships TypeScript types, and supports every chart we need including a Radar with two overlapping polygons (current + historical) via two `<Radar>` elements. One mental model, no new dep, smaller bundle. The heatmap is a 17×N grid of `<div>`s with computed bg colour — clean, lightweight, full design control. | `@nivo/radar` + `@nivo/heatmap` — adds 2 new packages (each ~40 kB), peer-dep ceremony, and a second chart paradigm to learn. INITIAL.md grants permission ("install any free library") but doesn't require it; principle of least dependency wins. Chart.js — duplicates Recharts capability. |
| 2 | Where computation lives | `src/utils/scoreAnalytics.ts` — pure, side-effect-free functions taking the raw `progress.trends` array. Chart components are presentational, receiving pre-shaped data via props. | INITIAL.md: "all computation happens in the page or a utility function, not inside chart components." Centralising makes it unit-testable later and reusable on the parent view (Feature 7). Memoise call sites with `useMemo` keyed on `trends`. | Inline computation per component — duplicates work and couples display to data shape. Computation inside React Query's `select` — works for one consumer but breaks reuse. |
| 3 | Data fetching | Two parallel `useQuery` calls: `['player', id]` for header notes (existing `getPlayer`) and `['playerProgress', id]` for analytics. Observation history uses `useInfiniteQuery` keyed `['playerObservations', id]` for "Load more". | The progress endpoint returns name/ageGroup but not notes, so we need both. Parallel queries are non-blocking. `useInfiniteQuery` is the idiomatic TanStack pattern for "load more" pagination over Spring Page shape. | A single combined endpoint — would need a backend change, out of scope. Manual page-state + concat — reinvents `useInfiniteQuery`. |
| 4 | Routing | Add `/players/:id` route inside the existing `<ProtectedRoute>` / `<AppLayout>` block, after `/players`. | Mirrors the `/sessions/:id` route added in Feature 3. Stays within the sidebar layout per "keep styling consistent." | A dedicated full-screen layout — breaks nav consistency. Modal-on-list — would never be a "premium analytics" feel. |
| 5 | PlayersPage card behaviour change | Card outer click navigates to `/players/:id`. Edit moves to an explicit pencil-icon button next to the existing delete icon (both hover-revealed). Both icon buttons stop click propagation. | INITIAL.md: "Player cards/rows in PlayersPage link to this page." The current `onClick={onEdit}` mapping has to move. A pencil icon is the universal edit affordance; pairing it with the existing delete icon keeps the card uncluttered. | Make the player name a `<Link>` and keep card-click for edit — confusing dual-target. Right-click context menu — not discoverable. |
| 6 | Computation: trend direction | `computeTrendDirection(scores: number[])` takes a chronological list of numbers and compares the mean of the last `Math.min(3, half)` entries against the mean of the previous block. Returns `'improving'` if delta ≥ +0.25, `'declining'` if delta ≤ −0.25, `'stable'` otherwise. Returns `'stable'` for fewer than 4 data points (so the badge appears but doesn't make a confident claim). | INITIAL.md: "compare last 3 sessions average vs previous 3". The 0.25 threshold filters out noise on a 1–5 scale. Fewer-than-4 fallback keeps the UI consistent without misleading early in a player's history. | Strict 3-vs-3 with hard "N/A" below 6 sessions — UI churn between states. Linear regression slope — overkill at this data volume. |
| 7 | Computation: strengths / weaknesses | `computeStrengthsWeaknesses(trends, lastN=3)` averages each dimension across the last N sessions (only sessions where that dimension was actually scored), drops dimensions never scored in those N sessions, sorts ASC, returns `{ strengths: top 3, weaknesses: bottom 3, trend: TrendDirection }` where `trend` per dimension uses `computeTrendDirection` over that dimension's full chronological series. | Matches INITIAL.md ("Compute from latest 3 sessions"). Skipping unscored dimensions avoids treating "not observed" as zero. | Average across ALL sessions — defeats "latest 3" semantics. Treating missing as 0 — punishes infrequently-scored dimensions. |
| 8 | Computation: category averages per session | `computeCategoryAverages(trends)` returns `{ date, sessionId, sessionTitle, BATTING?: number, BOWLING?: number, FIELDING?: number, MATCH_AWARENESS?: number }[]` where each value is the mean of that category's scored dimensions in that session (omitted entirely if zero scored). | Lets the area chart's `<Area>` skip categories with no data per session (Recharts handles undefined gracefully). | Fill with zero — visually misleading. Fill with last-known value — implies an observation that didn't happen. |
| 9 | Computation: pivot for line charts | `pivotByCategoryAndDimension(trends)` returns `Record<Category, { date, sessionId, sessionTitle, [dim]: number \| undefined }[]>`. Each per-category array has one row per session (chronological), with each dimension key set to its score for that session or undefined. | Line charts with `connectNulls` need exactly this shape: rows = X-axis positions, keys = series. Recharts auto-skips undefined points. | One big flat dataset and filter inside the chart — Recharts API expects array-per-chart. |
| 10 | Heatmap data | `buildHeatmap(trends)` returns `{ sessions: { id, date, title, formattedDate }[], scoredDimensions: Dimension[], cells: Map<Dimension, Map<number, number>> }` where the outer map keys by dimension, inner by sessionId. `scoredDimensions` is dimensions that have ≥1 score across all sessions (so we don't render empty rows). | A double `Map` lookup is O(1) when rendering each cell. Pre-filtering empty rows keeps the grid compact. | A nested array — index gymnastics, harder to read. |
| 11 | Heatmap colour ramp | Five Tailwind utility classes for scores 1–5: `bg-emerald-100` / `bg-emerald-200` / `bg-emerald-400` / `bg-emerald-600` / `bg-emerald-800`, with text colour flipping to white at score 4+. Unscored cells: `bg-slate-50` with a tiny "—" centred. | A single-hue intensity ramp reads as analytical (warmer ≠ better here; higher score = darker). Avoids the green/red moralising of a diverging palette inside a heatmap (we use green/red elsewhere for actual deltas). | Diverging red→green ramp — conflates "low score" with "bad" and clashes with the trend arrows. Sequential viridis-like multi-hue — overkill for 5 steps. |
| 12 | Line-chart palette per category | Each dimension in a category gets a fixed Tailwind colour: slate-700, sky-600, emerald-600, amber-600, rose-600 (in that order, dropping the tail if a category has <5 dimensions). Same palette across all four charts; the chart title disambiguates. | Five visually-distinct hues with similar saturation read well together. Using the same palette per chart keeps the eye trained — coach learns "the blue line is footwork" because footwork is always second in the canonical batting order. (Actually each chart uses the palette by *position* within its category, not by global dimension — this is the simplest and visually cleanest rule.) | Per-dimension global colour map — 17 distinct readable colours is hard. |
| 13 | Category line chart hiding | A category's chart is rendered iff at least one session in `trends` has at least one scored dimension in that category. If zero, the whole chart panel is omitted from the 2×2 grid (and the grid collapses, so with only one category showing it sits centred in a single column). | INITIAL.md: "If a category has no data across any sessions, hide that chart entirely." | Always render with a "no data" placeholder — visual noise. |
| 14 | Radar chart fallbacks | Radar shows if ≥1 session exists. "Current form" = scores from the latest session, missing dimensions plotted as 0 to keep the polygon closed (but with a footnote noting missing dims). "Historical average" = mean per dimension across all sessions; missing dimensions skipped (not plotted as 0). Two `<Radar>` elements: solid `fill-emerald-500/40` with `stroke-emerald-600` for current, `fill-slate-400/15` with `stroke-slate-400 stroke-dasharray=4 2` for average. | Plotting missing-current as 0 makes the polygon legible without forcing the coach to mentally close it; the footnote ("Dimensions not scored in latest session: …") is honest. Average lower-opacity so the eye reads current as primary. | Skip missing in current — broken polygon, hard to read. Two charts side by side — duplicates space. |
| 15 | Empty / sparse handling | Single-pass tree at the page level: <ul><li>0 sessions → render only header + a big "No sessions yet" empty state with a `Link to="/sessions/new"`. Hide every analytics card.<li>1 session → hide DimensionTrendChart and CategoryAveragesChart (need ≥2 points). Show Radar (current only), Heatmap (single column), Strengths/Weaknesses (single-session avg), ObservationHistory.<li>≥2 sessions → everything renders by its own per-card hide rule.</ul>The header trend arrow uses `computeTrendDirection` and falls through to `'stable'` for <4 sessions. | Centralises sparse logic at one place. Each card's own "needs N points" check stays simple. | Per-card empty state inside each component — duplicates the count check. |
| 16 | Quick stats — sessions this month | Count `trends` whose `sessionDate` falls in the current calendar month (local time). Compare against `new Date()` at render. | Simple, no library. The `sessionDate` is ISO `yyyy-mm-dd` so `new Date(d).getMonth() === now.getMonth() && getFullYear() === now.getFullYear()` is exact. | Server-side aggregation — out of scope. |
| 17 | Quick stats — average overall score | Sum of all `score` values across all `trends[*].scores` divided by their count. Rounded to 1 decimal. | Matches "average overall score (across all dimensions)" in INITIAL.md. | Average of category averages — would double-weight categories with fewer dimensions. |
| 18 | Date formatting | One helper `formatDate(iso: string)` returns `dd MMM yyyy` via `toLocaleDateString` (already established in Feature 3 pages). Promote to `src/utils/format.ts` since now three pages use it (SessionDetailPage, SessionsPage, PlayerProfilePage). | DRY at the same threshold the chip palette met (≥3). | Inline at every call site — drift. |
| 19 | Header trend arrow visual | Inline arrow + word combo: `<span class="inline-flex items-center gap-1 text-sm font-medium text-emerald-700"><ArrowUp />improving</span>` (or `text-red-700`/`text-slate-500`). Arrows are inline SVG path. | Word + arrow is more accessible than arrow alone; colour reinforces meaning. | Pill chip — too heavy next to numerical stats. Arrow only — ambiguous semantics. |
| 20 | Observation history pagination | `useInfiniteQuery` with `getNextPageParam` reading the Spring Page shape (`last === false → next page = currentPage + 1`). "Load more" button at the bottom (not auto-load on scroll — predictable, low-bandwidth). Shows count "Showing N of M observations" above. | Button is calmer in a long page; the user explicitly asks for more. Auto-scroll-loading interferes with the eye reaching the page footer. | Auto-load on intersection — annoying when scrolling past to the bottom. |
| 21 | TanStack invalidation | After `deleteSession` (already wired in SessionDetailPage) and `submitObservations` (already wired in ObservationStep), the existing invalidations of `['sessions']` are sufficient. We additionally need to invalidate `['playerProgress', playerId]` and `['playerObservations', playerId]` for affected players on session delete or observation submit. **Scope decision:** since the user navigates *to* the profile, the queries refetch on mount and stale-time naturally; we will NOT proactively invalidate from session-side code. Stale-while-revalidate covers the realistic UX. | Avoids cross-feature coupling and the temptation to enumerate every affected player. The page re-fetches on entry; that's the moment the user wants fresh data. | Invalidate from session mutations — would require knowing which players are affected, and a stale chart for 30 seconds isn't a real bug. |
| 22 | Type strictness | Strict everywhere; no `any`. Recharts type imports come from `recharts` directly. Re-derive `Dimension` / `Category` from `api/sessions.ts` (do not duplicate). Score values from the API are `number` — keep them as `number` end-to-end. | Matches the Feature 3 frontend's discipline. | Loosen for Recharts payload types — Recharts ships types; use them. |
| 23 | Comments / Javadoc | None. | CLAUDE.md mandate. | — |

---

## 3. File-by-file implementation plan

Strict order: utility first (everything depends on it indirectly) → API layer → chart components (independent siblings, any order) → ObservationHistory → page → routing + PlayersPage rewire.

### Step 1 — Shared utilities

**`frontend/src/utils/format.ts`** (new)
- Exports `formatDate(iso: string): string` using `toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })`. Same implementation already present in `SessionDetailPage.tsx` and `SessionsPage.tsx`.
- After creation, update those two pages to import from here (mechanical replace, identical behaviour).

**`frontend/src/utils/scoreAnalytics.ts`** (new)

Pure functions only. Inputs are the `PlayerProgress` shape from `api/playerProgress.ts` (see Step 2). Each function is exported.

- `type TrendDirection = 'improving' | 'declining' | 'stable'`.
- `computeTrendDirection(values: number[]): TrendDirection` — per Architecture #6. Window = `Math.min(3, Math.floor(values.length / 2))`. If window < 2, return `'stable'`. Compare means; threshold ±0.25.
- `computeOverallAverage(trends): number` — sum-of-scores / count-of-scores. Returns 0 if no scores. Rounded externally where displayed.
- `countSessionsThisMonth(trends, now: Date = new Date()): number` — filter by calendar month/year on `sessionDate`.
- `pivotByCategoryAndDimension(trends): Record<Category, Array<{ sessionId, date, dateLabel, sessionTitle } & Partial<Record<Dimension, number>>>>` — for each session in chronological order, one row per Category with the dimension scores keyed by dimension name. `dateLabel` is the formatted date for the X-axis tick.
- `computeCategoryAverages(trends): Array<{ sessionId, date, dateLabel, sessionTitle } & Partial<Record<Category, number>>>` — chronological. Each category value is the mean of that category's *scored* dimensions in that session, or omitted if none.
- `computeLatestRadarData(trends): { latest: Array<{ dimension, label, score }>; average: Array<{ dimension, label, score }>; missingInLatest: Dimension[] }` — `latest` walks ALL_DIMENSIONS and sets score to the latest session's score or `0` (and tracks the dimension in `missingInLatest` for the footnote). `average` walks ALL_DIMENSIONS and includes only dimensions with ≥1 historical score (others omitted from the polygon).
- `buildHeatmap(trends): { sessions: Array<{ id, date, label, title }>; dimensions: Dimension[]; cell: (dim: Dimension, sessionId: number) => number | undefined }` — `dimensions` is the subset of `ALL_DIMENSIONS` that has ≥1 score anywhere. `cell` is a function backed by a `Map<Dimension, Map<number, number>>` precomputed inside `buildHeatmap`.
- `computeStrengthsWeaknesses(trends, lastN = 3): { strengths: Item[]; weaknesses: Item[] }` where `Item = { dimension, label, category, avgScore, trend: TrendDirection }`. Sort by avgScore descending for strengths (top 3) and ascending for weaknesses (bottom 3). Skip dimensions with 0 scores in the last N. Per-dimension trend uses the full chronological series.

Keep this file ≲180 lines.

### Step 2 — API layer

**`frontend/src/api/playerProgress.ts`** (new)

- Imports `Category`, `Dimension` from `./sessions` (do not re-declare).
- Types:
  - `interface TrendScore { category: Category; dimension: Dimension; score: number; }`
  - `interface SessionTrend { sessionId: number; sessionDate: string; sessionTitle: string; scores: TrendScore[]; }`
  - `interface PlayerProgress { playerId: number; playerName: string; ageGroup: import('./players').AgeGroup; trends: SessionTrend[]; }`
  - `interface HistoryScore { category: Category; dimension: Dimension; score: number; notes: string | null; }`
  - `interface ObservationHistoryItem { observationId: number; sessionId: number; sessionDate: string; sessionTitle: string; overallNotes: string | null; scores: HistoryScore[]; }`
  - `interface ObservationsResponse { content: ObservationHistoryItem[]; totalElements: number; totalPages: number; number: number; size: number; first: boolean; last: boolean; }`
- Functions:
  - `export async function getPlayerProgress(playerId: number): Promise<PlayerProgress>` → `GET /players/{id}/progress`.
  - `export async function getPlayerObservations(playerId: number, page: number, size = 10): Promise<ObservationsResponse>` → `GET /players/{id}/observations?page&size`.

### Step 3 — Chart components

All live in `frontend/src/components/analytics/`. Each is presentational, takes pre-shaped props, applies Tailwind for the surrounding card and Recharts JSX inside. Each component sits inside the page-level card wrapper (the *page* renders `<div class="bg-white border …">`; component renders just the chart and any inner labels — keeps card chrome consistent and overrideable).

**`frontend/src/components/analytics/DimensionTrendChart.tsx`** (new)
- Props: `{ category: Category; data: Array<{ dateLabel: string } & Partial<Record<Dimension, number>>>; dimensions: Dimension[] }`.
- Renders a Recharts `<LineChart>` (height 220) with `<XAxis dataKey="dateLabel">`, `<YAxis domain={[1, 5]} ticks={[1,2,3,4,5]}>`, `<Tooltip>`, `<Legend>`, `<CartesianGrid strokeDasharray="3 3" className="text-slate-200" />`, and one `<Line>` per dimension with `connectNulls`, `dot={true}`, `strokeWidth={2}`. Palette: positions 0–4 → slate-700/sky-600/emerald-600/amber-600/rose-600 hex equivalents.
- Renders nothing (returns `null`) if `dimensions.length === 0` or `data.length < 2`. Callers should also gate, but defence in depth.

**`frontend/src/components/analytics/PlayerRadarChart.tsx`** (new)
- Props: `{ latest: Array<{ label: string; score: number }>; average: Array<{ label: string; score: number }>; missingInLatest: string[] }` (labels pre-formatted with `DIMENSION_LABELS`).
- Renders a Recharts `<RadarChart>` (height 320) with `<PolarGrid>`, `<PolarAngleAxis dataKey="label">`, `<PolarRadiusAxis angle={90} domain={[0, 5]} tickCount={6}>`, and two `<Radar>`s: average first (lower z), latest second (higher z). Styling per Architecture #14.
- Below the chart, if `missingInLatest.length > 0`: small italic footnote "Not scored in latest session: footwork, timing" using `DIMENSION_LABELS`.

**`frontend/src/components/analytics/CategoryAveragesChart.tsx`** (new)
- Props: `{ data: Array<{ dateLabel: string } & Partial<Record<Category, number>>>; categoriesPresent: Category[] }`.
- Renders a Recharts `<AreaChart>` (height 240) with one `<Area>` per category in `categoriesPresent`, `type="monotone"`, `stackId` NOT set (we want overlapping not stacked — coach should see each category's level independently), `fillOpacity={0.15}`, `strokeWidth={2}`. Palette: BATTING=sky-600, BOWLING=emerald-600, FIELDING=amber-600, MATCH_AWARENESS=rose-600. Y domain [0, 5].
- `<Legend>` with `CATEGORY_LABELS` for readable names.

**`frontend/src/components/analytics/ScoreHeatmap.tsx`** (new)
- Props: `{ sessions: Array<{ id: number; label: string; title: string }>; dimensions: Dimension[]; cell: (dim: Dimension, sessionId: number) => number | undefined }`.
- Renders a CSS grid (`grid-template-columns: 11rem repeat(N, minmax(2.5rem, 1fr))`). First row: empty cell + session date labels (`-rotate-45` for readability if N > 8; else horizontal). Each subsequent row: dimension label in first column + score cells using the Architecture #11 colour ramp. Empty cells get `bg-slate-50` and "—".
- Hover state on each cell: tooltip via native `title` attribute showing `"<DIMENSION_LABEL> · <session.title> · <date>: 4/5"` or "not scored". Native `title` is simpler than custom popovers for a dense grid.

**`frontend/src/components/analytics/StrengthWeaknessCards.tsx`** (new)
- Props: `{ strengths: Item[]; weaknesses: Item[] }` where `Item = { label: string; category: Category; avgScore: number; trend: TrendDirection }`.
- Two columns on desktop, stacked on mobile. Each column has a small heading ("Strengths" / "Areas to focus on") and up to 3 mini-cards.
- Each card: dimension label + a score chip (`{score}/5` styled like ScoreDisplay's badge) + an arrow with colour matching trend (emerald/red/slate). Strengths card border: `border-emerald-200 bg-emerald-50/30`. Weaknesses card border: `border-rose-200 bg-rose-50/30`. If <3 items in either bucket, show fewer cards plus a muted "Need more sessions for a clearer picture" line.

**`frontend/src/components/analytics/ObservationHistory.tsx`** (new)
- Props: `{ playerId: number; pageSize?: number }` (default 10).
- Uses `useInfiniteQuery({ queryKey: ['playerObservations', playerId], initialPageParam: 0, queryFn: ({ pageParam }) => getPlayerObservations(playerId, pageParam as number, pageSize), getNextPageParam: (lastPage) => lastPage.last ? undefined : lastPage.number + 1 })`.
- Renders header: "Observation history" h2 + count ("Showing N of M") + nothing else.
- Body: each `ObservationHistoryItem` rendered as a collapsible card (expanded state per item in `Set<number>`, default collapsed). Header row: date (formatted), session title, chevron. Expanded body: `<ScoreDisplay scores={item.scores} overallNotes={item.overallNotes} />` — exact reuse.
- Footer: "Load more" button when `hasNextPage`; shows count loaded. Hidden when done.
- Loading state: skeleton rows. Error: red banner.

### Step 4 — Page

**`frontend/src/pages/PlayerProfilePage.tsx`** (new)
- `useParams<{ id: string }>()`, validate numeric (redirect to `/players` if not), `idNum = Number(params.id)`.
- Two parallel queries:
  - `playerQ = useQuery({ queryKey: ['player', idNum], queryFn: () => getPlayer(idNum), enabled: isValidId })`
  - `progressQ = useQuery({ queryKey: ['playerProgress', idNum], queryFn: () => getPlayerProgress(idNum), enabled: isValidId })`
- Loading state (either still loading): skeleton (mirror PlayersPage's skeleton style, sized for a profile page).
- Error state: 404 → "Player not found" with back link; otherwise generic error card.
- Once both loaded, compute analytics with `useMemo` keyed on `progressQ.data!.trends`:
  - `pivots = pivotByCategoryAndDimension(trends)`
  - `categoryAvgs = computeCategoryAverages(trends)`
  - `radarData = computeLatestRadarData(trends)`
  - `heatmap = buildHeatmap(trends)`
  - `sw = computeStrengthsWeaknesses(trends, 3)`
  - `headerTrend = computeTrendDirection(trends.map(t => meanOfSessionScores(t)).filter(Boolean))` — flatten per-session means for an overall trajectory.
  - `overallAvg = computeOverallAverage(trends)`
  - `sessionsThisMonth = countSessionsThisMonth(trends)`
- Layout (`max-w-7xl mx-auto`):
  - **Back link**: `← Players` at top.
  - **Header card** (`bg-white border rounded-2xl p-6`): name (text-3xl font-semibold), age-group chip (existing palette), notes paragraph (muted). Then a 4-column quick-stats row (or 2×2 on mobile): "Total sessions", "Sessions this month", "Avg score" (with trend arrow + word inline), "Latest session date".
  - **Empty branch**: if `trends.length === 0`, render only an empty card spanning the body — "No sessions recorded yet" + `<Link to="/sessions/new">Start a session</Link>`. Skip everything below.
  - **Sparse branch**: if `trends.length === 1`, skip DimensionTrendChart and CategoryAveragesChart panels. Show Radar, Heatmap, StrengthWeaknessCards, ObservationHistory.
  - **Main analytics grid**:
    - Row 1: 2×2 grid of `<DimensionTrendChart>` per category that has data. Each in its own card with title (`CATEGORY_LABELS[cat] + " — trends"`). Gridded by `grid-cols-1 lg:grid-cols-2 gap-6`. Categories present is computed from `Object.entries(pivots).filter(([_, rows]) => rows.some(r => /* any dim ≠ undefined */))`.
    - Row 2: 2-up grid `<PlayerRadarChart>` + `<CategoryAveragesChart>`. Both in cards. `grid-cols-1 lg:grid-cols-2`.
    - Row 3: `<ScoreHeatmap>` full-width in a card. Card has a small subtitle "Score by dimension and session — darker = higher".
    - Row 4: `<StrengthWeaknessCards>` full-width in a card.
    - Row 5: `<ObservationHistory>` full-width in a card.
- Spacing between rows: `space-y-6`.

Keep this file ≲300 lines.

### Step 5 — Routing & PlayersPage rewire

**`frontend/src/App.tsx`** (modify)
- Import `PlayerProfilePage`.
- Add `<Route path="/players/:id" element={<PlayerProfilePage />} />` immediately after `<Route path="/players" element={<PlayersPage />} />` inside the existing `<AppLayout>` block.

**`frontend/src/pages/PlayersPage.tsx`** (modify)
- Import `useNavigate` from `react-router-dom`; instantiate inside `PlayersPage`.
- Change `PlayerCard` signature: replace `onEdit` with two callbacks: `onOpen` (navigate to profile) and `onEdit` (open modal). Keep `onDelete`.
- In `PlayerCard`:
  - Outer `<div role="button">` `onClick`/`onKeyDown` calls `onOpen` (was `onEdit`).
  - Add a new icon button next to the delete icon (top-right area), `aria-label={`Edit ${player.name}`}`, pencil SVG, hover-revealed (`opacity-0 group-hover:opacity-100`), `onClick` stops propagation and calls `onEdit`.
- In `PlayersPage` render, pass `onOpen={() => navigate(`/players/${p.id}`)}` and `onEdit={() => openEdit(p)}` (existing logic).

Keep modifications minimal — do not refactor the rest of the file.

**`frontend/src/pages/SessionsPage.tsx`** and **`frontend/src/pages/SessionDetailPage.tsx`** (modify, mechanical)
- Replace the local `formatDate` function with `import { formatDate } from '../utils/format'`. Drop the inline copy.

---

## 4. Data model changes

None. Frontend only.

---

## 5. Edge cases and error handling

| Case | Where | Behaviour |
|---|---|---|
| `:id` is not numeric | PlayerProfilePage | `Navigate to /players replace` (mirror `SessionDetailPage`). |
| Player belongs to another coach / does not exist | Either `playerQ` or `progressQ` 404 | Render "Player not found" card with back link. |
| Player exists with 0 sessions | progress trends empty | Header renders with `total sessions = 0`, `avg = "—"`, no trend arrow. Body: single "No sessions yet" card with link to `/sessions/new`. |
| Player has exactly 1 session | trends.length === 1 | Dimension trend lines and category-averages chart panels skipped. Radar renders (current only — average === latest so polygons overlap; that's fine). Heatmap renders with 1 column. Strengths/Weaknesses render with `trend: 'stable'` per dimension. ObservationHistory renders 1 row. |
| Player has 2+ sessions but a category never scored | DimensionTrendChart for that category | Page-level check excludes that category from the 2×2 grid. |
| A dimension scored in some sessions but not others | Line chart | `connectNulls={true}` joins points across gaps; missing points have no dot. |
| Latest session lacks some dimensions | Radar current polygon | Plotted as 0; footnote enumerates the missing dims. Average polygon excludes them. |
| Coach navigates between profiles fast | TanStack Query | Each `id` is a distinct cache key; previous data stays cached. Loading state shows briefly on switch (or skipped if cache hit). |
| Coach clicks "Load more" with network failure | ObservationHistory | TanStack `isError` on the page; button shows "Retry" text and toggles to retry the same page. |
| Coach deletes a session from `SessionDetailPage` then navigates here | n/a | Per Architecture #21, we do NOT proactively invalidate. The cache may be stale for ≤default-staleTime (5 min). Acceptable — refetch happens on mount if stale. |
| Score = 0 in API (shouldn't happen — DB CHECK constraint) | All charts | Defensive: ignore. Backend rejects. |
| `playerName` contains emoji / RTL text | Header | Browser handles it. No special casing. |
| Same date for two sessions | All time-axis charts | The X-axis label is the formatted date; if two sessions share a date, the chart shows two ticks with the same label. Order is by `sessionId` ASC (already the server's tie-breaker for the progress endpoint). |
| Very long observation history (50+ rows) | ObservationHistory | Pagination (`pageSize=10`) caps initial render; "Load more" reveals the rest. |
| User opens a profile while still on the wizard step 3 in another tab | n/a | Independent tabs, no cross-tab coordination needed. |
| Trend window edge: exactly 6 sessions | `computeTrendDirection` | `window = min(3, 3) = 3`. Compare last 3 vs previous 3 exactly. |
| Trend window edge: exactly 4 sessions | `computeTrendDirection` | `window = min(3, 2) = 2`. Compare last 2 vs previous 2. |
| Trend window edge: 2 or 3 sessions | `computeTrendDirection` | `window = min(3, 1) = 1`. Compare last 1 vs previous 1 — likely noisy, threshold ±0.25 filters most. |
| Trend window edge: 1 session | `computeTrendDirection` | `window < 2` → `'stable'`. |

---

## 6. Validation rules

This is a read-only page. No user input → no client-side validation beyond URL-param sanity (Architecture #5 covers it).

Backend errors are surfaced verbatim per the established axios + `{ error, details }` contract.

---

## 7. Dependencies between files

```
utils/format.ts ──── leaf

utils/scoreAnalytics.ts ──── depends on api/sessions (Category, Dimension, ALL_DIMENSIONS, CATEGORY/DIM labels)

api/playerProgress.ts ──── depends on api/client, api/sessions (Category/Dimension), api/players (AgeGroup)

components/analytics/DimensionTrendChart.tsx ─── depends on api/sessions (labels), recharts
components/analytics/PlayerRadarChart.tsx ───── depends on recharts (no domain types beyond strings)
components/analytics/CategoryAveragesChart.tsx ── depends on api/sessions, recharts
components/analytics/ScoreHeatmap.tsx ──────── depends on api/sessions (labels)
components/analytics/StrengthWeaknessCards.tsx ─ depends on utils/scoreAnalytics (TrendDirection type), api/sessions (labels)
components/analytics/ObservationHistory.tsx ─── depends on api/playerProgress, components/ScoreDisplay (existing), utils/format

pages/PlayerProfilePage.tsx ─── depends on EVERYTHING ABOVE plus api/players (getPlayer), api/players (AGE_GROUP_CHIP_CLASSES)

App.tsx (modify) ─── depends on PlayerProfilePage
PlayersPage.tsx (modify) ─── depends on react-router-dom useNavigate (already there transitively)
SessionsPage.tsx, SessionDetailPage.tsx (modify) ─── depend on utils/format
```

Build order: utils → API → chart components (any order) → PlayerProfilePage → routing+wiring updates.

---

## 8. Verification checklist

Dev server must be running (`cd frontend && npm run dev`) and backend must be up. Use the existing verifier coach `f3verify@crick.test` / `Password123!`. Player **Kavindu Wickrema** (id 11 in the current DB) already has 3 sessions of observations from the Feature 4 backend verification — ideal for charts.

### Pre-flight

```bash
# 1) TypeScript
cd /Users/dinnethbandara/Desktop/ContextEngProjects/CoachLog/frontend && npx tsc --noEmit
# expect: no errors

# 2) Lint (new files only — existing pre-existing lint issues are not gated by this feature)
npx eslint src/utils/format.ts src/utils/scoreAnalytics.ts src/api/playerProgress.ts src/components/analytics/ src/pages/PlayerProfilePage.tsx
# expect: no errors

# 3) Type strictness — no `any` in new files
grep -nE '\bany\b' src/utils/format.ts src/utils/scoreAnalytics.ts src/api/playerProgress.ts src/components/analytics/*.tsx src/pages/PlayerProfilePage.tsx
# expect: no matches

# 4) Dev server responds
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
# expect: 200
```

### Manual — happy path (use Kavindu Wickrema, the 3-session player)

5. Log in. Open `/players` list. Click **Kavindu Wickrema's** card.
   - **Expect**: navigates to `/players/11`. Edit modal does NOT open.

6. The page shows:
   - Name "Kavindu Wickrema", chip "U13", notes paragraph.
   - Quick stats: Total sessions = 3, Sessions this month = 0 (sessions were dated April), Avg score ≈ "3.0" with trend arrow ("improving" expected since scores went 2/3 → 3/3/2 → 4/4/3), Latest session date "24 Apr 2026".

7. Analytics — DimensionTrendChart (Batting only — bowling/fielding/match-awareness charts hidden because no data):
   - **Expect**: one chart titled "Batting — trends", X-axis "10 Apr / 17 Apr / 24 Apr", footwork line 2→3→4, timing 3→3→4, shot_selection — / 2 → 3 (connectNulls draws a line from session 2 to 3 for shot_selection).

8. PlayerRadarChart:
   - **Expect**: a polygon with footwork=4, timing=4, shot_selection=3 (latest values); a fainter polygon for the historical mean. Other 14 dimensions plotted as 0 in current → polygon collapses to that triangle on the batting side. Footnote: "Not scored in latest session: stance, bat_path, action, line, …".

9. CategoryAveragesChart:
   - **Expect**: a single area "Batting" with values ~2.5 / ~2.67 / ~3.67 across the three dates. Bowling/Fielding/Match-Awareness areas absent or rendered with no points.

10. ScoreHeatmap:
    - **Expect**: 3 columns (sessions) × 3 rows (footwork, timing, shot_selection). Cells: light green for 2, medium for 3, dark for 4. Empty cell for shot_selection on session 1 with "—". Hover tooltip on a cell.

11. StrengthWeaknessCards:
    - **Expect**: Strengths show footwork (4.0, ↑), timing (4.0, ↑); weaknesses show shot_selection (3.0, ↑). All three trending up (consistent with improving scores).

12. ObservationHistory:
    - **Expect**: 3 collapsed rows. Click the most recent (24 Apr) — expands and shows BATTING category with footwork 4 / timing 4 / shot_selection 3 plus the overall notes ("Best session yet.") via the reused `ScoreDisplay`. "Load more" hidden (only 3 observations, page size 10).

13. Click back link ("← Players") — returns to `/players`.

### Manual — empty / sparse

14. Open a player with **zero sessions** (e.g. Sahil Mendis, id 12).
    - **Expect**: header renders (Sahil's name, U13 chip), total sessions = 0, no analytics panels, single "No sessions recorded yet" card with a "Start a session" link to `/sessions/new`.

15. Create one session with one score for **Sahil**, return to his profile.
    - **Expect**: header updates after the page is re-entered (TanStack refetch on mount). Dimension-trend / category-averages panels hidden. Radar shows the single session's score for the one dimension (others 0). Heatmap renders a 1-column grid. Strengths/Weaknesses card shows 1 item plus the "Need more sessions" footer.

### Manual — PlayersPage rewire

16. On `/players`, hover any player card.
    - **Expect**: both edit (pencil) and delete (trash) icons appear in the top-right.

17. Click pencil → edit modal opens (existing behaviour preserved).
    - Close modal.

18. Click trash → confirm dialog opens; cancel.

19. Click the card body (not an icon) → navigates to `/players/:id`. Icons in the corner do NOT navigate.

20. Press Tab to focus a card, press Enter → navigates (keyboard parity).

### Manual — error paths

21. Open `/players/9999` directly.
    - **Expect**: "Player not found" card with back link.

22. Open `/players/foo`.
    - **Expect**: redirect to `/players`.

23. Stop the backend, reload a player profile.
    - **Expect**: error card.

### Manual — date formatting

24. Verify dates appear as `dd MMM yyyy` (e.g. "10 Apr 2026") in the X-axis, quick-stats, heatmap header, and observation history. Confirm SessionsPage and SessionDetailPage still show the same format (no regression from the `formatDate` extraction).

### Console / network

25. With DevTools open, navigate from `/players` to a player profile.
    - **Expect**: 2 network calls — `GET /api/players/11` and `GET /api/players/11/progress` — fired in parallel. Click "Load more" → `GET /api/players/11/observations?page=0&size=10` then `page=1` etc.
    - No console errors. No warnings about missing keys, duplicate keys, or `dataKey` typos from Recharts.

### Type strictness

26. `grep -nE '\bany\b'` over the new files returns nothing.

---

## 9. Out of scope (do NOT add)

Per CLAUDE.md ("Do not add features beyond what is specified here") and INITIAL.md:
- No new backend endpoints. All computation is client-side.
- No drill recommendations (Feature 6).
- No parent view (Feature 7).
- No comparison view across multiple players.
- No export to PDF / image.
- No date-range filtering on the profile.
- No editing observations from the profile (the wizard handles that; if anything, link to `/sessions/:id` from the observation row, but only if INITIAL.md asked — it does not, so don't add).
- No new dependencies. Recharts only.
- No comments, no JSDoc.

---

## 10. Self-score

**Confidence: 9/10.**

The data flow (raw `trends` → utilities → component props), exact computation rules (trend window math, sparse-data fallbacks, hide thresholds per chart), chart-library choices with justified single-dependency stance, the PlayersPage card-click rewire, the routing addition, and the date-formatter consolidation are all nailed down. Verification covers the happy path (the existing Kavindu Wickrema seed makes this directly runnable), sparse/empty paths, the PlayersPage UX change, error paths, and type strictness.

The 1 point of uncertainty: **chart aesthetic polish** — the exact stroke widths, tooltip styling, legend positioning, and radar polygon opacity are sketched but not pixel-prescribed. Recharts defaults plus the Tailwind palette anchor it; the implementer will make small judgment calls. INITIAL.md's "Aesthetic: refined sports analytics" is qualitative — that line of taste belongs at the keyboard, not in this doc.

No blocking questions. Ready for `/execute-prp`.
