# PRP — Feature 3 Frontend: Session Logging UI

> Source: `INITIAL.md`. Global rules: `CLAUDE.md`. Predecessor state — Features 0–2 frontend complete (auth context, axios client with JWT interceptor and 401 redirect, `AppLayout` sidebar, `ProtectedRoute`, TanStack Query provider, `PlayersPage` reference patterns: `useDebounced`, `keepPreviousData`, skeleton/empty/error states, `Modal` portal with focus trap, `ConfirmDialog`). Feature 3 backend complete — every endpoint in `INITIAL.md` is implemented and verified.

---

## 1. Summary

Build the coach-facing UI for session logging: a `/sessions` list page (date / title / player count, paginated, with empty state), a `/sessions/new` three-step wizard that creates a session, sets attendance, and logs per-player technique observations in one workflow, and a `/sessions/:id` read-only detail page with delete. The critical screen is step 3 of the wizard, where the coach taps 1–5 buttons on a grid of cricket dimensions for each attendee — switching between players must be instant (no API calls, all observation state lives in React) so 15 players can be logged in 10 minutes. A single `POST /api/sessions/{id}/observations` call submits the whole batch on "Submit all", redirects to the detail page, and invalidates the sessions list. A reusable `ScoreDisplay` component renders grouped-by-category scores on the detail page (and is shaped for reuse in Feature 4's player profile). No localStorage / sessionStorage for drafts — that's an explicit constraint.

---

## 2. Architecture decisions

| # | Decision | Choice | Why | Alternatives rejected |
|---|---|---|---|---|
| 1 | URL shape | Three routes: `/sessions` (list, existing stub rewritten), `/sessions/new` (wizard), `/sessions/:id` (detail). | INITIAL.md says the wizard is "a multi-step wizard, not separate pages" — interpreted as one route, internal step state. CLAUDE.md mentions per-step URLs (`/sessions/{id}/attendance`, `/sessions/{id}/log`) but INITIAL.md overrides for this feature. Two route additions, no nested routing complexity. | Per-step routes — would require coordinating state across navigation (back button mid-wizard becomes ambiguous: "back to attendance" or "back to /sessions"?) and contradicts INITIAL.md. |
| 2 | Wizard state machine | `step: 1 \| 2 \| 3` + `sessionId: number \| null` held in `NewSessionPage` via `useState`. Transitions are one-way: step 1 creates session → step 2 → step 3 → redirect out. No "back" button across steps (a step-back from attendance to step 1 would orphan a created session). | Linear flow matches the coach's mental model (create → attend → score). Backwards-edits live in the detail page (out of scope for this feature). | `useReducer` + history — overengineered for a 3-state machine. Allowing back-navigation — invites half-baked sessions sitting in the DB and complicates state. |
| 3 | Observation draft state shape | Inside step 3, hold `drafts: Record<number, PlayerDraft>` where `PlayerDraft = { overallNotes: string; scores: Record<Dimension, { score: number; notes: string }> }`. Plain object keyed by `playerId`. `scores` is keyed by the dimension wire-format string (e.g. `"footwork"`). | Maps would also work but plain objects serialise/diff-render fine for ~15 players × 17 dimensions. Keying scores by dimension makes "tap again to deselect" a single delete-key operation. | One flat array of `ScoreEntry` per player — searching/updating by dimension becomes O(n) per keystroke. Nested category → dimension structure — pointless extra layer; category is derivable from dimension via the static taxonomy. |
| 4 | Tap-to-score / tap-to-deselect | A score row is 5 buttons (1–5). Tapping `n` sets `drafts[pid].scores[dim] = { score: n, notes: existingNotes ?? "" }`. Tapping the **already-active** button removes the key entirely: `delete drafts[pid].scores[dim]`. Notes are preserved across re-selections but discarded on deselect. | INITIAL.md: "Tap again to deselect." Discarding notes on deselect matches the user's intent ("this dimension is no longer scored"). | Toggle the score only and keep notes — orphan notes with no score are meaningless and confuse the payload. Separate clear button — extra tap. |
| 5 | Per-dimension notes visibility | `expanded: Set<string>` of `${playerId}:${dimension}` keys in step 3 state. Expand icon toggles membership. Notes textarea renders only when key is present. State is per-page-instance — not persisted across player switches because it lives in the parent. | INITIAL.md: "Optional notes field per dimension (hidden by default, expand icon to reveal)." A Set keyed by player+dimension means expanded-state persists per dimension per player (so if you expand footwork notes for P1, switch to P2, switch back, it's still open). | Per-player `expanded` set scoped only while viewing that player — collapses unexpectedly when switching back. Per-dimension only (ignoring player) — wrong; each player has independent notes. |
| 6 | Player switching speed | All step 3 state (drafts, expanded set, current player id) lives in `NewSessionPage` (or a single `ObservationStep` component). Switching is `setCurrentPlayerId(id)` only — no fetches, no Suspense boundaries. The drafts object is mutated immutably via `setDrafts(prev => …)` so unrelated players' subtrees don't re-render needlessly. | INITIAL.md: "Player switching must be instant — no API calls when tabbing between players." Keeping it all in one component avoids context-provider boilerplate; React's reconciliation handles the rest. | Per-player Query — would force refetches. React Context for drafts — solving a problem we don't have at this scale. |
| 7 | "Green dot if scored" indicator | A player is "scored" iff `drafts[pid]` exists AND (any score key set OR non-empty trimmed `overallNotes`). Compute on the fly during render of the player tab list. | O(playerCount) per render — cheap. Avoids stale derived state. | Maintain a separate `scoredPlayerIds` set — double-bookkeeping, easy to forget to update. |
| 8 | Payload assembly on "Submit all" | Walk `drafts`. For each player with **any score** OR **non-empty trimmed overallNotes**, emit one `Observation`. Each `ScoreEntry` is `{ category: DIM_TO_CAT[dim], dimension: dim, score, notes: trimmedNotes \|\| null }`. Players with no scores and empty overallNotes are omitted entirely. | INITIAL.md: "Categories the coach doesn't score are simply omitted from the payload. Don't send empty arrays." Interpreted as: don't emit empty score arrays *for unused categories* (trivially satisfied — the wire format is flat), and skip whole players who contributed nothing. | Always send all attendees with `scores: []` — pollutes detail view (would show every player with "no observations" line). |
| 9 | Single source of truth for dimensions | Export `DIMENSIONS_BY_CATEGORY: Record<Category, readonly Dimension[]>` from `api/sessions.ts`. Also export `CATEGORIES: readonly Category[]` (ordered) and `DIMENSION_LABELS: Record<Dimension, string>` (snake_case → Title Case). Derive `type Dimension = (typeof ALL_DIMENSIONS)[number]` so TypeScript knows the union. | Single constant means renames flow through the whole UI. Title-case labels live next to the constants. | Inlining the taxonomy at each use site — guaranteed drift. |
| 10 | Reusable `ScoreDisplay` component | Takes `scores: ScoreEntry[]`, optional `overallNotes: string \| null`, plus optional `playerName` / `headerSlot`. Groups by category using `DIMENSIONS_BY_CATEGORY` order, only renders categories that have at least one score, shows `dimension — N/5` with notes underneath if present. Pure presentational. | INITIAL.md explicitly calls out reuse in Feature 4. Designing the API now (with optional name + notes) avoids a refactor later. | Coupling display to the detail page — would have to duplicate or refactor for Feature 4. |
| 11 | TanStack Query keys | `['sessions', { page, size }]` for list, `['sessions', id]` for detail. Mutations: `createSession` invalidates `['sessions']`; `submitObservations` invalidates both `['sessions']` (playerCount may change) and `['sessions', id]`; `deleteSession` invalidates `['sessions']`. `setAttendance` doesn't need cache invalidation because the wizard immediately advances. | Matches the PlayersPage pattern (`['players', ...]`). Two keys cover all read paths; mutations are explicit. | Per-step keys (`['sessions', id, 'attendance']`) — unnecessary; the detail endpoint returns the full graph. |
| 12 | Pagination | `useQuery` with `keepPreviousData` + `placeholderData`, same Previous/Next UI as `PlayersPage`. Size 20. | Direct copy of an already-proven pattern. | Infinite scroll — different UX, not requested, would require `useInfiniteQuery`. |
| 13 | Error handling | Each step's mutation surfaces backend error via `axios.isAxiosError(err) && err.response?.data?.error`. Step 1 / step 2 show inline error banners and stay on step. Step 3 shows a banner above the Submit button and **does not** clear drafts. 4xx with `details` object (validation) is displayed below the relevant input where feasible; otherwise full `error` string. | Matches the auth + player-form error UX. Critical: never lose draft observations on submit failure. | Toast notifications — no toast library wired up; banner pattern is consistent with existing forms. |
| 14 | Navigation after submit | After `submitObservations` succeeds, `useNavigate()` to `/sessions/:id` with `replace: true` so the browser back button skips the wizard. | INITIAL.md: "After submit: redirect to session detail page." `replace: true` prevents weird back-button states. | Stay on the wizard with a success message — slower; coach wants confirmation visually via the detail page. |
| 15 | Refresh / mid-wizard navigation | No protection. If the coach refreshes during step 2/3, drafts are lost (the session row remains in DB with no observations, recoverable via `/sessions` list). No `beforeunload` warning. | INITIAL.md explicitly forbids localStorage/sessionStorage for drafts. The trade-off is explicit. Adding a `beforeunload` warning is unnecessary scope. | localStorage backup — directly forbidden. |
| 16 | New routes wiring | Add to existing `App.tsx`'s authenticated section: `<Route path="/sessions/new" element={<NewSessionPage />} />` and `<Route path="/sessions/:id" element={<SessionDetailPage />} />`. Both nested inside the `<ProtectedRoute>` / `<AppLayout>` block. | No layout changes — both pages need the sidebar. | Stand-alone fullscreen wizard layout — would lose nav consistency; INITIAL.md says "keep styling consistent with existing pages." |
| 17 | Sub-component split for step 3 | Extract `components/ObservationStep.tsx` (the scoring UI) since step 3 alone is ~250 lines of JSX. Steps 1 and 2 stay inline in `NewSessionPage.tsx` (each ≲80 lines). | Keeps `NewSessionPage.tsx` readable; isolates the most complex part for easier review. | Three separate files for three steps — overhead without much benefit for the small steps. One giant file — hard to navigate. |
| 18 | Type strictness | Strict TypeScript everywhere; no `any`. Use `satisfies` for the dimension constants so widening to plain `string[]` is prevented (`as const` is acceptable too). Wire-format types match backend exactly: `category` UPPER, `dimension` lowercase. | CLAUDE.md mandates strict, no `any`. The wire-format mismatch (UPPER category, lowercase dimension) is enforced by the type union. | Loose types with runtime checks — pushes errors to runtime. |
| 19 | Existing `SessionsPage.tsx` rewrite | Wholesale replace the existing stub (`<h1>Sessions</h1>`) with the full list page. | The file already exists and is in the route table; a rewrite is the smallest change. | Create a new file and re-wire — extra churn. |
| 20 | Comments / Javadoc | None. CLAUDE.md mandates no obvious comments. | Same as backend. | — |

---

## 3. File-by-file implementation plan

Implementation order: types/API first (everything depends on them), reusable component next, then pages bottom-up (detail → list → wizard sub-component → wizard shell), then route wiring.

### Step 1 — API layer

**`frontend/src/api/sessions.ts`** (new)

Single source of truth for the session/observation domain on the frontend.

- **Type aliases:**
  - `export type Category = 'BATTING' | 'BOWLING' | 'FIELDING' | 'MATCH_AWARENESS'`.
  - `export const CATEGORIES = ['BATTING', 'BOWLING', 'FIELDING', 'MATCH_AWARENESS'] as const satisfies readonly Category[]`.
  - `export const DIMENSIONS_BY_CATEGORY = { BATTING: ['stance','footwork','bat_path','timing','shot_selection'], BOWLING: ['action','line','length','variations','control'], FIELDING: ['catching','throwing','positioning','agility'], MATCH_AWARENESS: ['decision_making','communication','pressure_response'] } as const`.
  - `export const ALL_DIMENSIONS = CATEGORIES.flatMap(c => DIMENSIONS_BY_CATEGORY[c])` typed as `readonly Dimension[]`. (Use `(typeof DIMENSIONS_BY_CATEGORY)[Category][number]` to derive `Dimension`.)
  - `export type Dimension = (typeof DIMENSIONS_BY_CATEGORY)[Category][number]`.
  - `export const DIMENSION_TO_CATEGORY: Record<Dimension, Category>` — built once at module load by iterating `DIMENSIONS_BY_CATEGORY`. Used by the payload assembler.
  - `export const CATEGORY_LABELS: Record<Category, string> = { BATTING: 'Batting', BOWLING: 'Bowling', FIELDING: 'Fielding', MATCH_AWARENESS: 'Match Awareness' }`.
  - `export const DIMENSION_LABELS: Record<Dimension, string>` — derived programmatically: snake_case → Title Case (e.g. `'bat_path' → 'Bat path'`, `'pressure_response' → 'Pressure response'`). Build with a small mapper, **not** by hand — fewer typos. Exception: `'shot_selection' → 'Shot selection'`.

- **Wire-format interfaces:**
  - `interface SessionSummary { id: number; date: string; title: string; playerCount: number; createdAt: string; }`.
  - `interface Session { id: number; date: string; title: string; notes: string | null; createdAt: string; }`.
  - `interface ScoreEntry { category: Category; dimension: Dimension; score: number; notes: string | null; }`.
  - `interface ObservationView { playerId: number; playerName: string; overallNotes: string | null; scores: ScoreEntry[]; }`.
  - `interface SessionDetail extends Session { players: ObservationView[]; }`.
  - `interface Observation { playerId: number; overallNotes?: string | null; scores: ScoreEntry[]; }` (used in the submit payload).
  - `interface SessionsResponse { content: SessionSummary[]; totalElements: number; totalPages: number; number: number; size: number; first: boolean; last: boolean; }` — same shape as `PlayersResponse`.
  - `interface CreateSessionData { date: string; title: string; notes?: string; }`.
  - `interface SessionsQuery { page?: number; size?: number; }`.

- **API functions** — thin wrappers over `api` from `./client`:
  - `export async function getSessions(params: SessionsQuery = {}): Promise<SessionsResponse>` → `GET /sessions`.
  - `export async function getSession(id: number): Promise<SessionDetail>` → `GET /sessions/{id}`.
  - `export async function createSession(data: CreateSessionData): Promise<Session>` → `POST /sessions`.
  - `export async function setAttendance(sessionId: number, playerIds: number[]): Promise<{ players: { id: number; name: string; ageGroup: import('./players').AgeGroup }[] }>` → `PUT /sessions/{id}/attendance`.
  - `export async function submitObservations(sessionId: number, observations: Observation[]): Promise<{ observationsSaved: number }>` → `POST /sessions/{id}/observations`.
  - `export async function deleteSession(id: number): Promise<void>` → `DELETE /sessions/{id}`.

Keep this file ≲130 lines.

### Step 2 — Reusable display component

**`frontend/src/components/ScoreDisplay.tsx`** (new)

Pure presentational; takes scores and renders them grouped by category.

- Props: `{ scores: ScoreEntry[]; overallNotes?: string | null; emptyLabel?: string; }`. No callbacks, no state.
- Behaviour:
  - Group scores by `category` using `DIMENSION_TO_CATEGORY` (not by reading `score.category` — they're consistent, but using the canonical map ensures display order even if backend sends an unexpected order).
  - Inside each category, sort scores by their position in `DIMENSIONS_BY_CATEGORY[category]` (canonical taxonomy order).
  - Only render categories that have ≥1 score.
  - If `scores.length === 0` and no `overallNotes`, render the `emptyLabel` (default: "No observations") as muted text and nothing else.
  - Each category gets a small heading (use `CATEGORY_LABELS`); each row shows `DIMENSION_LABELS[dim]`, a score badge (`<span>3 / 5</span>` styled like the age-group chips in `PlayersPage`), and notes underneath in muted small text if present.
  - `overallNotes`, if present, renders above the category groups in a small bordered box labelled "Overall notes".
- Styling: Tailwind classes consistent with `PlayersPage` (`bg-white border border-slate-200 rounded-xl p-5` for outer card-like sections — but `ScoreDisplay` itself does **not** wrap in a card; the caller wraps. Keeps it composable.).

Keep this file ≲90 lines.

### Step 3 — Session detail page

**`frontend/src/pages/SessionDetailPage.tsx`** (new)

- Reads `:id` from `useParams<{ id: string }>()`; parse to number, redirect to `/sessions` if NaN.
- `useQuery({ queryKey: ['sessions', id], queryFn: () => getSession(id) })`.
- Loading → skeleton (mirror PlayersPage skeleton style; 3 placeholder cards).
- Error: if `error.response?.status === 404`, show "Session not found" with link back to `/sessions`. Otherwise show generic error state.
- Layout:
  - Page header: back link "← Sessions" (uses `Link` from react-router-dom), session title as `h1`, date formatted as `dd MMM yyyy` (use `toLocaleDateString` with options `{ day: '2-digit', month: 'short', year: 'numeric' }` — no date-fns dependency), session notes below in muted text if present.
  - Delete button on the right of header. Opens `ConfirmDialog` (existing component), `destructive`. On confirm, call `deleteSession(id)` mutation; on success invalidate `['sessions']`, navigate to `/sessions` with `replace: true`.
  - Player section: if `data.players.length === 0`, empty state ("No attendees on this session"). Otherwise grid of cards (1 column on mobile, 2 on lg) — each card has player name as heading + age group chip (reuse the chip palette from PlayersPage — extract the chip color map to a small shared util **only if** it's used in ≥3 places; otherwise duplicate the literal here) + `<ScoreDisplay scores={p.scores} overallNotes={p.overallNotes} />`.
- Mutations:
  - `const deleteMut = useMutation({ mutationFn: () => deleteSession(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['sessions'] }); navigate('/sessions', { replace: true }); } });`.

Keep this file ≲180 lines.

### Step 4 — Sessions list page

**`frontend/src/pages/SessionsPage.tsx`** (rewrite — current content is the 3-line stub)

- Page state: `page` (number). No search/filter for sessions in this feature (INITIAL.md doesn't require it).
- `useQuery({ queryKey: ['sessions', { page, size: PAGE_SIZE }], queryFn: () => getSessions({ page, size: PAGE_SIZE }), placeholderData: keepPreviousData })` with `PAGE_SIZE = 20`.
- Header: "Sessions" h1 + summary count + "New session" button (right) → `navigate('/sessions/new')`.
- Body:
  - Loading: skeleton (3 row placeholders).
  - Error: red banner.
  - Empty + no data: `EmptyState` with "Log your first session" button.
  - Non-empty: list rendered as a vertical stack of clickable rows (not the card grid used for players — sessions are temporal, a list reads better). Each row: date (formatted as above), title (font-medium), playerCount as a chip ("3 players"). Click → navigate to `/sessions/:id`. Use `role="button" tabIndex={0}` + keyboard handler exactly like `PlayerCard`.
- Pagination: copy the Previous/Next pattern from `PlayersPage` (Prev/Next, totalPages, opacity-during-fetch).

Keep this file ≲180 lines.

### Step 5 — Observation step (the critical UX)

**`frontend/src/components/ObservationStep.tsx`** (new)

Owns the step-3 state and renders the scoring grid. Imported by `NewSessionPage`.

- Props: `{ sessionId: number; attendees: { id: number; name: string; ageGroup: AgeGroup }[]; onSubmitSuccess: () => void; onSubmitError?: (msg: string) => void }`.
- Local state:
  - `currentPlayerId: number` — initialised to `attendees[0].id`.
  - `drafts: Record<number, PlayerDraft>` — empty `{}` initially. `PlayerDraft = { overallNotes: string; scores: Partial<Record<Dimension, { score: number; notes: string }>> }`.
  - `expanded: Set<string>` — keys of the form `${playerId}:${dimension}`.
  - `submitError: string | null`.
- Layout (two columns on `md+`, stacked on small):
  - **Left rail (≈14rem)**: vertical list of attendees. Active row highlighted with `bg-slate-900 text-white`. Each row shows a green dot if scored (per Architecture #7), otherwise no dot. Tap → `setCurrentPlayerId`. Use `Comparator.comparing(name)` ordering for stability.
  - **Right pane**: current player's name + age group chip at top; below it, "Overall notes" textarea bound to `drafts[pid]?.overallNotes ?? ''`; below that, the scoring grid.
- Scoring grid:
  - For each `Category` in `CATEGORIES` order, render a collapsible section. Default-open. Section header is `CATEGORY_LABELS[cat]` with a small chevron.
  - For each `Dimension` in `DIMENSIONS_BY_CATEGORY[cat]`:
    - Row: dimension label on left, 5 buttons (1–5) on right, plus an "expand notes" toggle (a small icon button: chat bubble or plus icon).
    - Active score (if `drafts[pid]?.scores[dim]?.score === n`): button has `bg-slate-900 text-white`. Inactive: `bg-white border border-slate-200 hover:bg-slate-50`.
    - Tap button `n`:
      - If currently active → delete the dimension entry (deselect).
      - Else → set `{ score: n, notes: existing?.notes ?? '' }`.
    - Tap the expand toggle → flip `expanded.has('${pid}:${dim}')`. When expanded, render a notes textarea (`maxLength={500}`) under the row, bound to `drafts[pid]?.scores[dim]?.notes ?? ''`. Editing the notes lazily creates a score entry **only if** a score is already set — typing notes without picking a score does nothing visible; the entry materialises when the coach picks a score. (Don't materialise scoreless notes — they'd be dropped on payload assembly anyway.)
- State updates: all via `setDrafts(prev => …)` returning a new object with the updated player key. Immutability lets React skip rendering inactive players.
- "Submit all" button (bottom of right pane, sticky on scroll):
  - Disabled when `submitMut.isPending`.
  - On click: assemble payload per Architecture #8 (only players with ≥1 score OR trimmed-non-empty overallNotes; scores list deterministically ordered by `ALL_DIMENSIONS` index for stable diffs).
  - Call `submitObservations(sessionId, payload)`.
  - On success: invalidate `['sessions']` and `['sessions', sessionId]`; call `onSubmitSuccess()` (the parent navigates).
  - On error: set `submitError` to the backend message; keep drafts.
- Banner above the submit button: shows `submitError` if non-null.
- Keyboard shortcuts: optional — INITIAL.md doesn't require them; do **not** add (scope creep).

Keep this file ≲320 lines.

### Step 6 — Wizard shell

**`frontend/src/pages/NewSessionPage.tsx`** (new)

- State: `step: 1 | 2 | 3`, `session: Session | null`, `attendees: { id: number; name: string; ageGroup: AgeGroup }[]`.
- Mutations:
  - `createMut = useMutation({ mutationFn: createSession, onSuccess: (s) => { setSession(s); setStep(2); qc.invalidateQueries({ queryKey: ['sessions'] }); } })`.
  - `attendanceMut = useMutation({ mutationFn: ({ id, ids }: { id: number; ids: number[] }) => setAttendance(id, ids), onSuccess: (res) => { setAttendees(res.players); setStep(3); } })`.
- Layout:
  - Page wrapper with header showing a 3-step indicator (small numbered dots with the active step highlighted) and a "Cancel" link back to `/sessions`. Cancel during step 1 just navigates; cancel during steps 2/3 navigates without warning (per Architecture #15) — the half-baked session row stays in DB and is recoverable via the list.
  - **Step 1 inline form**:
    - Fields: `date` (input type=date, default `new Date().toISOString().slice(0,10)`), `title` (input, max 100, autoFocus), `notes` (textarea, max 500, optional).
    - Submit → `createMut.mutate({ date, title, notes: notes.trim() || undefined })`.
    - Show field-level errors from `err.response?.data?.details` (e.g. `{title: "must not be blank"}`); show top-level error from `err.response?.data?.error` if no `details`.
    - "Next" button is the submit button (label: "Next →"). Disabled while pending.
  - **Step 2 inline section** (gated on `session !== null`):
    - `useQuery({ queryKey: ['players', { all: true }], queryFn: () => getPlayers({ size: 200 }) })` — fetch up to 200 players (per backend pagination default cap; coach squad is ≤30 per CLAUDE.md, well under).
    - Loading skeleton.
    - If `data.totalElements === 0`: empty state "Add a player first" with a `<Link to="/players">` action.
    - Otherwise: group players by `ageGroup` (use `AGE_GROUPS` order from `players.ts`). For each age group present, render a section: heading + "Select all" / "Deselect all" toggle (toggles only that group's players in the selection set) + checkbox list. Player rows are `<label>` with checkbox + name.
    - Selection state: `selected: Set<number>`. Toggle on row click.
    - Master "Select all" / "Deselect all" at the top of the player list toggles every player.
    - Submit ("Next →") disabled when `selected.size === 0` OR when `attendanceMut.isPending`. On submit: `attendanceMut.mutate({ id: session.id, ids: [...selected] })`.
    - Backend error → banner above the player list.
  - **Step 3** (gated on `session !== null` and `attendees.length > 0`): render `<ObservationStep sessionId={session.id} attendees={attendees} onSubmitSuccess={() => navigate('/sessions/' + session.id, { replace: true })} />`.
- Edge: deep-linking to `/sessions/new` always starts at step 1 — the URL has no step parameter.

Keep this file ≲260 lines (most JSX is forms; the heavy step 3 is extracted).

### Step 7 — Route wiring

**`frontend/src/App.tsx`** (modify)

- Add two imports: `NewSessionPage` from `./pages/NewSessionPage`, `SessionDetailPage` from `./pages/SessionDetailPage`.
- Inside the `<Route element={<AppLayout />}>` block, add two routes alongside the existing `/sessions` row:
  - `<Route path="/sessions/new" element={<NewSessionPage />} />`
  - `<Route path="/sessions/:id" element={<SessionDetailPage />} />`
- Order matters for React Router 7: `/sessions/new` must come before `/sessions/:id` so `:id="new"` doesn't try to fetch. (Actually React Router 7 matches by specificity — literal paths beat params — but listing in this order keeps it obvious.)

Modification only; no new file.

---

## 4. Data model changes

None. This is frontend-only. All backend tables and endpoints exist and are verified.

---

## 5. Edge cases and error handling

| Case | Where | Behaviour |
|---|---|---|
| Coach has zero players when reaching step 2 | NewSessionPage step 2 | Empty state with primary button `<Link to="/players">Add a player</Link>`. "Next" button hidden; coach can also Cancel. |
| Backend rejects `POST /sessions` (e.g. bad date format) | step 1 mutation `onError` | Inline error under the offending field (from `details`); top-level banner if `details` absent. Drafts remain. |
| Backend rejects `PUT /attendance` (e.g. a player was deleted in another tab between step 1 and step 2) | step 2 mutation `onError` | Top-level error banner with the backend message ("One or more players do not belong to this coach"); refetch the player list (`qc.invalidateQueries(['players'])`) so the stale player disappears; selection set is cleared. |
| Backend rejects `POST /observations` (e.g. session was deleted in another tab) | ObservationStep submit `onError` | Banner above submit button with the backend message. Drafts retained so coach can copy-paste notes if needed before navigating away. |
| Coach refreshes during the wizard | n/a | All draft state lost (deliberate per INITIAL.md). The session row remains in DB; coach can find it via `/sessions` list with `playerCount=0`. |
| Coach uses browser back during step 3 | n/a | They land on step 2 with empty selection — start over from there or Cancel. We do not preserve back-navigation state. |
| Coach navigates away via sidebar during step 3 | n/a | Same as refresh — drafts lost. No `beforeunload` warning (per Architecture #15). |
| `/sessions/:id` for a nonexistent or other-coach session | SessionDetailPage | Backend returns 404 → render "Session not found" with a back-to-sessions link. |
| `/sessions/:id` with a non-numeric id | SessionDetailPage | Parse fails → `navigate('/sessions', { replace: true })`. |
| Session has zero attendees on detail page | SessionDetailPage | Show muted "No attendees on this session" beneath the header. |
| Session has attendees but no observations | SessionDetailPage | Each player card renders `ScoreDisplay` with `emptyLabel="No observations"` (per ScoreDisplay's empty branch). |
| Coach taps `5` twice in step 3 | ObservationStep | First tap sets score=5; second deselects. Notes (if any) are discarded. |
| Coach types notes in a dimension with no score set | ObservationStep | Notes are tracked in state but the dimension stays unscored, so it's excluded from the payload. (Notes-without-score has no meaning to the backend.) |
| Coach picks a score, types notes, then deselects | ObservationStep | Entry deleted from `drafts[pid].scores`. Notes lost. Acceptable per Architecture #4. |
| Coach hits "Submit all" with all attendees unscored AND empty overall notes | ObservationStep | Payload is `{ observations: [] }`. Backend accepts (clears existing observations to empty). Detail page shows attendees with no observations. This is a valid state (coach attended but didn't score anyone). |
| Coach hits "Submit all" with one player who has only overall notes (no scores) | ObservationStep | That player is included with `scores: []` and `overallNotes` populated. Detail page shows their card with overall notes. |
| 401 mid-flow | global axios interceptor | Existing client interceptor wipes JWT and redirects to `/login`. Wizard state is destroyed. Same as token expiry on any page. |
| Network failure on submit | ObservationStep | Mutation's `onError` shows banner: "Could not submit observations. Check your connection." Drafts preserved; user can retry. |

---

## 6. Validation rules

All client-side validation is for UX feedback only — the backend is the source of truth and its 400 responses are surfaced.

| Field | Client rule | Effect |
|---|---|---|
| Step 1 `date` | required, `<input type="date">` | Native browser validation prevents submit; Submit button additionally checks `if (!date) return`. |
| Step 1 `title` | required, trimmed length 1–100 | Submit disabled when `title.trim() === ''`. `maxLength={100}` on input. |
| Step 1 `notes` | optional, max 500 | `maxLength={500}` on textarea. Character counter (xx/500) under field, same pattern as PlayerFormModal. |
| Step 2 `playerIds` | required, ≥1 distinct | "Next" disabled when `selected.size === 0`. |
| Step 3 `score` (per dimension) | exact 1–5 | Only 1–5 buttons exist, so impossible to send out-of-range. |
| Step 3 `notes` (per dimension) | optional, max 500 | `maxLength={500}` on textarea. |
| Step 3 `overallNotes` (per player) | optional, max 500 | `maxLength={500}` on textarea. |

Backend-side errors surfaced verbatim (the existing `GlobalExceptionHandler` already covers everything):
- `{ error: "Validation failed", details: { field: msg } }` → render field-level messages.
- `{ error: <message>, details: null }` → render top-level banner.
- 401 → axios interceptor redirect.
- 404 on detail → "Session not found" message.

---

## 7. Dependencies between files

```
api/sessions.ts ──────────────────────────────────────┐
   exports types + constants + functions consumed by  │
   every page and the ScoreDisplay component          │
                                                      │
components/ScoreDisplay.tsx ─── depends on api/sessions (types, label maps)
                                                      │
pages/SessionDetailPage.tsx ─── depends on api/sessions, ScoreDisplay,
                                ConfirmDialog (existing), api/players (AgeGroup)
                                                      │
pages/SessionsPage.tsx ─── depends on api/sessions    │
                                                      │
components/ObservationStep.tsx ─── depends on api/sessions, api/players (AgeGroup type)
                                                      │
pages/NewSessionPage.tsx ─── depends on api/sessions, api/players (getPlayers, AgeGroup),
                              ObservationStep                                
                                                      │
App.tsx (modify) ─── depends on NewSessionPage, SessionDetailPage
```

Strict build order: `api/sessions.ts` → `ScoreDisplay` → `SessionDetailPage` → `SessionsPage` (independent of the others but use the same types) → `ObservationStep` → `NewSessionPage` → `App.tsx` route wiring.

The two pages that can be implemented "early" once `api/sessions.ts` is in place are `SessionsPage` and `SessionDetailPage` — they don't depend on the wizard. Implementing them first makes manual verification of the wizard easier (you can see the session you just created in the list).

---

## 8. Verification checklist

These checks combine type-check, automated build, and manual browser steps. The dev server must be running (`cd frontend && npm run dev`) and the backend must be up (verified during Feature 3 backend; pid 1163 as of writing).

### Pre-flight

```bash
# 1) TypeScript strict typecheck
cd /Users/dinnethbandara/Desktop/ContextEngProjects/CoachLog/frontend && npx tsc --noEmit
# expect: no errors
```

```bash
# 2) Lint
cd /Users/dinnethbandara/Desktop/ContextEngProjects/CoachLog/frontend && npm run lint
# expect: no errors
```

```bash
# 3) Dev server starts
cd /Users/dinnethbandara/Desktop/ContextEngProjects/CoachLog/frontend && npm run dev
# expect: Vite ready at http://localhost:5173 with no console errors
```

### Manual — sessions list

4. Visit `http://localhost:5173/sessions` while logged in as a coach with **no** sessions.
   - **Expect**: empty state with "Log your first session" button.

5. Click "New session" → navigates to `/sessions/new`.
   - **Expect**: step 1 form visible, date input pre-filled with today's date, "Next →" disabled.

### Manual — wizard happy path

6. Type a title ("Tuesday nets") and notes ("Spin focus"). Click "Next →".
   - **Expect**: step 2 visible, URL still `/sessions/new`, sessions list query invalidates (open another tab on `/sessions` to confirm playerCount=0 row appears).

7. Step 2 — player groups grouped by age, "Select all" toggle works, individual checkboxes work.
   - Select 3 players spanning two age groups.
   - **Expect**: "Next →" enabled (was disabled at 0). Click → step 3.

8. Step 3 — left rail lists three attendees, first one auto-selected.
   - Tap `3` on BATTING / footwork → button highlights.
   - Tap `4` on BATTING / timing.
   - Click expand icon on footwork → notes textarea appears below the row.
   - Type "Still stepping across" into the footwork notes.
   - Switch to player 2 via left rail → grid resets to empty.
   - **Expect**: switch is instant (no spinner, no network in DevTools).
   - Tap `2` on BOWLING / line for player 2.
   - Switch back to player 1 → footwork=3 (highlighted), timing=4 (highlighted), notes textarea **still expanded** with the text intact.

9. Click "Submit all".
   - **Expect**: spinner on button, then redirect to `/sessions/:id`.
   - On the detail page: header shows date + title + notes; player 1's card shows BATTING / footwork 3/5 ("Still stepping across") + BATTING / timing 4/5; player 2's card shows BOWLING / line 2/5; player 3's card shows "No observations".

10. Click "← Sessions" in the detail header.
    - **Expect**: list shows the new session with `playerCount=3` (NOT 0; mutation invalidated `['sessions']`).

### Manual — partial / empty data

11. Repeat steps 4–6 to create another session. Select 2 players. In step 3, type only an overall note for player 1 (no scores). Submit.
    - **Expect**: detail page shows player 1's card with overall notes and no score rows; player 2's card shows "No observations".

12. Create one more session, select 2 players, submit step 3 immediately without scoring anyone.
    - **Expect**: detail page shows both players with "No observations".

### Manual — delete

13. On a detail page, click Delete → confirm.
    - **Expect**: ConfirmDialog opens; clicking "Delete" → redirects to `/sessions`; the deleted session is gone from the list.

### Manual — error paths

14. On step 1, leave title empty, click "Next →".
    - **Expect**: button is disabled. Force-trigger by re-enabling in devtools and submitting is not part of the test — disabled button suffices.

15. On step 1, set title = "x".repeat(101) (101 chars) — the input's `maxLength=100` blocks it client-side. Verify input caps at 100.

16. Simulate backend error: temporarily stop the backend, hit "Submit all" on step 3.
    - **Expect**: error banner above submit, drafts preserved. Restart backend, click Submit again → success.

17. Navigate to `/sessions/9999` directly.
    - **Expect**: 404 fetch → "Session not found" message with link back.

18. Navigate to `/sessions/foo` directly.
    - **Expect**: redirected to `/sessions` (non-numeric id guard).

### Cross-tab consistency

19. Open `/sessions` in tab A. In tab B, create a session via the wizard.
    - **Expect**: tab A doesn't auto-refresh (TanStack Query doesn't auto-poll), but switching to tab A → click "Next" page or hover the window → if TanStack Query has `refetchOnWindowFocus` default, list updates. (This is informational, not a hard requirement.)

### Refresh / mid-wizard

20. During step 3 with drafts in progress, refresh the browser.
    - **Expect**: redirected to step 1 (page state lost). The session created at step 1 still exists in the DB — verify by navigating to `/sessions` and finding it with `playerCount` reflecting whatever attendance was set (if step 2 completed before refresh).

### TanStack invalidation

21. With DevTools network open, complete a session via the wizard.
    - **Expect**: after submit, requests visible to `POST /sessions/{id}/observations` then `GET /sessions/{id}` (detail navigation). No N+1 `GET` calls.

22. On the list page, click into a session and back. The detail query should be cached.
    - **Expect**: second visit to the same session within the cache window does not refetch (or refetches in background per `staleTime` defaults). No blank flash.

### Type strictness

23. Search the codebase for `any` in the new files:
    ```bash
    grep -rn "\bany\b" frontend/src/api/sessions.ts frontend/src/pages/NewSessionPage.tsx frontend/src/pages/SessionDetailPage.tsx frontend/src/pages/SessionsPage.tsx frontend/src/components/ObservationStep.tsx frontend/src/components/ScoreDisplay.tsx
    ```
    - **Expect**: no matches (or only matches in string literals / property names, not type positions).

---

## 9. Out of scope (do NOT add)

Per INITIAL.md and CLAUDE.md:
- No localStorage / sessionStorage for drafts.
- No `beforeunload` warning.
- No player profile / progress charts (Feature 4).
- No editing observations after submit (the wizard is one-shot; backend has upsert but the UI doesn't expose it). Re-running the wizard for an existing session is out of scope.
- No filtering or searching the sessions list (INITIAL.md doesn't ask).
- No batch-edit attendance after the session is created.
- No keyboard shortcuts (`1`–`5` to score, `Tab` to next player, etc.).
- No drag-to-reorder player tabs.
- No date range / month grouping on the list.
- No comments or JSDoc.
- No new dependencies (no date-fns, no zod, no immer). Use the existing stack only.
- No splitting of `SessionsPage.tsx` into sub-components beyond `ObservationStep` — INITIAL.md's structure is the contract.

---

## 10. Self-score

**Confidence: 9/10.**

The PRP fully specifies the data flow, state shape, payload assembly, mutation/invalidation topology, file structure, edge cases, and verification path. Existing project conventions (PlayersPage patterns, axios client behaviour, ConfirmDialog/Modal availability, Tailwind class style) are explicitly referenced so the implementer doesn't reinvent.

The 1 point of uncertainty:
- **Visual design polish.** The exact look of the score buttons (1–5 row), the player tab rail, the step indicator, and the collapsible category sections is described functionally and stylistically (Tailwind tokens, alignment with PlayersPage) but not pixel-prescribed. The implementer will make small judgment calls (button size, dot color, spacing) that aren't explicitly covered. The constraint "keep styling consistent with existing pages" plus the references to `PlayerCard` / `PlayersPage` chip palette anchor it well enough; I'm not asking for clarification.

No blocking questions. Ready for `/execute-prp`.
