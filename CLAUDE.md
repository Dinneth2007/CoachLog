# CLAUDE.md — Crick: Cricket Coaching Logbook

## Project Overview

Crick is a cricket coaching logbook for club coaches. Coaches log player technique observations session-by-session. An AI reasoning layer recommends targeted drills from a curated library based on observed weaknesses. Parents get read-only access to their child's progress via magic links.

**Target user:** Club cricket coach with 15-30 players across age groups, currently tracking in notebooks or spreadsheets.

**This is a portfolio project.** Every decision optimises for "ship a polished, CV-worthy demo." Do not add features beyond what is specified here.

---

## Tech Stack

- **Backend:** Spring Boot 3.x, Java 21, Spring Security + JWT, Spring Data JPA
- **Database:** MySQL 8
- **Frontend:** React 18+ with TypeScript (strict mode), Vite, Tailwind CSS, TanStack Query, React Router, Recharts
- **AI:** LLM via OpenAI-compatible API (structured JSON output, not free-form prose). Recommendations are cached in DB.
- **Auth:** JWT for coaches. Signed, expiring magic-link tokens for parent access.
- **Deployment:** Render (Spring Boot API + React static site + managed MySQL)

---

## Code Standards

- Java: Follow Spring Boot conventions. Service layer between controllers and repositories. DTOs for API boundaries — never expose entities directly. Validate inputs with Jakarta validation annotations.
- TypeScript: Strict mode. No `any`. Define interfaces for all API responses. Use custom hooks for data fetching via TanStack Query.
- API: RESTful. Consistent error response format: `{ error: string, details?: object }`. HTTP status codes used correctly.
- Database: All schema changes via Flyway migrations. Never modify a released migration — create a new one.
- Git: Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`). One feature per branch, squash-merge to main.

---

## Database Schema (Reference)

Core entities and their relationships. Implement via Flyway migrations.

```
Users (id, email, password_hash, name, role[COACH], created_at)
Players (id, name, age_group, coach_id → Users, notes, created_at)
Sessions (id, coach_id → Users, date, title, notes, created_at)
SessionPlayers (session_id → Sessions, player_id → Players) — junction table
PlayerObservations (id, session_id → Sessions, player_id → Players, overall_notes, created_at)
TechniqueScores (id, observation_id → PlayerObservations, category[BATTING|BOWLING|FIELDING|MATCH_AWARENESS], dimension, score[1-5], notes)
Drills (id, name, description, skill_area, target_issue, difficulty_level, equipment, age_min, age_max, duration_minutes, video_url, variations, created_at)
DrillRecommendations (id, player_id → Players, drill_id → Drills, rationale, expected_outcome, generated_at, observation_window_start, observation_window_end, is_current)
ParentAccessTokens (id, player_id → Players, token_hash, expires_at, created_at)
```

Key indexes: `(player_id, created_at)` on PlayerObservations, `(player_id, is_current)` on DrillRecommendations, `(token_hash)` on ParentAccessTokens.

---

## Technique Dimensions (Domain Reference)

Use these exact dimensions throughout the app.

**Batting:** stance, footwork, bat_path, timing, shot_selection
**Bowling:** action, line, length, variations, control
**Fielding:** catching, throwing, positioning, agility
**Match Awareness:** decision_making, communication, pressure_response

Each scored 1-5. Optional free-text note per dimension.

---

## Features — Execute in This Order

Each feature is a self-contained unit. Complete one fully (backend + frontend + tests) before moving to the next.

---

### Feature 0: Project Scaffolding

**Goal:** Both backend and frontend projects running locally with CI-ready structure.

**Backend tasks:**
- Initialise Spring Boot 3.x project with Java 21 (Maven)
- Dependencies: spring-boot-starter-web, spring-boot-starter-data-jpa, spring-boot-starter-security, spring-boot-starter-validation, mysql-connector-j, flyway-core, flyway-mysql, jjwt (io.jsonwebtoken), lombok
- `application.yml` with profiles: `dev` (local MySQL), `prod` (env vars for Render)
- Docker Compose file: MySQL 8 container for local dev
- Base entity class with `id`, `createdAt` audit fields
- Global exception handler returning consistent error format
- CORS configuration allowing frontend origin
- Health endpoint via Spring Actuator

**Frontend tasks:**
- `npm create vite@latest` with React + TypeScript template
- Install: tailwindcss, @tanstack/react-query, react-router-dom, recharts, axios
- Configure Tailwind
- Set up TanStack Query provider
- Set up React Router with placeholder routes
- API client (axios instance) with base URL from env var, JWT interceptor
- Basic app shell: sidebar/nav placeholder, main content area

**Done when:** `docker compose up` starts MySQL, Spring Boot connects and runs migrations, React app loads at localhost:5173 with routing working.

---

### Feature 1: Auth (Coach Login)

**Goal:** Coaches can register and log in. JWT-based session. Protected API routes.

**Backend tasks:**
- Flyway migration: `Users` table
- `AuthController` with `/api/auth/register` (POST) and `/api/auth/login` (POST)
- Password hashing with BCrypt
- JWT generation (access token, 24h expiry) and validation filter
- Spring Security config: `/api/auth/**` public, everything else requires JWT
- `@CurrentUser` annotation/resolver to inject authenticated user into controllers
- Register endpoint is for dev/seeding only — disable or protect in prod config

**Frontend tasks:**
- Login page (`/login`) with email + password form
- Store JWT in memory (not localStorage for security; use a ref or context). Persist via httpOnly cookie if feasible, otherwise localStorage is acceptable for portfolio scope.
- Auth context/provider: `useAuth()` hook exposing `user`, `login()`, `logout()`
- Protected route wrapper — redirect to `/login` if unauthenticated
- Auto-redirect to dashboard after login

**Done when:** Coach can register, log in, and access protected routes. Unauthenticated requests get 401.

---

### Feature 2: Player Management (CRUD)

**Goal:** Coach can create, view, edit, and delete players in their squad.

**Backend tasks:**
- Flyway migration: `Players` table
- `PlayerController`: CRUD endpoints under `/api/players`
- All queries scoped to `coach_id` from JWT — coach only sees their own players
- Search/filter by age group
- Pagination on list endpoint

**Frontend tasks:**
- Players list page (`/players`) with table/card layout
- Add player form (name, age group, optional notes)
- Edit player (inline or modal)
- Delete with confirmation
- Search/filter bar

**Done when:** Coach can manage their full squad. Players are scoped per coach.

---

### Feature 3: Session Logging (Core Feature)

**Goal:** Coach can create a session, select attendees, and log technique observations per player.

**Backend tasks:**
- Flyway migrations: `Sessions`, `SessionPlayers`, `PlayerObservations`, `TechniqueScores` tables
- `SessionController`:
  - `POST /api/sessions` — create session with date, title, optional notes
  - `POST /api/sessions/{id}/players` — attach players to session
  - `POST /api/sessions/{id}/observations` — bulk-submit observations for all players in session
  - `GET /api/sessions` — list sessions (paginated, recent first)
  - `GET /api/sessions/{id}` — full session detail with all observations
- Observation payload structure: array of `{ playerId, scores: [{ category, dimension, score, notes }], overallNotes }`
- Validate: scores 1-5, dimensions match the allowed set, players belong to coach

**Frontend tasks:**
- Session list page (`/sessions`) with date, title, player count
- New session flow:
  1. Create session (date + title) → `/sessions/new`
  2. Select attendees from squad (checkbox list) → `/sessions/{id}/attendance`
  3. Log observations per player → `/sessions/{id}/log`
- **Observation logging UX is critical.** Design for speed:
  - Tab/swipe between players
  - For each player: grid of dimensions grouped by category (batting, bowling, fielding, match awareness)
  - Each dimension: 1-5 button row (tap to score) + optional notes expandable
  - Overall notes textarea at bottom
  - Save progress per player (don't lose work if coach switches between players)
  - "Submit all" to finalise session
- Session detail view: read-only view of all observations, grouped by player

**Done when:** Coach can run through the full session logging flow for 10+ players without it feeling slow. Session data persists and is viewable.

---

### Feature 4: Player Profile & Progress View

**Goal:** Coach can view a single player's history — all observations over time, with trends visible.

**Backend tasks:**
- `GET /api/players/{id}/progress` — returns aggregated technique scores over time (per dimension, per session date)
- `GET /api/players/{id}/observations` — paginated list of all observations for this player, most recent first
- Query optimised with the `(player_id, created_at)` index

**Frontend tasks:**
- Player profile page (`/players/{id}`)
- **Trend charts** (Recharts): line chart per category showing average score over sessions. X-axis = session dates, Y-axis = score 1-5. One chart per category (batting, bowling, fielding, match awareness), each with lines per dimension.
- Observation history: expandable list of past session observations with scores and notes
- Visual indicator for improving/declining/stable trends (simple arrow icons or colour coding)

**Done when:** Coach can look at a player and immediately understand their trajectory across all technique areas.

---

### Feature 5: Drill Library

**Goal:** A searchable, filterable library of cricket drills with structured metadata.

**Backend tasks:**
- Flyway migration: `Drills` table
- `DrillController`:
  - `GET /api/drills` — list with filters (skill_area, difficulty, age group, equipment, search text)
  - `GET /api/drills/{id}` — drill detail
  - `POST /api/drills` — create drill (coach only, for future extensibility)
- Seed migration or data loader: insert 30 curated drills with full metadata

**Drill content to seed (you write these from coaching experience):**
- ~10 batting drills (front foot defence, back foot play, driving, pulling, cut shot, timing, footwork, shot selection under pressure, playing spin, playing pace)
- ~10 bowling drills (run-up rhythm, seam position, line control, length consistency, variation delivery, wrist position, follow-through, bowling to a plan, slower ball, yorker practice)
- ~5 fielding drills (high catches, flat catches, ground fielding, throwing accuracy, relay throws)
- ~5 match awareness drills (calling and running between wickets, field placement decisions, pressure simulation, communication exercises, game scenario decision-making)

Each drill must have: `name`, `description` (2-3 paragraphs on how to run it), `skill_area`, `target_issue` (specific weakness it addresses — this is what the AI matches against), `difficulty_level` (beginner/intermediate/advanced), `equipment` (list), `age_min`, `age_max`, `duration_minutes`, optional `video_url`, optional `variations` (JSON text for skill-level adaptations).

**Frontend tasks:**
- Drill library page (`/drills`) with:
  - Search bar (text search across name, description, target_issue)
  - Filter chips: skill area, difficulty, age group
  - Card grid showing drill name, skill area badge, difficulty badge, duration
- Drill detail page (`/drills/{id}`) with full information, nicely formatted
- Link from drill cards in recommendations (Feature 6) to drill detail pages

**Done when:** Coach can browse and search the drill library. Each drill has enough metadata for AI matching.

---

### Feature 6: AI-Powered Drill Recommendations

**Goal:** For each player, generate 3-5 targeted drill recommendations based on their recent observations, using the LLM as a reasoning layer over the drill library.

**Backend tasks:**
- Flyway migration: `DrillRecommendations` table
- `RecommendationService`:
  1. Fetch player's last 5 sessions' observations (scores + notes)
  2. Fetch all drills from library (or relevant subset by skill area)
  3. Build structured prompt:
     - System: "You are a cricket coaching assistant. Given a player's recent technique observations, recommend 3-5 drills from the provided library that target their most consistent weaknesses. Respond in JSON only."
     - User: Player observation data (structured) + drill library metadata (id, name, target_issue, skill_area, difficulty, age range)
     - Output schema: `[ { drillId, rationale, expectedOutcome } ]`
  4. Parse structured JSON response
  5. Validate drillIds exist in library
  6. Save recommendations to `DrillRecommendations` table, marking previous recommendations as `is_current = false`
- `RecommendationController`:
  - `POST /api/players/{id}/recommendations/generate` — trigger generation (returns recommendations)
  - `GET /api/players/{id}/recommendations` — get current recommendations
- **Cost guard:** Do not regenerate if last generation was < 24h ago unless coach explicitly requests it. Return cached recommendations by default.
- LLM call via RestTemplate/WebClient to OpenAI-compatible endpoint. API key from env var. Timeout + error handling.

**Frontend tasks:**
- Recommendations section on player profile page (`/players/{id}`)
- Display: list of recommended drills, each showing drill name (linked to drill detail), rationale text, expected outcome
- "Generate recommendations" button (disabled if generated recently, with "last generated: X" timestamp)
- Loading state during generation (LLM calls take a few seconds)
- Empty state if no observations exist yet ("Log at least one session to get recommendations")

**Prompt engineering notes:**
- Include player age group in prompt so recommendations are age-appropriate
- Include the specific scores and notes, not just averages — the LLM should see the raw signal
- Ask the LLM to explain *why* each drill targets the observed weakness — this rationale is the trust layer
- Constrain output to drills that exist in the provided library (pass drill IDs) — no hallucinated drills

**Done when:** Coach can generate drill recommendations for any player. Recommendations reference real drills with clear rationale. Results are cached and not regenerated unnecessarily.

---

### Feature 7: Parent View (Magic Link Access)

**Goal:** Parents access their child's progress via a shareable link. No account creation. Read-only.

**Backend tasks:**
- Flyway migration: `ParentAccessTokens` table
- `ParentAccessController`:
  - `POST /api/players/{id}/parent-link` — coach generates a magic link for a player (creates signed token, stores hash, 30-day expiry)
  - `GET /api/parent/view/{token}` — validates token, returns player progress data (same as player profile data but no edit capabilities)
- Token: UUID or JWT-like signed string. Store SHA-256 hash in DB, not raw token.
- Rate-limit the parent view endpoint (prevent brute-force token guessing)
- Response: player name, technique score trends, recent observations (scores only, no coach-internal notes), drill recommendations, AI-generated weekly summary

**AI weekly summary:**
- When parent view is accessed, generate (and cache for 7 days) a plain-language summary:
  - System: "You are summarising a young cricketer's recent progress for their parent. Be encouraging, specific, and actionable. 3-4 sentences. Use the player's name."
  - User: Last 3 sessions' observation data
  - Output: Plain text paragraph
- Cache in a new column or table to avoid regenerating on every parent page load

**Frontend tasks:**
- Parent view page (`/parent/{token}`) — separate route, no auth required
- Mobile-first layout (parents check on phones)
- Player name and age group header
- Trend charts (same Recharts components as coach view, reuse)
- Recent session summaries (last 3-5 sessions, scores per dimension)
- AI-generated weekly summary displayed prominently at top
- Current drill recommendations (drill name + rationale, no edit actions)
- Footer: "Powered by Crick — coaching progress by [Coach Name]"
- No navigation to other parts of the app — isolated view

**Coach-side UI:**
- On player profile, a "Share with parent" button
- Generates link, displays it with copy-to-clipboard
- Shows existing active links with expiry dates
- Revoke link option

**Done when:** Coach generates a link, sends it to a parent (WhatsApp, email — out of scope to automate), parent opens it on their phone and sees their child's progress with charts and a plain-language summary.

---

### Feature 8: Coach Dashboard

**Goal:** The home screen. Answers "what should I focus on this week?" in 10 seconds.

**Backend tasks:**
- `DashboardController`:
  - `GET /api/dashboard` — aggregated data:
    - Recent sessions (last 5) with date, title, player count
    - Players needing attention: players whose average scores in any category have declined over the last 3 sessions, or players with any dimension consistently scored ≤ 2
    - Quick stats: total players, total sessions, sessions this month
    - Upcoming: last session date (to nudge "it's been X days since your last session")

**Frontend tasks:**
- Dashboard page (`/`) — the landing page after login
- Layout sections:
  - **Welcome header** with coach name and quick stats
  - **Players needing attention** — cards with player name, the flagged issue (e.g., "Batting footwork declining"), link to player profile
  - **Recent sessions** — compact list with date, title, and player count, link to session detail
  - **Quick actions** — "Start new session", "View drill library", "View all players"
  - **Days since last session** — subtle nudge if > 7 days

**Done when:** Dashboard loads fast, surfaces the right information, and the coach can get to any key action in one click.

---

### Feature 9: Polish, Seed Data & Demo Readiness

**Goal:** The app looks and feels like a real product, not a homework assignment. A stranger can open the deployed URL and understand what it does.

**Tasks:**
- **Seed data script:** Create a seeder that populates the database with realistic demo data:
  - 1 coach account (demo@crick.app / password)
  - 15-20 players across 3 age groups (U11, U13, U15)
  - 8-10 sessions spanning 2 months with varied observations
  - Pre-generated drill recommendations for 5 players
  - 2 active parent access links for demo
- **Loading states:** Every data-fetching component has a skeleton/spinner
- **Empty states:** Every list/view has a helpful empty state ("No sessions yet — start your first one")
- **Error states:** API errors show user-friendly messages, not stack traces
- **Mobile responsiveness:** Test and fix every page at 375px width
- **Favicon and meta tags**
- **README.md:**
  - One-line description
  - Screenshot (dashboard, session logging, player profile with charts, parent view)
  - Architecture diagram (frontend → API → DB, API → LLM)
  - Tech stack with brief justification
  - "What we deliberately didn't build" section with reasoning
  - Local setup instructions (docker compose up, env vars)
  - Live demo link
  - AI integration section explaining the retrieval-augmented reasoning pattern

**Done when:** You can send the deployed URL to someone who has never seen the project, and they can log in with demo credentials, explore real-looking data, and understand what the app does — without you explaining anything.

---

## AI Integration Principles (Apply Throughout)

1. **LLM is a reasoning layer, not a content generator.** It selects from a curated library and explains why. It does not invent drills.
2. **Structured input, structured output.** Always send JSON schemas. Always parse structured responses. Never display raw LLM text without parsing.
3. **Cache everything.** Drill recommendations are stored in DB. Parent summaries are cached for 7 days. Never call the LLM on every page load.
4. **Fail gracefully.** If the LLM call fails, show cached recommendations or a clear "recommendations unavailable" state. Never break the app because the AI is down.
5. **Cost-aware.** Log token usage. Set a monthly budget alert. Rate-limit generation endpoints.

---

## Environment Variables

```
# Backend
SPRING_DATASOURCE_URL=jdbc:mysql://localhost:3306/crick
SPRING_DATASOURCE_USERNAME=crick
SPRING_DATASOURCE_PASSWORD=crick
JWT_SECRET=<random-256-bit-key>
LLM_API_KEY=<openai-or-deepseek-key>
LLM_API_URL=https://api.openai.com/v1/chat/completions
LLM_MODEL=gpt-4o-mini
PARENT_LINK_BASE_URL=https://crick.app/parent

# Frontend
VITE_API_URL=http://localhost:8080/api
```

---

## Project Structure (Target)

```
crick/
├── backend/
│   ├── src/main/java/com/crick/
│   │   ├── config/          # Security, CORS, LLM client config
│   │   ├── auth/            # AuthController, JwtService, UserEntity
│   │   ├── player/          # PlayerController, PlayerService, PlayerEntity
│   │   ├── session/         # SessionController, SessionService, entities
│   │   ├── drill/           # DrillController, DrillService, DrillEntity
│   │   ├── recommendation/  # RecommendationController, RecommendationService, LLM integration
│   │   ├── parent/          # ParentAccessController, token management
│   │   ├── dashboard/       # DashboardController, aggregation queries
│   │   └── common/          # Base entity, error handling, DTOs
│   ├── src/main/resources/
│   │   ├── db/migration/    # Flyway migrations (V1__, V2__, etc.)
│   │   └── application.yml
│   └── docker-compose.yml
├── frontend/
│   ├── src/
│   │   ├── components/      # Shared UI components
│   │   ├── pages/           # Route-level pages
│   │   ├── hooks/           # Custom hooks (useAuth, useApi, etc.)
│   │   ├── api/             # API client and typed request functions
│   │   ├── types/           # TypeScript interfaces
│   │   └── App.tsx
│   └── package.json
├── CLAUDE.md
└── README.md
```
