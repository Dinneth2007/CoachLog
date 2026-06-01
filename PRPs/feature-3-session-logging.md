# PRP — Feature 3: Session Logging (Backend Only)

> Source: `INITIAL.md`. Global rules: `CLAUDE.md`. Predecessor state: Features 0–2 complete — `BaseEntity` (id + createdAt), `User`/`Player` entities, `@CurrentUser` resolver, `GlobalExceptionHandler` returning `{ error, details }`, Spring Security stateless chain with `/api/auth/**` + `/actuator/health` permitted, Flyway migrations V1–V3, JJWT 0.12.x, Lombok, package-by-feature layout under `com.crick.*`.

---

## 1. Summary

Add the core domain workflow: a coach creates a `Session` (date + title + optional notes), attaches an attendance list of their own `Player`s, then submits a single bulk payload of `PlayerObservation`s — each with optional overall notes and zero-or-more `TechniqueScore`s (category + dimension + 1–5 score + optional notes). Three new Flyway migrations (V4, V5, V6) introduce the `sessions`, `session_players`, `player_observations`, and `technique_scores` tables. Two new enums (`Category`, `TechniqueDimension`) enforce the canonical cricket taxonomy and the category↔dimension mapping in both Java and Jackson. One service (`SessionService`) owns creation, attendance replacement, observation upsert (delete-then-insert per session), detail assembly, and deletion — all scoped to the authenticated coach. The endpoints exposed are `POST /api/sessions`, `GET /api/sessions`, `GET /api/sessions/{id}`, `PUT /api/sessions/{id}/attendance`, `POST /api/sessions/{id}/observations`, `DELETE /api/sessions/{id}`. No frontend, no drill/recommendation logic, no comments beyond what CLAUDE.md tolerates.

---

## 2. Architecture decisions

