# Feature 3 Frontend: Session Logging

## What to build

The core coaching UX. A coach creates a session, picks who attended, then scores each player across technique dimensions. Must be fast enough to log 15 players in 10 minutes — speed is everything.

This is frontend only. Backend endpoints already exist.

## Context

Read `CLAUDE.md` before writing any code.

Backend endpoints available:
- `POST /api/sessions` — create `{ date, title, notes }`
- `GET /api/sessions?page=0&size=20` — paginated list with playerCount
- `GET /api/sessions/{id}` — full detail with nested observations
- `PUT /api/sessions/{id}/attendance` — `{ playerIds: [...] }`
- `POST /api/sessions/{id}/observations` — bulk submit observations
- `DELETE /api/sessions/{id}`
- `GET /api/players` — existing player list

Features 1–2 frontend complete: auth, player CRUD, TanStack Query patterns, axios client.

Categories and dimensions:
- BATTING: stance, footwork, bat_path, timing, shot_selection
- BOWLING: action, line, length, variations, control
- FIELDING: catching, throwing, positioning, agility
- MATCH_AWARENESS: decision_making, communication, pressure_response

Scores: 1–5 per dimension. Partial scoring is valid — coach only scores what they observed.

## Files to create

### API functions (`src/api/sessions.ts`)
- `getSessions(params)` — paginated list
- `getSession(id)` — full detail
- `createSession(data)` — POST
- `setAttendance(sessionId, playerIds)` — PUT
- `submitObservations(sessionId, observations)` — POST
- `deleteSession(id)` — DELETE
- Typed interfaces: `Session`, `SessionSummary`, `SessionDetail`, `Observation`, `ScoreEntry`

### Sessions list page (`src/pages/SessionsPage.tsx`)
- List of sessions: date, title, player count
- "New session" button
- Click a session → navigate to session detail
- Pagination
- Empty state

### New session flow — this is a multi-step wizard, not separate pages

**Step 1: Create session (`src/pages/NewSessionPage.tsx`)**
- Form: date (default today), title, optional notes
- On submit: creates session via API, advances to step 2

**Step 2: Attendance**
- Shows all players from coach's squad as a checkbox list grouped by age group
- "Select all" / "Deselect all"
- On submit: calls setAttendance, advances to step 3

**Step 3: Observation logging — this is the critical UX**
- Player tabs or sidebar list showing all attendees. Current player highlighted.
- For the selected player, show scoring grid:
  - Grouped by category (collapsible sections: Batting, Bowling, Fielding, Match Awareness)
  - Each dimension: label + a row of 5 buttons (1-2-3-4-5). Tap to score. Tap again to deselect.
  - Optional notes field per dimension (hidden by default, expand icon to reveal)
  - Overall notes textarea at bottom
- **Save per player in local state** — do not lose work when switching between players. Hold all observations in React state until final submit.
- Visual indicator on player tab: green dot if scored, empty if not yet
- "Submit all" button — sends entire observations payload to API in one call
- After submit: redirect to session detail page

### Session detail page (`src/pages/SessionDetailPage.tsx`)
- Read-only view of the session
- Session header: date, title, notes
- Player list with expandable observation cards
- Each card: player name, scores displayed as category → dimension → score, overall notes
- Delete session button with confirmation

### Reusable score display (`src/components/ScoreDisplay.tsx`)
- Takes an array of scores, renders them grouped by category
- Used in session detail and later in player profile (Feature 4)

## Constraints

- Observation state lives in React state (useState/useReducer) until submit. One API call at the end, not per player.
- Do not use localStorage or sessionStorage for observation drafts.
- Player switching must be instant — no API calls when tabbing between players.
- Categories the coach doesn't score are simply omitted from the payload. Don't send empty arrays.
- TanStack Query for all fetching. Mutations with cache invalidation on sessions list.
- Do not build player profile/progress charts — that's Feature 4.
- Keep styling consistent with existing pages.

## Verify

1. Create session → select players → score a few dimensions per player → switch between players without losing data → submit → session detail shows all observations correctly
