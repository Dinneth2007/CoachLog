# Feature 4 Frontend: Player Profile & Analytics Dashboard

## What to build

An impressive, modern player profile page that is the analytical heart of the app. A coach opens a player and instantly understands their trajectory — what's improving, what's stagnating, where to focus. This page should feel like a premium sports analytics product, not a student project.

This is frontend only. Backend endpoints already exist.

## Context

Read `CLAUDE.md` before writing any code.

Backend endpoints available:
- `GET /api/players/{id}` — player details (name, ageGroup, notes)
- `GET /api/players/{id}/progress` — `{ playerId, playerName, ageGroup, trends: [{ sessionId, sessionDate, sessionTitle, scores: [{ category, dimension, score }] }] }`
- `GET /api/players/{id}/observations?page=0&size=10` — paginated observation history with scores and notes
- `GET /api/players` — player list (already built)

Features 1–3 frontend complete: auth, players list, session logging.

Categories and dimensions:
- BATTING: stance, footwork, bat_path, timing, shot_selection
- BOWLING: action, line, length, variations, control
- FIELDING: catching, throwing, positioning, agility
- MATCH_AWARENESS: decision_making, communication, pressure_response

## Design direction

**Aesthetic: refined sports analytics — clean, data-dense, modern.** Think ESPN analytics meets a well-designed SaaS dashboard. Dark cards on a light background. Crisp typography. Deliberate use of colour to encode meaning (improving = green, declining = red, stable = neutral). Generous whitespace between sections but data-dense within each card.

**Install any free charting library that gives the best result.** Recharts is already installed but feel free to also use or switch to Nivo (`@nivo/line`, `@nivo/radar`, `@nivo/heatmap`) or Chart.js (`react-chartjs-2`) if they produce more impressive visuals for specific chart types. Pick the best tool per chart.

## Page layout (`src/pages/PlayerProfilePage.tsx`)

Route: `/players/{id}`

### Header section
- Player name (large), age group badge, notes
- Quick stats row: total sessions attended, average overall score (across all dimensions), sessions this month
- Trend indicator next to average: ↑ improving / ↓ declining / → stable (compare last 3 sessions average vs previous 3)

### Analytics section — show ALL of these

**1. Dimension trend lines (line chart)**
- One chart per category (Batting, Bowling, Fielding, Match Awareness) in a 2×2 grid
- Each chart: X-axis = session dates, Y-axis = score 1–5
- One coloured line per dimension within that category
- Tooltip on hover showing session title, date, exact scores
- If a category has no data across any sessions, hide that chart entirely

**2. Radar/spider chart (overall snapshot)**
- Single radar chart showing the player's LATEST scores across all dimensions
- Overlay the average of all their historical scores as a second, fainter shape
- This gives an instant "current form vs overall ability" view

**3. Category averages over time (area or bar chart)**
- One line/bar per category (4 total) showing the average score per category per session
- This is the zoomed-out "how is batting vs bowling trending" view

**4. Heatmap (score matrix)**
- Rows = dimensions, Columns = sessions (by date)
- Cell colour intensity = score (1 = light/cool, 5 = dark/warm)
- Gives an instant visual pattern of where scores are consistently low or improving
- Great for spotting patterns across many sessions at a glance

**5. Strength & weakness summary cards**
- Compute from latest 3 sessions:
  - Top 3 strongest dimensions (highest average) with score and trend arrow
  - Top 3 weakest dimensions (lowest average) with score and trend arrow
- Display as compact cards with colour coding

**6. Session-by-session observation log**
- Below the charts section
- Expandable accordion: each session shows date, title, scores grouped by category, overall notes
- Paginated — load more on scroll or button
- Reuse the `ScoreDisplay` component from Feature 3

### Empty states
- If player has 0 sessions: "No sessions recorded yet" with a link to create a new session
- If player has 1 session: show what's available, hide trend charts that need 2+ data points

## Files to create

### API functions (`src/api/playerProgress.ts`)
- `getPlayerProgress(playerId)` — GET progress endpoint
- `getPlayerObservations(playerId, page)` — GET paginated observations
- Typed interfaces for the response shapes

### Analytics components (create under `src/components/analytics/`)
- `DimensionTrendChart.tsx` — line chart for one category's dimensions over time
- `PlayerRadarChart.tsx` — radar chart with current vs historical overlay
- `CategoryAveragesChart.tsx` — area/bar chart of category-level trends
- `ScoreHeatmap.tsx` — heatmap grid of dimensions × sessions
- `StrengthWeaknessCards.tsx` — computed top/bottom dimensions
- `ObservationHistory.tsx` — paginated expandable session log

Each component receives data as props — all computation (averages, trends, sorting) happens in the page or a utility function, not inside chart components.

### Utility (`src/utils/scoreAnalytics.ts`)
- Pure functions: `computeCategoryAverages(trends)`, `computeStrengthsWeaknesses(trends, lastN)`, `computeTrendDirection(scores)` (returns 'improving' | 'declining' | 'stable')
- These are reusable for the parent view later

### Page
- `PlayerProfilePage.tsx` — orchestrates everything above

### Update routing and navigation
- `/players/:id` route points to PlayerProfilePage
- Player cards/rows in PlayersPage link to this page
- Back button or breadcrumb to return to players list

## Constraints

- All data fetching via TanStack Query.
- All score computation happens client-side from the progress endpoint data. Do not add new backend endpoints.
- Charts must handle sparse data gracefully — not every player is scored on every dimension every session.
- Responsive: charts stack vertically on mobile, 2-column grid on desktop.
- Use real Tailwind styling — no inline style objects unless required by the charting library.
- Do not add drill recommendations to this page — that's Feature 6.

## Verify

1. Open a player with 3+ sessions of observation data → all charts render with correct data, strengths/weaknesses show, observation history expands