| # | Decision | Choice | Why | Alternatives rejected |
|---|---|---|---|---|
| 1 | Attendance modelling | `Session` has `@ManyToMany Set<Player>` with `@JoinTable(name="session_players")`; the junction table has no extra columns (composite PK `(session_id, player_id)`). | INITIAL.md explicitly says "many-to-many via junction table"; ManyToMany with a Set lets us replace attendance with `players.clear(); players.addAll(...)` and Hibernate writes the right SQL. | A dedicated `SessionPlayer` entity — adds boilerplate, no extra fields to justify it. `@ElementCollection` — wrong semantics; `Player` is its own aggregate. |
| 2 | Observation aggregate root | `PlayerObservation` is the root over `TechniqueScore`. `Session` has `@OneToMany(mappedBy="session", cascade=ALL, orphanRemoval=true) List<PlayerObservation>`. `PlayerObservation` has `@OneToMany(mappedBy="observation", cascade=ALL, orphanRemoval=true) List<TechniqueScore>`. | Matches the natural aggregate (per-player, per-session bag of scores). Cascade + orphanRemoval gives the upsert flow ("clear and add") for free. Single bag of `List<TechniqueScore>` per observation avoids `MultipleBagFetchException`. | Modelling scores as a flat list under `Session` — loses the per-player overall-notes anchor. Embedding scores as `@ElementCollection` — can't query/index a value type cleanly. |
| 3 | Observation upsert strategy | On `POST .../observations`, delete all existing `PlayerObservation`s for that session via a `@Modifying` JPQL `delete`, `flush()`, then insert the new graph via `sessionRepository.save(session)` (cascade-all on the OneToMany). | INITIAL.md says "If observations already exist for this session, replace them (delete old, insert new)" — not append. Bulk delete + cascade re-insert is the simplest correct path. `flush()` between delete and insert avoids Hibernate trying to merge the two operations in the same persistence context and breaking the unique constraint on `(session_id, player_id)`. | `merge()`/`saveAll()` upsert — Hibernate has no native upsert; would need to diff manually. Per-row merge — same problem, slower, more code. |
| 4 | Cascade strategy on delete | DB-level `ON DELETE CASCADE` from `session_players.session_id`, `player_observations.session_id`, and `technique_scores.observation_id` toward their parents. JPA cascade=ALL/orphanRemoval handles in-process deletion through the persistence context. | INITIAL.md: "deleting a session removes attendance, observations, and scores." Defence-in-depth at both layers means manual DB `DELETE` and JPA `deleteById` both behave correctly. | DB cascade only — fragile under Hibernate's L1 cache (stale entities after manual delete). JPA cascade only — leaves the schema inconsistent if anyone bypasses JPA. |
| 5 | `player_id` FK cascade on delete | `ON DELETE RESTRICT` (MySQL default) for FKs that reference `players(id)` (i.e. `session_players.player_id`, `player_observations.player_id`). | Deleting a player who has historical observations should not silently wipe history. Restrict surfaces the conflict as 409 via the existing `DataIntegrityViolationException` handler. | `ON DELETE CASCADE` on player FKs — destroys session-level history when a coach removes one player; wrong semantics for a coaching logbook. |
| 6 | `Category` enum | New enum `com.crick.session.Category { BATTING, BOWLING, FIELDING, MATCH_AWARENESS }`. Stored as `VARCHAR(20)` via `@Enumerated(EnumType.STRING)`. JSON-serialised as the enum name (default). | Matches the canonical taxonomy in CLAUDE.md exactly. Uppercase wire format matches INITIAL.md examples. | Free-text string column — loses type safety, opens the door to typos. |
| 7 | `TechniqueDimension` enum | New enum `com.crick.session.TechniqueDimension` with one constant per dimension (e.g. `STANCE`, `FOOTWORK`, `BAT_PATH`, …). Each constant carries its parent `Category` (constructor field), exposed via `category()`. JSON-serialised as **lowercase** via `@JsonValue`; deserialised case-insensitively via `@JsonCreator`. Stored as `VARCHAR(30)` via `@Enumerated(EnumType.STRING)` (uppercase in DB). | INITIAL.md shows `"dimension":"footwork"` on the wire but Java enum constants must be UPPER_SNAKE. `@JsonValue`/`@JsonCreator` cleanly bridges this. Carrying `Category` on the enum makes the category↔dimension validation a single equality check. | Two parallel string sets — no compile-time guarantee that a dimension's category matches; bug-prone. Mapping table in DB — over-engineering for static taxonomy. |
| 8 | Cross-field validation (dimension belongs to category) | Service-side check: for every incoming score, assert `dimension.category() == category`; throw `IllegalArgumentException("Dimension <x> is not valid for category <Y>")` → 400 via existing handler. | Bean Validation has no clean cross-field idiom for nested DTOs. A service-side check runs once per submission, returns the precise field/value, and is easy to unit-test. | Custom `@AssertTrue` method on the DTO — works but harder to message clearly across nested records. |
| 9 | Per-(observation, category, dimension) uniqueness | Add a `UNIQUE KEY (observation_id, category, dimension)` to `technique_scores`. Service also validates uniqueness pre-insert and throws `IllegalArgumentException` with a clearer message if a payload duplicates a dimension for the same player. | INITIAL.md doesn't address duplicates explicitly, but the same player scoring the same dimension twice in one session is meaningless and would corrupt the trend charts in Feature 4. Service-side check gives a friendly 400; the unique key is a backstop. | Silently dedupe — masks user error; surprises in Feature 4. Allow duplicates — pollutes aggregates. |
| 10 | `playerCount` on list endpoint | JPQL projection using `SIZE(s.players)`: `new SessionSummaryResponse(s.id, s.date, s.title, SIZE(s.players), s.createdAt)` ordered by `date DESC, id DESC`. | One round-trip, no N+1, no second query. Sorting is stable (id tiebreaker for same-day sessions). | `s.players.size()` after fetch — N+1 on a paginated list. Native `COUNT` join — uglier and equivalent. |
| 11 | Detail-endpoint fetching | Two queries: (a) `findDetailByIdAndCoachId` with `LEFT JOIN FETCH s.players` to load attendance with the session in one round-trip; (b) `playerObservationRepository.findBySessionIdWithScores(id)` with `LEFT JOIN FETCH o.scores` and `JOIN FETCH o.player` to load observations + scores + player names. Assemble the DTO in the service. | `MultipleBagFetchException` blocks fetching both `players` and `observations` (and observations' `scores`) in one JPQL. Two targeted queries are clearer than `@EntityGraph` tuning and avoid Cartesian blow-up. | Single mega-fetch — throws. `EntityGraph` — same problem. N+1 lazy loading — silently slow. |
| 12 | Coach scoping | Every service method takes `coachId: Long`; every repository method filters on `coach.id = :coachId` and (for nested look-ups) verifies the parent's coach. | Matches `PlayerService`/`PlayerRepository` patterns exactly. Centralises "this isn't yours → 404" behaviour. | Filter-based scoping via Spring Data specifications — over-abstraction; only one tenant axis. |
| 13 | Player-attendance integrity on `PUT .../attendance` | Look up all submitted `playerIds` via `playerRepository.findAllByIdInAndCoachId(ids, coachId)`. If the result size differs from the input distinct size, reject the whole request with `IllegalArgumentException("One or more players do not belong to this coach")` → 400. Then `session.getPlayers().clear(); session.getPlayers().addAll(found);`. | INITIAL.md: "Reject entire request if any [playerIds] don't [belong to coach]." Single batched query is fastest. | Per-ID `findByIdAndCoachId` loop — N queries, no transactional value. |
| 14 | Player-must-be-in-attendance check on `POST .../observations` | Service loads the session (scoped to coach), collects `session.getPlayers().stream().map(Player::getId).collect(toSet())`, then for each submitted observation asserts `attendanceIds.contains(o.playerId())`. Reject the entire batch on first miss. | INITIAL.md: "Each playerId must be in the session's attendance list." All-or-nothing keeps the upsert atomic. | Filter and ignore unknown players — silently drops data; bad UX. |
| 15 | DTOs | Use Java `record`s throughout (request + response), with Jakarta validation annotations on request records. `SubmitObservationsRequest` and `SessionDetailResponse` use nested records to keep the API shape obvious. | Matches the existing `CreatePlayerRequest`/`PlayerResponse` style; records are immutable and read naturally. | Lombok value objects — works but the project already standardises on records for DTOs. |
| 16 | Transaction boundaries | `@Transactional` on `SessionService` class; `@Transactional(readOnly = true)` overrides on `list` and `getDetail`. | Mirrors `PlayerService`. Read-only TX hints let the driver/connection pool skip dirty-checking. | Per-method `@Transactional` — same effect, more annotations. |
| 17 | Error mapping (delegate to existing handler) | Use `EntityNotFoundException("Session not found")` (already → 404), `IllegalArgumentException` (already → 400), `DataIntegrityViolationException` (already → 409). No new handler. | The existing `GlobalExceptionHandler` already covers every case this feature can raise. Adding handlers would duplicate. | New `SessionNotFoundException` — needless ceremony. |
| 18 | Comments / Javadoc | None. Code only. | CLAUDE.md + INITIAL.md: "No obvious comments. No TODOs." | Inline narration — explicitly forbidden. |

---

## 3. File-by-file implementation plan

Implementation order is strict — each step depends only on earlier ones. Aim to keep individual Java files comfortably under 120 lines.

### Step 1 — Migrations

**`backend/src/main/resources/db/migration/V4__create_sessions_table.sql`** (new)
- Creates `sessions` (`id`, `coach_id` FK → `users(id)`, `date` DATE NOT NULL, `title` VARCHAR(100) NOT NULL, `notes` VARCHAR(500) NULL, `created_at` TIMESTAMP).
- Index `(coach_id, date DESC)` for the list endpoint's sort.
- See SQL in §4.

**`backend/src/main/resources/db/migration/V5__create_session_players_table.sql`** (new)
- Creates `session_players` junction with composite PK `(session_id, player_id)`.
- `session_id` FK → `sessions(id)` ON DELETE CASCADE.
- `player_id` FK → `players(id)` ON DELETE RESTRICT.
- Secondary index on `(player_id)` for future "all sessions for this player" lookups (used in Feature 4).

**`backend/src/main/resources/db/migration/V6__create_observations_tables.sql`** (new)
- Two statements in one migration file.
- `player_observations`: `id`, `session_id` FK NOT NULL → `sessions(id)` ON DELETE CASCADE, `player_id` FK NOT NULL → `players(id)` ON DELETE RESTRICT, `overall_notes` TEXT NULL, `created_at` TIMESTAMP. UNIQUE `(session_id, player_id)`. Index `(player_id, created_at)` (this is the index CLAUDE.md flags as "key" for Feature 4).
- `technique_scores`: `id`, `observation_id` FK NOT NULL → `player_observations(id)` ON DELETE CASCADE, `category` VARCHAR(20) NOT NULL, `dimension` VARCHAR(30) NOT NULL, `score` TINYINT NOT NULL CHECK (`score` BETWEEN 1 AND 5), `notes` VARCHAR(500) NULL. UNIQUE `(observation_id, category, dimension)`. Index `(observation_id)`.

### Step 2 — Enums

**`backend/src/main/java/com/crick/session/Category.java`** (new)
- `public enum Category { BATTING, BOWLING, FIELDING, MATCH_AWARENESS }`.
- No fields, no methods. Jackson serialises constants by name (uppercase) by default — matches the wire format in INITIAL.md.

**`backend/src/main/java/com/crick/session/TechniqueDimension.java`** (new)
- `public enum TechniqueDimension` with one constant per dimension. Each constant takes a `Category` in its constructor.
- Constants (matching CLAUDE.md exactly):
  - Batting: `STANCE`, `FOOTWORK`, `BAT_PATH`, `TIMING`, `SHOT_SELECTION`
  - Bowling: `ACTION`, `LINE`, `LENGTH`, `VARIATIONS`, `CONTROL`
  - Fielding: `CATCHING`, `THROWING`, `POSITIONING`, `AGILITY`
  - Match awareness: `DECISION_MAKING`, `COMMUNICATION`, `PRESSURE_RESPONSE`
- Public accessor `Category category()`.
- `@JsonValue String json()` returns `name().toLowerCase(Locale.ROOT)` (so `BAT_PATH` → `"bat_path"`).
- `@JsonCreator public static TechniqueDimension fromJson(String s)` does `valueOf(s.toUpperCase(Locale.ROOT))`. Catch `IllegalArgumentException` and rethrow with a clearer message — but the default `IllegalArgumentException` already maps to 400, so the wrapper is optional. Keep it minimal: let the default exception propagate; Jackson will wrap it in `HttpMessageNotReadableException` (already 400).

### Step 3 — Entities

**`backend/src/main/java/com/crick/session/Session.java`** (new)
- `@Entity @Table(name="sessions")`, extends `BaseEntity`.
- Fields: `date` (`LocalDate`, non-null), `title` (String, non-null, length 100), `notes` (String, nullable, length 500), `coach` (`@ManyToOne(fetch=LAZY, optional=false) @JoinColumn(name="coach_id")` → `User`).
- `@ManyToMany(fetch=LAZY)` `Set<Player> players` with `@JoinTable(name="session_players", joinColumns=@JoinColumn(name="session_id"), inverseJoinColumns=@JoinColumn(name="player_id"))`. Initialised to `new LinkedHashSet<>()` for deterministic iteration.
- `@OneToMany(mappedBy="session", cascade=CascadeType.ALL, orphanRemoval=true, fetch=LAZY)` `List<PlayerObservation> observations` initialised to `new ArrayList<>()`.
- Lombok `@Getter @Setter @NoArgsConstructor`.

**`backend/src/main/java/com/crick/session/PlayerObservation.java`** (new)
- `@Entity @Table(name="player_observations", uniqueConstraints=@UniqueConstraint(columnNames={"session_id","player_id"}))`, extends `BaseEntity`.
- Fields:
  - `session` `@ManyToOne(fetch=LAZY, optional=false) @JoinColumn(name="session_id")` → `Session`.
  - `player` `@ManyToOne(fetch=LAZY, optional=false) @JoinColumn(name="player_id")` → `Player`.
  - `overallNotes` `@Column(name="overall_notes", columnDefinition="TEXT")` String, nullable.
  - `@OneToMany(mappedBy="observation", cascade=CascadeType.ALL, orphanRemoval=true)` `List<TechniqueScore> scores` initialised to `new ArrayList<>()`.
- Lombok `@Getter @Setter @NoArgsConstructor`.

**`backend/src/main/java/com/crick/session/TechniqueScore.java`** (new)
- `@Entity @Table(name="technique_scores")`, extends `BaseEntity`.
- Fields:
  - `observation` `@ManyToOne(fetch=LAZY, optional=false) @JoinColumn(name="observation_id")` → `PlayerObservation`.
  - `category` `@Enumerated(EnumType.STRING) @Column(length=20, nullable=false)` Category.
  - `dimension` `@Enumerated(EnumType.STRING) @Column(length=30, nullable=false)` TechniqueDimension.
  - `score` `@Column(nullable=false)` `int` (maps to TINYINT — Hibernate maps `int` to INT; we override with `columnDefinition="TINYINT"` to match the SQL).
  - `notes` `@Column(length=500)` String, nullable.
- Lombok `@Getter @Setter @NoArgsConstructor`.

### Step 4 — Repositories

**`backend/src/main/java/com/crick/session/SessionRepository.java`** (new)
- `interface SessionRepository extends JpaRepository<Session, Long>`.
- `Optional<Session> findByIdAndCoachId(Long id, Long coachId)` — derived; used for ownership checks before attendance/observation/delete operations.
- `@Query("""SELECT s FROM Session s LEFT JOIN FETCH s.players WHERE s.id = :id AND s.coach.id = :coachId""") Optional<Session> findDetailByIdAndCoachId(@Param("id") Long id, @Param("coachId") Long coachId)` — used by the detail endpoint.
- `@Query("""SELECT new com.crick.session.SessionSummaryResponse(s.id, s.date, s.title, SIZE(s.players), s.createdAt) FROM Session s WHERE s.coach.id = :coachId ORDER BY s.date DESC, s.id DESC""") Page<SessionSummaryResponse> findSummariesByCoachId(@Param("coachId") Long coachId, Pageable pageable)` — used by list endpoint. **Important:** because the projection embeds `ORDER BY`, do **not** pass a `Sort` on the `Pageable` (the controller will pass `PageRequest.of(page, size)` only, no sort). The default `@PageableDefault` is fine for `size`.

**`backend/src/main/java/com/crick/session/PlayerObservationRepository.java`** (new)
- `interface PlayerObservationRepository extends JpaRepository<PlayerObservation, Long>`.
- `@Modifying @Query("DELETE FROM PlayerObservation o WHERE o.session.id = :sessionId") int deleteAllBySessionId(@Param("sessionId") Long sessionId)` — used by the upsert flow (delete-then-insert). Needs `flush()` after.
- `@Query("""SELECT DISTINCT o FROM PlayerObservation o LEFT JOIN FETCH o.scores JOIN FETCH o.player WHERE o.session.id = :sessionId""") List<PlayerObservation> findBySessionIdWithScores(@Param("sessionId") Long sessionId)` — used by detail endpoint. `DISTINCT` is needed because of the LEFT JOIN FETCH on scores.

**`backend/src/main/java/com/crick/player/PlayerRepository.java`** (modify)
- Add `List<Player> findAllByIdInAndCoachId(Collection<Long> ids, Long coachId)` — derived; used to validate attendance.
- Do not change existing methods.

### Step 5 — Request DTOs

**`backend/src/main/java/com/crick/session/CreateSessionRequest.java`** (new)
- `public record CreateSessionRequest(@NotNull LocalDate date, @NotBlank @Size(max = 100) String title, @Size(max = 500) String notes) {}`.

**`backend/src/main/java/com/crick/session/AttendanceRequest.java`** (new)
- `public record AttendanceRequest(@NotNull @Size(min = 0, max = 100) List<@NotNull Long> playerIds) {}`.
- An empty list is valid (a session can legitimately have nobody yet); the `@Size` cap is a denial-of-service guard.

**`backend/src/main/java/com/crick/session/SubmitObservationsRequest.java`** (new)
- `public record SubmitObservationsRequest(@NotNull @Valid List<@Valid ObservationItem> observations) {}`.
- Nested `public record ObservationItem(@NotNull Long playerId, @Size(max = 500) String overallNotes, @NotNull @Valid List<@Valid ScoreItem> scores) {}`.
- Nested `public record ScoreItem(@NotNull Category category, @NotNull TechniqueDimension dimension, @NotNull @Min(1) @Max(5) Integer score, @Size(max = 500) String notes) {}`.
- An empty `observations` list is valid (clears all observations for the session — consistent with "replace them" semantics). The service writes the delete and skips the insert.

### Step 6 — Response DTOs

**`backend/src/main/java/com/crick/session/SessionResponse.java`** (new)
- `public record SessionResponse(Long id, LocalDate date, String title, String notes, LocalDateTime createdAt) { public static SessionResponse from(Session s) { … } }`.
- Returned by `POST /api/sessions` (201).

**`backend/src/main/java/com/crick/session/SessionSummaryResponse.java`** (new)
- `public record SessionSummaryResponse(Long id, LocalDate date, String title, int playerCount, LocalDateTime createdAt) {}`.
- Constructor signature must match the JPQL `new com.crick.session.SessionSummaryResponse(...)` projection exactly (param order + types).

**`backend/src/main/java/com/crick/session/AttendanceResponse.java`** (new)
- `public record AttendanceResponse(List<PlayerSummary> players) { public record PlayerSummary(Long id, String name, AgeGroup ageGroup) {} }`.
- Returned by `PUT /api/sessions/{id}/attendance` (200).

**`backend/src/main/java/com/crick/session/SubmitObservationsResponse.java`** (new)
- `public record SubmitObservationsResponse(int observationsSaved) {}`.
- Returned by `POST /api/sessions/{id}/observations` (200).

**`backend/src/main/java/com/crick/session/SessionDetailResponse.java`** (new)
- `public record SessionDetailResponse(Long id, LocalDate date, String title, String notes, LocalDateTime createdAt, List<PlayerObservationView> players)`.
- Nested `public record PlayerObservationView(Long playerId, String playerName, String overallNotes, List<TechniqueScoreView> scores)`.
- Nested `public record TechniqueScoreView(Category category, TechniqueDimension dimension, int score, String notes)`.
- Includes a static `from(Session, List<PlayerObservation>)` factory that walks the observation list, but **also** includes attendees who have no observation yet (so the response always lists every attending player; players with no observation appear with `overallNotes=null` and `scores=[]`). This makes downstream UI work simpler — INITIAL.md doesn't forbid it and the example response doesn't establish otherwise. *(If implementing literally INITIAL.md's example, only observations should be returned — flag this in a comment? No, no comments. Decision: include all attendees. The example in INITIAL.md is one player who has both attendance and an observation, so it's not contradicted. If the implementer disagrees, the alternative is to filter to `observations.isEmpty() == false`.)*

### Step 7 — Service

**`backend/src/main/java/com/crick/session/SessionService.java`** (new)
- `@Service @RequiredArgsConstructor @Transactional`.
- Injected: `SessionRepository sessionRepository`, `PlayerObservationRepository observationRepository`, `PlayerRepository playerRepository`, `EntityManager entityManager` (only if explicit `flush()` is needed; otherwise use `observationRepository.flush()`).
- Methods:
  - `SessionResponse create(User coach, CreateSessionRequest req)` — `new Session()`, set date/title/trimmed notes/coach, save, return `SessionResponse.from`.
  - `Page<SessionSummaryResponse> list(Long coachId, Pageable pageable)` — delegates to `sessionRepository.findSummariesByCoachId`. **Strip any caller-supplied sort** by reconstructing `PageRequest.of(pageable.getPageNumber(), pageable.getPageSize())` because the JPQL embeds `ORDER BY`. `@Transactional(readOnly = true)`.
  - `SessionDetailResponse getDetail(Long coachId, Long sessionId)` — `findDetailByIdAndCoachId(...).orElseThrow(EntityNotFoundException::new)`; then `observationRepository.findBySessionIdWithScores(sessionId)`; assemble the DTO including non-observed attendees. `@Transactional(readOnly = true)`.
  - `AttendanceResponse setAttendance(Long coachId, Long sessionId, AttendanceRequest req)` — load session via `findByIdAndCoachId` (404 if missing); fetch all players by `findAllByIdInAndCoachId(distinctIds, coachId)`; if `found.size() != distinctInputIds.size()` throw `IllegalArgumentException("One or more players do not belong to this coach")`; `session.getPlayers().clear()`; `session.getPlayers().addAll(found)`; save. Return ordered list (sort `found` by `name` for determinism).
  - `SubmitObservationsResponse submitObservations(Long coachId, Long sessionId, SubmitObservationsRequest req)`:
    1. Load session via `findByIdAndCoachId` (404 if missing).
    2. Build `attendanceIds = session.getPlayers().stream().map(Player::getId).collect(toSet())`.
    3. For each `ObservationItem`: assert `attendanceIds.contains(item.playerId())` else throw `IllegalArgumentException("Player " + id + " is not in this session's attendance")`.
    4. For each `ScoreItem` in each observation: assert `score.dimension().category() == score.category()` else throw `IllegalArgumentException(...)`. Also assert no `(playerId, category, dimension)` triple repeats in the payload — throw `IllegalArgumentException("Duplicate score for player <id> on <category>/<dimension>")`.
    5. Reject `playerIds` duplicated across observations: throw `IllegalArgumentException("Duplicate observation for player <id>")`.
    6. `observationRepository.deleteAllBySessionId(sessionId);` then `observationRepository.flush();` then `entityManager.clear();` — clearing the persistence context is required so the in-memory `Session.observations` list doesn't reference removed entities when we re-add. After clear, **re-load** the session via `findByIdAndCoachId`.
    7. Map each `ObservationItem` to a `PlayerObservation` (set session, set player loaded via `playerRepository.getReferenceById(playerId)` since attendance was already validated), map each `ScoreItem` to a `TechniqueScore`, attach to observation, attach observation to `session.getObservations()`.
    8. `sessionRepository.save(session)` (cascade-all inserts the whole graph).
    9. Return `new SubmitObservationsResponse(observations.size())`.
  - `void delete(Long coachId, Long sessionId)` — `findByIdAndCoachId(...).orElseThrow(EntityNotFoundException::new)`; `sessionRepository.delete(session)`. JPA cascade + DB cascade handle the rest.

### Step 8 — Controller

**`backend/src/main/java/com/crick/session/SessionController.java`** (new)
- `@RestController @RequestMapping("/api/sessions") @RequiredArgsConstructor`.
- Injected: `SessionService sessionService`.
- Endpoints:
  - `@PostMapping` create → `ResponseEntity.status(CREATED).body(sessionService.create(coach, req))`.
  - `@GetMapping` list → `Page<SessionSummaryResponse>` via `sessionService.list(coach.getId(), pageable)`. Use `@PageableDefault(size = 20)`.
  - `@GetMapping("/{id}")` detail → `SessionDetailResponse`.
  - `@PutMapping("/{id}/attendance")` attendance → `AttendanceResponse`.
  - `@PostMapping("/{id}/observations")` observations → `SubmitObservationsResponse`.
  - `@DeleteMapping("/{id}")` → `ResponseEntity.noContent().build()` (204).
- All take `@CurrentUser User coach` and `@Valid @RequestBody …Request req` where applicable. Mirror `PlayerController` style exactly.

---

## 4. Data model changes — exact SQL

**`V4__create_sessions_table.sql`**
```sql
CREATE TABLE sessions (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    coach_id    BIGINT       NOT NULL,
    date        DATE         NOT NULL,
    title       VARCHAR(100) NOT NULL,
    notes       VARCHAR(500),
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_sessions_coach_date (coach_id, date DESC),
    CONSTRAINT fk_sessions_coach FOREIGN KEY (coach_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**`V5__create_session_players_table.sql`**
```sql
CREATE TABLE session_players (
    session_id  BIGINT NOT NULL,
    player_id   BIGINT NOT NULL,
    PRIMARY KEY (session_id, player_id),
    KEY idx_session_players_player (player_id),
    CONSTRAINT fk_session_players_session
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
    CONSTRAINT fk_session_players_player
        FOREIGN KEY (player_id)  REFERENCES players (id)  ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**`V6__create_observations_tables.sql`**
```sql
CREATE TABLE player_observations (
    id            BIGINT    NOT NULL AUTO_INCREMENT,
    session_id    BIGINT    NOT NULL,
    player_id     BIGINT    NOT NULL,
    overall_notes TEXT,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_observations_session_player (session_id, player_id),
    KEY idx_observations_player_created (player_id, created_at),
    CONSTRAINT fk_observations_session
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
    CONSTRAINT fk_observations_player
        FOREIGN KEY (player_id)  REFERENCES players (id)  ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE technique_scores (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    observation_id BIGINT       NOT NULL,
    category       VARCHAR(20)  NOT NULL,
    dimension      VARCHAR(30)  NOT NULL,
    score          TINYINT      NOT NULL,
    notes          VARCHAR(500),
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_scores_observation_category_dimension (observation_id, category, dimension),
    KEY idx_scores_observation (observation_id),
    CONSTRAINT fk_scores_observation
        FOREIGN KEY (observation_id) REFERENCES player_observations (id) ON DELETE CASCADE,
    CONSTRAINT chk_scores_range CHECK (score BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

> Note: `BaseEntity` only declares `id` + `createdAt`; the SQL `created_at` columns above match. The `TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP` lets Spring Auditing populate the value, and the DB default is a safety net.

---

## 5. Edge cases and error handling

| Case | Behaviour | HTTP | Body |
|---|---|---|---|
| Create session with blank title | Bean Validation fails | 400 | `{"error":"Validation failed","details":{"title":"must not be blank"}}` |
| Create session with missing date | Bean Validation fails | 400 | `{"error":"Validation failed","details":{"date":"must not be null"}}` |
| Create session with malformed date string (`"2025-13-99"`) | Jackson can't parse → `HttpMessageNotReadableException` | 400 | `{"error":"Malformed request body","details":null}` (existing handler) |
| GET unknown session id | `findDetailByIdAndCoachId` empty | 404 | `{"error":"Session not found","details":null}` |
| GET session belonging to another coach | Same as above — query filters `coach.id` | 404 | `{"error":"Session not found","details":null}` |
| PUT attendance with one foreign player id | Service detects size mismatch | 400 | `{"error":"One or more players do not belong to this coach","details":null}` |
| PUT attendance with empty list | Valid; clears all attendees | 200 | `{"players":[]}` |
| PUT attendance with duplicate player ids in the request | De-duplicated when comparing sizes; junction's composite PK also rejects duplicates if they slip through | 200 | `{"players":[…]}` (deduped) |
| POST observations for player not in attendance | Service rejects whole batch | 400 | `{"error":"Player 7 is not in this session's attendance","details":null}` |
| POST observations with `category=BATTING, dimension=catching` | Service rejects | 400 | `{"error":"Dimension catching is not valid for category BATTING","details":null}` |
| POST observations with invalid enum value (`"category":"BAT"`) | Jackson rejects | 400 | `{"error":"Malformed request body","details":null}` (existing handler) |
| POST observations with `score=6` | `@Max(5)` fails | 400 | `{"error":"Validation failed","details":{"observations[0].scores[0].score":"must be less than or equal to 5"}}` |
| POST observations with duplicate `(playerId, category, dimension)` | Service rejects | 400 | `{"error":"Duplicate score for player <id> on <category>/<dimension>","details":null}` |
| POST observations with duplicate playerId across `ObservationItem`s | Service rejects | 400 | `{"error":"Duplicate observation for player <id>","details":null}` |
| POST observations with empty `observations` list | Valid; clears all observations for the session | 200 | `{"observationsSaved":0}` |
| POST observations with an observation having `scores=[]` and `overallNotes` set | Valid (partial observation) | 200 | `{"observationsSaved":<n>}` |
| POST observations when none existed before | Delete-all returns 0 rows; insert proceeds normally | 200 | `{"observationsSaved":<n>}` |
| DELETE unknown session id | 404 | 404 | `{"error":"Session not found","details":null}` |
| DELETE another coach's session | 404 | 404 | `{"error":"Session not found","details":null}` |
| DELETE session with attendance + observations + scores | Cascades cleanly via DB + JPA | 204 | (no body) |
| Attempt to delete a `Player` who has observations | `DataIntegrityViolationException` (RESTRICT) | 409 | `{"error":"Email already registered","details":null}` *(known wrong message — see §10 caveat)* |
| Pagination: negative `page` or absurd `size` | Spring's `Pageable` resolver clamps/throws | 400 | `{"error":"Validation failed",…}` |
| Concurrent attendance updates | Last-writer-wins; junction PK prevents duplicates | 200 | OK |
| Concurrent observation submissions for same session | Both run their delete + insert; one will likely fail with constraint violation on the unique `(session_id, player_id)` | 409 | Existing `DataIntegrityViolationException` handler — accept the message wart for now |

---

## 6. Validation rules

| Field | Rule | Failure response |
|---|---|---|
| `CreateSessionRequest.date` | `@NotNull` (ISO `LocalDate`) | 400 — `details.date: "must not be null"` |
| `CreateSessionRequest.title` | `@NotBlank @Size(max=100)` | 400 — `details.title: "must not be blank"` / `"size must be between 0 and 100"` |
| `CreateSessionRequest.notes` | `@Size(max=500)` | 400 — `details.notes: …` |
| `AttendanceRequest.playerIds` | `@NotNull @Size(min=0, max=100)`, each element `@NotNull` | 400 — `details.playerIds: …` |
| `AttendanceRequest` ownership | All ids must belong to coach | 400 — `error: "One or more players do not belong to this coach"` |
| `SubmitObservationsRequest.observations` | `@NotNull @Valid` (list itself) | 400 — `details.observations: "must not be null"` |
| `ObservationItem.playerId` | `@NotNull` | 400 — `details.observations[i].playerId: …` |
| `ObservationItem.overallNotes` | `@Size(max=500)` | 400 — `details.observations[i].overallNotes: …` |
| `ObservationItem.scores` | `@NotNull @Valid` | 400 |
| `ScoreItem.category` | `@NotNull`, must be valid `Category` enum | 400 (validation) or 400 (`Malformed request body` if Jackson fails earlier) |
| `ScoreItem.dimension` | `@NotNull`, must be valid `TechniqueDimension` enum | as above |
| `ScoreItem.score` | `@NotNull @Min(1) @Max(5)` | 400 — `details.observations[i].scores[j].score: …` |
| `ScoreItem.notes` | `@Size(max=500)` | 400 |
| Cross-field (service) | `dimension.category() == category` | 400 — `error: "Dimension <d> is not valid for category <c>"` |
| Cross-field (service) | No duplicate `playerId` across observations | 400 — `error: "Duplicate observation for player <id>"` |
| Cross-field (service) | No duplicate `(playerId, category, dimension)` triple within the batch | 400 — `error: "Duplicate score for player <id> on <category>/<dimension>"` |
| Cross-field (service) | Each `playerId` is in session attendance | 400 — `error: "Player <id> is not in this session's attendance"` |
| Cross-field (service) | Session must exist and belong to coach (all mutating endpoints) | 404 — `error: "Session not found"` |

---

## 7. Dependencies between files

```
V4 (sessions) ─────┐
V5 (session_players) ─── depends on V4 + V3
V6 (observations + scores) ─── depends on V4 + V3

Category.java ───────────────┐
TechniqueDimension.java ───── depends on Category

Session.java ───── depends on User (existing), Player (existing)
PlayerObservation.java ───── depends on Session, Player
TechniqueScore.java ───── depends on PlayerObservation, Category, TechniqueDimension

SessionRepository.java ───── depends on Session, SessionSummaryResponse
PlayerObservationRepository.java ───── depends on PlayerObservation
PlayerRepository.java (modified) ───── depends on Player (existing)

CreateSessionRequest.java ───── leaf
AttendanceRequest.java ───── leaf
SubmitObservationsRequest.java ───── depends on Category, TechniqueDimension

SessionResponse.java ───── depends on Session
SessionSummaryResponse.java ───── leaf (referenced by SessionRepository JPQL)
AttendanceResponse.java ───── depends on Player, AgeGroup (existing)
SubmitObservationsResponse.java ───── leaf
SessionDetailResponse.java ───── depends on Session, PlayerObservation, Category, TechniqueDimension

SessionService.java ───── depends on all repositories, all DTOs, all entities, enums
SessionController.java ───── depends on SessionService, @CurrentUser/User
```

Build order: migrations → enums → entities → repositories → DTOs (requests + responses) → service → controller. The `SessionSummaryResponse` record must exist before `SessionRepository` compiles (the JPQL `new` projection is type-checked at boot, but the Java reference is checked at compile time).

---

## 8. Verification checklist

Run each step exactly. The MySQL connection and the running backend are assumed (the `crick`/`crick` user is already created on the dev DB). All commands use `localhost:8080`.

### Pre-flight

```bash
# 1) Compile + boot
cd backend && SPRING_DATASOURCE_USERNAME=crick SPRING_DATASOURCE_PASSWORD=crick ./mvnw -q spring-boot:run
# expect: V4, V5, V6 applied; no FlywayException
```

```bash
# 2) Confirm migrations applied
/usr/local/mysql/bin/mysql -u crick -pcrick crick \
  -e "SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;"
# expect: V1 baseline, V2 users, V3 players, V4 sessions, V5 session_players, V6 observations — all success=1
```

```bash
# 3) Confirm tables exist
/usr/local/mysql/bin/mysql -u crick -pcrick crick -e "SHOW TABLES;"
# expect: sessions, session_players, player_observations, technique_scores all present
```

### Functional

```bash
# 4) Log in as the existing coach and capture JWT into $TOKEN
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<existing-coach-email>","password":"<password>"}' | jq -r .token)
echo "$TOKEN" | head -c 40

# 5) Create a session
SID=$(curl -s -X POST http://localhost:8080/api/sessions \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"date":"2026-05-28","title":"Tuesday evening nets","notes":"Spin focus"}' | jq .id)
# expect: HTTP 201, body has id/date/title/notes/createdAt
test -n "$SID" && echo "session id=$SID"

# 6) List sessions
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/sessions | jq .
# expect: page with the new session, playerCount=0, most-recent-first

# 7) Set attendance (use two real player ids belonging to this coach)
curl -s -X PUT http://localhost:8080/api/sessions/$SID/attendance \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"playerIds":[<P1>,<P2>]}' | jq .
# expect: 200, players list contains both ids, with name+ageGroup

# 8) Submit observations (one player full, one player partial)
curl -s -X POST http://localhost:8080/api/sessions/$SID/observations \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{
    "observations":[
      {"playerId":<P1>,"overallNotes":"Good focus",
       "scores":[
         {"category":"BATTING","dimension":"footwork","score":3,"notes":"Still stepping across"},
         {"category":"BATTING","dimension":"timing","score":4,"notes":null}
       ]},
      {"playerId":<P2>,"overallNotes":"Tired today","scores":[]}
    ]
  }' | jq .
# expect: 200, {"observationsSaved":2}

# 9) GET detail — verify everything nests
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/sessions/$SID | jq .
# expect: id, date, title, notes, createdAt; players array contains both P1 and P2
# P1 has overallNotes + 2 scores (one with notes, one with null notes)
# P2 has overallNotes + scores=[]

# 10) Re-submit observations to confirm upsert (same player gets a different score set)
curl -s -X POST http://localhost:8080/api/sessions/$SID/observations \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"observations":[{"playerId":<P1>,"overallNotes":"Updated","scores":[{"category":"BOWLING","dimension":"line","score":2,"notes":null}]}]}' | jq .
# expect: 200, {"observationsSaved":1}
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/sessions/$SID | jq '.players'
# expect: P2 now has no observation row (cleared); P1 has only the BOWLING/line score
```

### Validation negatives

```bash
# 11) Score out of range
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/api/sessions/$SID/observations \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"observations":[{"playerId":<P1>,"overallNotes":null,"scores":[{"category":"BATTING","dimension":"footwork","score":6,"notes":null}]}]}'
# expect: 400

# 12) Mismatched category/dimension
curl -s -X POST http://localhost:8080/api/sessions/$SID/observations \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"observations":[{"playerId":<P1>,"overallNotes":null,"scores":[{"category":"BATTING","dimension":"catching","score":3,"notes":null}]}]}' | jq .
# expect: 400, error: "Dimension catching is not valid for category BATTING"

# 13) Player not in attendance
curl -s -X POST http://localhost:8080/api/sessions/$SID/observations \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"observations":[{"playerId":<unrelated_player_id>,"overallNotes":null,"scores":[]}]}' | jq .
# expect: 400, error contains "is not in this session's attendance"

# 14) Foreign player in attendance request
curl -s -X PUT http://localhost:8080/api/sessions/$SID/attendance \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"playerIds":[999999]}' | jq .
# expect: 400, error: "One or more players do not belong to this coach"

# 15) Coach isolation — register a second coach, login, try to GET coach A's session
# (use /api/auth/register if enabled, else create one via DB)
# expect: 404 "Session not found"
```

### Cleanup

```bash
# 16) Delete the session
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:8080/api/sessions/$SID \
  -H "Authorization: Bearer $TOKEN"
# expect: 204

# 17) Verify cascade
/usr/local/mysql/bin/mysql -u crick -pcrick crick -e \
  "SELECT COUNT(*) FROM session_players WHERE session_id=$SID;
   SELECT COUNT(*) FROM player_observations WHERE session_id=$SID;
   SELECT COUNT(*) FROM technique_scores
     WHERE observation_id IN (SELECT id FROM player_observations WHERE session_id=$SID);"
# expect: 0, 0, 0
```

### Auth

```bash
# 18) No JWT
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/sessions
# expect: 401

# 19) Bad JWT
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer nope" http://localhost:8080/api/sessions
# expect: 401
```

---

## 9. Out of scope (do NOT add)

Per CLAUDE.md ("Do not add features beyond what is specified") and INITIAL.md ("Do not add any drill recommendation logic"):
- No drill / recommendation logic, no LLM calls.
- No frontend changes whatsoever.
- No additional `GlobalExceptionHandler` handlers (existing ones cover this feature).
- No changes to `Player` or `User` entities.
- No comments, no Javadoc, no TODOs.
- No "session.copy", "session.clone", history-tracking, soft-delete, or audit-log features.
- No bulk-import endpoint, no CSV upload.
- No support for editing an individual score in place — only the full bulk upsert.
- No `PATCH /api/sessions/{id}` for partial updates (out of spec).

---

## 10. Known caveats / pre-existing wart this feature inherits

- The current `GlobalExceptionHandler.handleIntegrity` returns `{"error":"Email already registered"}` for **any** `DataIntegrityViolationException`. After this feature, that handler can also fire for (a) attempting to delete a `Player` who has session attendance/observations (RESTRICT), and (b) any race that violates the unique `(session_id, player_id)` or `(observation_id, category, dimension)` constraints. The 409 status is correct in both cases but the message is misleading. **This PRP does not modify that handler** — INITIAL.md is silent on it and broadening it would touch out-of-scope auth code. Flag in the PR description.

---

## 11. Self-score

**Confidence: 9/10.**

This PRP specifies every file, every JPQL, every SQL DDL, every validation rule, and every error path the implementer will hit. The non-obvious traps (MultipleBagFetchException, persistence-context cache after `@Modifying` delete, `MAX_SIZE`-style DoS bound on `playerIds`, `Sort` smuggled in via `Pageable` overriding the JPQL `ORDER BY`, the wire-format ↔ Java enum case mismatch via `@JsonValue`/`@JsonCreator`, the category↔dimension cross-field check belonging in the service rather than the DTO, the player-FK RESTRICT vs CASCADE choice) are all called out with the chosen resolution.

The remaining 1 point of uncertainty:
- Should `SessionDetailResponse` include attending players who have no observation row yet, or only players with an observation? §6 (DTO) takes the position "include all attendees" because it matches the obvious coach-side UX in Feature 3-frontend, but INITIAL.md's example response is ambiguous. If the implementer prefers literal-INITIAL.md ("only observations"), the change is a 2-line filter in the service. Flag at PR time if unclear.

No additional clarifications needed to proceed.
