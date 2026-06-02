# PRP — Feature 6: AI-Powered Drill Recommendations with RAG (Backend Only)

> Source: `INITIAL.md`. Global rules: `CLAUDE.md`. Predecessor state — Features 0–5 complete. Live and verified: JWT auth with `@CurrentUser User` resolver; `Player` scoped by `coach_id` (`PlayerRepository.findByIdAndCoachId`); `Session`/`PlayerObservation`/`TechniqueScore` with `PlayerObservationRepository.findByPlayerIdWithScoresAndSession` (returns observations ASC by `session.date`, scores eager-fetched); `Drill` entity + 30 seeded drills (V7/V8) with `skillArea: Category`, `targetIssue: TechniqueDimension`, `difficulty: Difficulty`, `ageMin`/`ageMax`. Stack: Spring Boot 3.5.14, Java 21, MySQL 8, Flyway (last migration **V8**), Lombok, `spring-boot-starter-web` (brings `RestTemplate`/`RestTemplateBuilder` + autoconfigured Jackson `ObjectMapper`). No HTTP-client or AI code exists yet. **This feature is backend only — no frontend work.**

---

## 1. Summary

Build the headline AI feature: per-player drill recommendations produced by a Retrieval-Augmented Generation (RAG) pipeline rather than dumping all 30 drills into one LLM prompt. Each drill is embedded once into a vector (Gemini `gemini-embedding-001`) and stored in a new `embedding` column. On request, the service builds a natural-language weakness profile from the player's last 5 sessions of observations (pure code, no LLM), embeds that profile, ranks all drill vectors by cosine similarity (pure Java math), and passes only the top 8 retrieved drills plus the player's raw observation data to DeepSeek `deepseek-chat` for reasoning. DeepSeek returns a JSON array of 3–5 `{drillId, rationale, expectedOutcome}`; the service validates the IDs against the retrieved set, marks prior recommendations stale, and persists the new ones with their retrieval similarity scores. A 24-hour cache cooldown (overridable with `?force=true`) prevents needless regeneration; a `GET` endpoint returns cached results with zero external calls; a coach-only `POST /api/admin/drills/embed` performs the one-time embedding pass. Every external call has a 30s timeout and degrades to a clean error response — the app never crashes because an AI provider is down.

---

## 2. Architecture decisions

| # | Decision | Choice | Why | Alternatives rejected |
|---|---|---|---|---|
| 1 | Vector storage | New `embedding` **LONGTEXT** column on `drills`, holding a JSON array of doubles (e.g. `[0.02,-0.15,...]`). | Zero new infra — no pgvector/extension, no separate table. 30 drills × ~3072 doubles is trivial to load and scan in memory. MySQL 8 has no native vector type on the target stack, and LONGTEXT comfortably holds the serialized vector. Matches INITIAL.md exactly. | A dedicated `drill_embeddings` table (1:1) — needless join for a single-value-per-drill attribute. Native vector DB / pgvector — out of stack, over-engineered for 30 rows. BLOB of packed floats — opaque, harder to debug than JSON. |
| 2 | Where vector (de)serialization lives | A JPA **`AttributeConverter<List<Double>, String>`** (`DrillEmbeddingConverter`) applied to the entity field via `@Convert`, so `Drill.getEmbedding()` returns a `List<Double>` directly. Keep a static `ObjectMapper` inside the converter. | INITIAL.md asks for `setEmbeddingFromList`/`getEmbeddingAsList` helpers on the entity, but entities can't cleanly inject an `ObjectMapper` (they're not Spring beans), and hand-rolled helpers leak JSON concerns into the domain. A converter is the idiomatic Spring/JPA mechanism, keeps the field strongly typed, and the service code reads naturally (`drill.getEmbedding()`). **Compatibility:** retain the column as `embedding LONGTEXT`; the converter writes the identical JSON string the helpers would have. | Helper methods on the entity holding a `static ObjectMapper` — works but mixes persistence-format logic into the domain object and forces callers to remember to call the right helper. Doing JSON in the service every read/write — duplicated at every call site. |
| 3 | HTTP client | A single shared **`RestTemplate`** bean built in `AiConfig` with a `SimpleClientHttpRequestFactory` (connect + read timeout = 30s). Used for both Gemini and DeepSeek. | `spring-boot-starter-web` already ships `RestTemplate`; no need to add WebFlux/`WebClient`. Both providers are simple request/response JSON — no streaming, no reactive needs. One bean, one timeout policy. | `WebClient` — adds `spring-boot-starter-webflux` for no benefit on blocking calls. Raw `HttpClient` — reinvents Jackson (de)serialization and error mapping. |
| 4 | Two providers, two clients | `EmbeddingService` owns the Gemini call (key as **query param**, no auth header); `LlmService` owns the DeepSeek call (OpenAI-compatible, **`Authorization: Bearer`** header). | INITIAL.md mandates exactly this split and the two different auth mechanisms. Separation keeps each provider's quirks (Gemini's `?key=`, DeepSeek's code-fence-wrapped JSON) isolated and independently testable. | One generic `AiClient` — would muddy the two auth styles and response shapes. |
| 5 | Similarity math | Pure Java cosine similarity in `EmbeddingService` (`dot / (‖a‖·‖b‖)`), no library. | INITIAL.md: "Cosine similarity is pure Java math — no external library." For 30 vectors it's microseconds. | Apache Commons Math / ND4J — heavy dep for a 5-line function. |
| 6 | Retrieval scope & topK | `findSimilarDrills(queryText, 8)` embeds the query once, loads **all** drills with a non-null embedding, scores every one, sorts desc, returns top 8. | INITIAL.md says retrieve 8–10; 8 is the chosen constant (passed explicitly so it's tunable). Scanning all 30 in memory is correct and simplest — no ANN index needed at this scale. | Pre-filter by `skillArea` before scoring — risks excluding cross-skill drills the embedding would surface; the LLM step already narrows. ANN/HNSW index — pointless for 30 rows. |
| 7 | Weakness profile = code, not LLM | `PlayerWeaknessProfileBuilder` constructs the profile **string** deterministically from observation data. | INITIAL.md: "constructed programmatically — not an LLM call." Keeps cost down, output stable, and the retrieval query reproducible. | Ask the LLM to summarize weaknesses — extra call, non-deterministic retrieval query. |
| 8 | "Last 5 sessions" semantics | `findByPlayerIdWithScoresAndSession` already returns observations **ASC by date**; take the **last 5** (tail of the list). Average each dimension across those, flag dims with avg ≤ 3, compute trend by comparing the mean of the earlier half vs the later half of those sessions, collect up to ~6 non-blank score/overall notes. | Reuses the existing optimized fetch-join query (no new repo method needed for the read). avg ≤ 3 matches INITIAL.md's "weakest dimensions" framing; ≤ 3 (not ≤ 2) ensures a profile exists even for a moderately-scored player. | A new "last N sessions" SQL query — the existing query already eager-loads scores+session; slicing in memory is cheaper than a second round trip and 5 sessions is tiny. |
| 9 | Trend label | Per dimension, compare mean(later half) − mean(earlier half) of the in-window sessions: ≥ +0.25 → `improving`, ≤ −0.25 → `declining`, else `stable`; `stable` when < 4 data points. | Mirrors the Feature-4 frontend `computeTrendDirection` convention (±0.25 on a 1–5 scale) so coach-facing language is consistent across the app. | Linear regression — overkill at ≤5 points. Strict 3-vs-3 — undefined for <6 sessions. |
| 10 | Cache / cost guard | On `generate`, if a current recommendation set exists with `generatedAt` within 24h and `force=false`, return it untouched (no Gemini, no DeepSeek). `?force=true` bypasses. `GET` always returns cached, never calls out. | INITIAL.md cost guard + AI principle #3 ("cache everything"). `is_current=true` rows are the cache; `generatedAt` is the cooldown clock. | A separate cache table / TTL column — the existing `is_current` + `generated_at` already encode this. |
| 11 | Marking old recs stale | A `@Modifying @Query` bulk update sets `is_current=false` for the player **before** inserting the new set, inside one `@Transactional` write. | Atomic swap — a reader never sees two current sets. Bulk update avoids loading old rows. | Delete old rows — loses history; INITIAL.md models `is_current` precisely so history is retained. |
| 12 | Attaching similarity scores to saved recs | `RecommendationService` keeps a `Map<Long, Double>` of drillId→similarityScore from the retrieval step and stamps each persisted `DrillRecommendation.similarityScore` from it. | The LLM chooses *which* retrieved drills to recommend; their retrieval rank is still meaningful provenance to surface (`similarityScore` in the response). | Re-embed each chosen drill to recompute similarity — redundant; we already have the score. |
| 13 | LLM output parsing | `LlmService` reads `choices[0].message.content`, **strips ```` ```json ```` / ```` ``` ```` fences** and trims, then parses a JSON **array** of `{drillId, rationale, expectedOutcome}` via Jackson into `List<LlmDrillRecommendation>`. | DeepSeek frequently wraps JSON in markdown fences (INITIAL.md calls this out explicitly). Parsing into a typed DTO (not `Map`) keeps the service strict. | Regex-extract fields — brittle. Trust raw content — breaks on fences. |
| 14 | Validation of LLM drill IDs | Discard any returned `drillId` not in the retrieved top-8 set; cap the result at 5; if **zero** valid remain, throw a clear `AiException` → 502. | INITIAL.md AI principle #1: "no hallucinated drills." Constraining to the *retrieved* set (not the whole library) is stricter and correct — the LLM was only shown those. | Validate against the whole drill table — would let the model "recommend" a drill it never saw. |
| 15 | Failure mode / error type | A dedicated unchecked `AiException` (message + cause) thrown by `EmbeddingService`/`LlmService` on timeout, non-2xx, malformed body, or empty valid result. Mapped in `GlobalExceptionHandler` to **502 Bad Gateway** with the standard `{error, details:null}` shape. | INITIAL.md: "If any external call fails, return a clear error message. Never crash." 502 correctly signals an upstream-dependency failure (vs 500 for our own bug). Reuses the existing consistent error envelope. | Let `RestClientException` bubble to the generic 500 handler — wrong status, leaks nothing useful, and the generic handler logs it as an unhandled bug. |
| 16 | Admin embed endpoint placement | `POST /api/admin/drills/embed` in a new `AdminController` (in `com.crick.embedding`), guarded only by the existing "any request authenticated" rule (all users are coaches). Returns `{embedded: <count>}`. | INITIAL.md path + "coach-only." There is no role hierarchy in this app (single COACH role), so JWT-authenticated == authorized. No `SecurityConfig` change needed — `/api/admin/**` already falls under `anyRequest().authenticated()`. | Add a `ROLE_ADMIN` — no such role exists; out of scope. New public path — would expose an expensive write. |
| 17 | Embedding idempotency | `DrillEmbeddingService.embedAll()` iterates **all** drills, (re)computes and overwrites each `embedding`, returns the count embedded. Safe to re-run. | INITIAL.md: "Re-embed only if drill content changes" — re-running simply refreshes. Overwriting is simplest and correct. | Skip already-embedded drills — would silently miss content changes; the endpoint is manual/rare so cost is a non-issue. |
| 18 | Player scoping | Every player-scoped endpoint loads via `PlayerRepository.findByIdAndCoachId(playerId, coachId)` → `EntityNotFoundException` (404) if not the coach's. | Matches the established Feature 2–4 security pattern; a coach can never generate/read recs for another coach's player. | Trust the path id — cross-tenant leak. |
| 19 | Vector dimension guard | `cosineSimilarity` throws `IllegalArgumentException` if the two vectors differ in length; the query and all drills use the same model so lengths match (gemini-embedding-001 default output). | Defensive — a length mismatch means a stale/mixed embedding set and should fail loudly, not silently mis-score. | Pad/truncate — would produce meaningless similarities. |
| 20 | Config binding | `AiConfig` is `@Configuration` reading `ai.*` via `@Value`, exposing the `RestTemplate` bean and getters for the four properties. | Small, fixed set of props; `@Value` is lighter than a `@ConfigurationProperties` record here and keeps everything in one class with the bean. | `@ConfigurationProperties` POJO — fine but more ceremony for 4 strings. |
| 21 | Comments / Javadoc | None. No TODOs. | CLAUDE.md + INITIAL.md ("No obvious comments. No TODOs."). | — |

---

## 3. Data model changes

Two new migrations. Last existing migration is **V8** — do not edit released migrations.

### `V9__add_drill_embedding_column.sql` (new)
Adds the vector column to the existing `drills` table.

```sql
ALTER TABLE drills
    ADD COLUMN embedding LONGTEXT NULL AFTER variations;
```

### `V10__create_drill_recommendations_table.sql` (new)
Creates the recommendation store. FK/charset/engine conventions copied from V6.

```sql
CREATE TABLE drill_recommendations (
    id               BIGINT      NOT NULL AUTO_INCREMENT,
    player_id        BIGINT      NOT NULL,
    drill_id         BIGINT      NOT NULL,
    rationale        TEXT        NOT NULL,
    expected_outcome TEXT        NOT NULL,
    similarity_score DOUBLE,
    is_current       BOOLEAN     NOT NULL DEFAULT TRUE,
    generated_at     TIMESTAMP   NOT NULL,
    created_at       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_drill_recs_player_current (player_id, is_current),
    CONSTRAINT fk_drill_recs_player
        FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
    CONSTRAINT fk_drill_recs_drill
        FOREIGN KEY (drill_id)  REFERENCES drills (id)  ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

> Note: `ddl-auto: validate` is active — the JPA entities below must map these columns exactly (column names, nullability) or startup fails. `generated_at` is set by the service (not a DB default) so it equals the logical generation instant.

---

## 4. File-by-file implementation plan

Strict order — config & persistence primitives first, then the embedding layer, then the recommendation layer, then controllers, then wiring. Each `→` dependency must exist before the dependent file compiles.

### Step 1 — Config

**`backend/src/main/java/com/crick/config/AiConfig.java`** (new)
- `@Configuration`. Fields via `@Value`: `ai.embedding.api-key` (Gemini), `ai.embedding.api-url` (Gemini base — see Step 9 yaml), `ai.chat.api-url`, `ai.chat.api-key`, `ai.chat.model`.
- `@Bean RestTemplate aiRestTemplate()` — build a `SimpleClientHttpRequestFactory` with `setConnectTimeout(Duration.ofSeconds(30))` and `setReadTimeout(Duration.ofSeconds(30))`, wrap in `new RestTemplate(factory)`.
- Public getters for the five properties so the two services can read URL/key/model. (Name the bean method `aiRestTemplate` to avoid colliding with any future default `RestTemplate`.)

**`backend/src/main/resources/application.yml`** (modify) — see Step 9.

### Step 2 — Drill embedding persistence

**`backend/src/main/java/com/crick/drill/DrillEmbeddingConverter.java`** (new)
- `@Converter` implementing `AttributeConverter<List<Double>, String>`.
- Static `ObjectMapper`. `convertToDatabaseColumn(List<Double>)` → JSON string (null → null). `convertToEntityAttribute(String)` → `List<Double>` via `readValue(s, new TypeReference<List<Double>>(){})` (null/blank → null). Wrap Jackson checked exceptions in `IllegalStateException`.

**`backend/src/main/java/com/crick/drill/Drill.java`** (modify)
- Add field: `@Column(columnDefinition = "LONGTEXT") @Convert(converter = DrillEmbeddingConverter.class) private List<Double> embedding;`
- Lombok `@Getter/@Setter` already present → `getEmbedding()`/`setEmbedding(List<Double>)` are generated. No manual helpers needed (decision #2).

**`backend/src/main/java/com/crick/drill/DrillRepository.java`** (modify)
- Add `List<Drill> findAllByEmbeddingIsNotNull();` (Spring Data derived query against the LONGTEXT column — non-null rows only).

### Step 3 — Embedding service + value type

**`backend/src/main/java/com/crick/embedding/DrillMatch.java`** (new)
- `public record DrillMatch(Long drillId, Drill drill, double similarityScore) {}`.

**`backend/src/main/java/com/crick/embedding/AiException.java`** (new)
- `public class AiException extends RuntimeException` with `(String message)` and `(String message, Throwable cause)` constructors. Shared by embedding + recommendation layers (place in `embedding` package; imported by `recommendation`).

**`backend/src/main/java/com/crick/embedding/EmbeddingService.java`** (new) → depends on `AiConfig`, `DrillRepository`, `DrillMatch`, `AiException`
- `@Service @RequiredArgsConstructor`. Deps: `AiConfig`, `RestTemplate aiRestTemplate` (qualify by bean name), `DrillRepository`.
- `List<Double> getEmbedding(String text)`:
  - Build URL `{ai.embedding.api-url}/models/gemini-embedding-001:embedContent?key={apiKey}` (apiKey from config; URL-encode the key param).
  - Body: `{"content":{"parts":[{"text": text}]}}` — build with a small Map or a DTO; set `Content-Type: application/json`; **no** Authorization header.
  - `POST` via `aiRestTemplate.exchange(...)` expecting a typed response (a `GeminiEmbeddingResponse` DTO with nested `embedding.values: List<Double>`). Return `embedding.values`.
  - On `RestClientException` / non-2xx / null body / empty values → throw `AiException("Embedding request failed", e)`.
- `double cosineSimilarity(List<Double> a, List<Double> b)`:
  - If `a.size() != b.size()` → `IllegalArgumentException`. Compute dot, ‖a‖, ‖b‖ in one pass. If either magnitude is 0 → return 0. Return `dot/(magA*magB)`.
- `List<DrillMatch> findSimilarDrills(String queryText, int topK)`:
  - `List<Double> q = getEmbedding(queryText);`
  - `drillRepository.findAllByEmbeddingIsNotNull()` → for each, `new DrillMatch(d.getId(), d, cosineSimilarity(q, d.getEmbedding()))`.
  - Sort by `similarityScore` desc, limit `topK`, collect. If the source list is empty → throw `AiException("No embedded drills found — run /api/admin/drills/embed first")`.

**`backend/src/main/java/com/crick/embedding/GeminiEmbeddingResponse.java`** (new)
- DTO mirroring Gemini's response: record `GeminiEmbeddingResponse(Embedding embedding)` with nested `record Embedding(List<Double> values)`. `@JsonIgnoreProperties(ignoreUnknown = true)` on both.

**`backend/src/main/java/com/crick/embedding/DrillEmbeddingService.java`** (new) → depends on `EmbeddingService`, `DrillRepository`
- `@Service @RequiredArgsConstructor @Transactional`. Deps: `DrillRepository`, `EmbeddingService`.
- `int embedAll()`:
  - `findAll()` drills. For each: build text = `"Skill area: {skillArea}. Target issue: {targetIssue.name().toLowerCase}. Difficulty: {difficulty}. {name} — {description}"` (concatenation per INITIAL.md sample; `targetIssue`/`skillArea` rendered as their names).
  - `List<Double> vec = embeddingService.getEmbedding(text); drill.setEmbedding(vec);` (dirty-checking persists on commit; or `saveAll`).
  - Return the count processed.

**`backend/src/main/java/com/crick/embedding/AdminController.java`** (new) → depends on `DrillEmbeddingService`
- `@RestController @RequestMapping("/api/admin/drills") @RequiredArgsConstructor`.
- `@PostMapping("/embed") public Map<String,Integer> embed()` → `return Map.of("embedded", drillEmbeddingService.embedAll());`. (Authenticated-only via existing security; no `@CurrentUser` needed but harmless to include.)

### Step 4 — Recommendation persistence

**`backend/src/main/java/com/crick/recommendation/DrillRecommendation.java`** (new) → extends `BaseEntity`
- `@Entity @Table(name="drill_recommendations") @Getter @Setter @NoArgsConstructor extends BaseEntity`.
- `@ManyToOne(fetch=LAZY, optional=false) @JoinColumn(name="player_id") Player player;`
- `@ManyToOne(fetch=LAZY, optional=false) @JoinColumn(name="drill_id") Drill drill;`
- `@Column(columnDefinition="TEXT", nullable=false) String rationale;`
- `@Column(name="expected_outcome", columnDefinition="TEXT", nullable=false) String expectedOutcome;`
- `@Column(name="similarity_score") Double similarityScore;`
- `@Column(name="is_current", nullable=false) boolean isCurrent = true;`
- `@Column(name="generated_at", nullable=false) LocalDateTime generatedAt;`
- (`id`, `createdAt` inherited from `BaseEntity`.)

**`backend/src/main/java/com/crick/recommendation/DrillRecommendationRepository.java`** (new)
- `extends JpaRepository<DrillRecommendation, Long>`.
- `@Query("SELECT r FROM DrillRecommendation r JOIN FETCH r.drill WHERE r.player.id = :playerId AND r.isCurrent = true ORDER BY r.similarityScore DESC") List<DrillRecommendation> findCurrentByPlayerId(@Param("playerId") Long playerId);` (fetch-join `drill` so the response mapper can read `drill.name`/`drill.skillArea` without lazy errors).
- `@Modifying @Query("UPDATE DrillRecommendation r SET r.isCurrent = false WHERE r.player.id = :playerId AND r.isCurrent = true") void markAllNotCurrent(@Param("playerId") Long playerId);`

### Step 5 — Weakness profile builder

**`backend/src/main/java/com/crick/recommendation/PlayerWeaknessProfileBuilder.java`** (new) → depends on `PlayerObservationRepository`, `Player`
- `@Component @RequiredArgsConstructor`. Dep: `PlayerObservationRepository`.
- `String build(Player player)`:
  1. `observationRepository.findByPlayerIdWithScoresAndSession(player.getId())` → ASC by date. Keep the **last 5** (tail).
  2. If empty → throw `IllegalStateException("Player has no observations")` (maps to 400; the controller/service translates to a friendly message — see edge cases).
  3. Flatten scores → group by `TechniqueDimension` → average. Keep dims with avg ≤ 3, sorted asc by avg (weakest first), cap to ~5.
  4. Per kept dim, compute trend (decision #9) over its chronological per-session averages within the window.
  5. Collect up to ~6 non-blank notes (score `notes` + `overallNotes`).
  6. Assemble a string mirroring INITIAL.md's sample: `"Player: {name}, Age group: {ageGroup}. Weakest dimensions: {CATEGORY dimension (avg X.X, trend)}, ... Coach notes: '...', '...'. Focus areas: dim, dim, ..."`.
  - Render category from `dimension.category()`, dimension as lowercase name.

### Step 6 — LLM service + DTOs

**`backend/src/main/java/com/crick/recommendation/LlmDrillRecommendation.java`** (new)
- `@JsonIgnoreProperties(ignoreUnknown=true) public record LlmDrillRecommendation(Long drillId, String rationale, String expectedOutcome) {}`.

**`backend/src/main/java/com/crick/recommendation/LlmService.java`** (new) → depends on `AiConfig`, `DrillMatch`, `LlmDrillRecommendation`, `AiException`
- `@Service @RequiredArgsConstructor`. Deps: `AiConfig`, `RestTemplate aiRestTemplate`, `ObjectMapper` (autoconfigured).
- `List<LlmDrillRecommendation> generateRecommendations(String playerSummary, List<DrillMatch> retrieved)`:
  - System message = the exact prompt from INITIAL.md §"Prompt design".
  - User message = player name/age + last-5-sessions observation data (`playerSummary` already encodes the weakness view; include the richer raw scores/notes block too) + a formatted list of the retrieved drills: `id, name, skillArea, targetIssue, difficulty, ageMin–ageMax, description`.
  - Body (OpenAI-compatible): `{"model": ai.chat.model, "messages":[{role:system,...},{role:user,...}], "temperature":0.3}`.
  - Headers: `Authorization: Bearer {ai.chat.api-key}`, `Content-Type: application/json`.
  - `POST ai.chat.api-url` via `aiRestTemplate.exchange(...)` → parse a `DeepSeekResponse` DTO; read `choices[0].message.content`.
  - **Strip fences**: remove a leading ```` ```json ```` or ```` ``` ```` and trailing ```` ``` ````, `trim()`.
  - Parse the cleaned text as `List<LlmDrillRecommendation>` via `objectMapper.readValue(text, new TypeReference<>(){})`.
  - Any `RestClientException` / non-2xx / empty choices / JSON parse failure → throw `AiException(...)`.

**`backend/src/main/java/com/crick/recommendation/DeepSeekResponse.java`** (new)
- DTOs mirroring the OpenAI-compatible shape: `record DeepSeekResponse(List<Choice> choices)`, `record Choice(Message message)`, `record Message(String role, String content)`, all `@JsonIgnoreProperties(ignoreUnknown=true)`.

### Step 7 — Orchestration service + response DTO

**`backend/src/main/java/com/crick/recommendation/RecommendationResponse.java`** (new)
- `record RecommendationResponse(Long playerId, LocalDateTime generatedAt, List<Item> recommendations)` with nested `record Item(Long drillId, String drillName, Category skillArea, String rationale, String expectedOutcome, Double similarityScore)`.
- Static `from(Long playerId, List<DrillRecommendation> recs)` mapping each entity (reads `drill.getName()`, `drill.getSkillArea()`); `generatedAt` = the set's `generatedAt` (first element, or null if empty).

**`backend/src/main/java/com/crick/recommendation/RecommendationService.java`** (new) → depends on all of Steps 4–6 + `PlayerRepository`, `EmbeddingService`
- `@Service @RequiredArgsConstructor`. Deps: `PlayerRepository`, `DrillRecommendationRepository`, `PlayerWeaknessProfileBuilder`, `EmbeddingService`, `LlmService`, `DrillRepository`.
- `@Transactional(readOnly=true) RecommendationResponse getCurrent(Long coachId, Long playerId)`:
  - `loadPlayer(coachId, playerId)`; `repo.findCurrentByPlayerId(playerId)` → map via `RecommendationResponse.from`.
- `@Transactional RecommendationResponse generate(Long coachId, Long playerId, boolean force)`:
  1. `Player player = loadPlayer(coachId, playerId)`.
  2. **Cache check:** `List<DrillRecommendation> current = repo.findCurrentByPlayerId(playerId)`. If `!force && !current.isEmpty() && current.get(0).getGeneratedAt().isAfter(LocalDateTime.now().minusHours(24))` → return `from(playerId, current)`.
  3. `String profile = weaknessBuilder.build(player);`
  4. `List<DrillMatch> matches = embeddingService.findSimilarDrills(profile, 8);`
  5. `List<LlmDrillRecommendation> picks = llmService.generateRecommendations(profile, matches);`
  6. **Validate**: `Set<Long> allowed = matches.stream().map(DrillMatch::drillId)...`; filter `picks` to those whose `drillId ∈ allowed`; cap to 5. If empty → throw `AiException("LLM returned no valid drill recommendations")`.
  7. `Map<Long,Double> simById = matches → drillId:similarityScore`.
  8. `repo.markAllNotCurrent(playerId);`
  9. For each valid pick: build `DrillRecommendation` (set `player`, `drill` = `drillRepository.getReferenceById(drillId)`, `rationale`, `expectedOutcome`, `similarityScore = simById.get(drillId)`, `isCurrent=true`, `generatedAt = now`). `repo.saveAll(...)`.
  10. Return `RecommendationResponse.from(playerId, savedList)`.
- `private Player loadPlayer(coachId, playerId)` → `playerRepository.findByIdAndCoachId(playerId, coachId).orElseThrow(() -> new EntityNotFoundException("Player not found"))`.
- Capture a single `LocalDateTime now = LocalDateTime.now()` at the top of `generate` and reuse for all rows so the set shares one `generatedAt`.

### Step 8 — Controller

**`backend/src/main/java/com/crick/recommendation/RecommendationController.java`** (new) → depends on `RecommendationService`
- `@RestController @RequestMapping("/api/players") @RequiredArgsConstructor`.
- `@PostMapping("/{id}/recommendations/generate") public RecommendationResponse generate(@CurrentUser User coach, @PathVariable Long id, @RequestParam(defaultValue="false") boolean force)` → `service.generate(coach.getId(), id, force)`.
- `@GetMapping("/{id}/recommendations") public RecommendationResponse get(@CurrentUser User coach, @PathVariable Long id)` → `service.getCurrent(coach.getId(), id)`.

### Step 9 — Config wiring

**`backend/src/main/java/com/crick/common/GlobalExceptionHandler.java`** (modify)
- Add `@ExceptionHandler(AiException.class)` → `502 BAD_GATEWAY`, body `new ErrorResponse(ex.getMessage(), null)`. Log at warn with the cause.
- Add `@ExceptionHandler(IllegalStateException.class)` → `400 BAD_REQUEST`, body `new ErrorResponse(ex.getMessage(), null)` (covers "Player has no observations"). *(If a broader `IllegalStateException` mapping is undesirable, instead throw a dedicated `NoObservationsException` from the builder and map that — but `IllegalStateException`→400 is acceptable and simpler here.)*

**`backend/src/main/resources/application.yml`** (modify)
- Under the top-level `crick:`-sibling root, add an `ai:` block in the **shared** (top) document so all profiles inherit:
```yaml
ai:
  embedding:
    api-key: ${GEMINI_API_KEY:}
    api-url: https://generativelanguage.googleapis.com/v1beta
  chat:
    api-url: ${DEEPSEEK_API_URL:https://api.deepseek.com/v1/chat/completions}
    api-key: ${DEEPSEEK_API_KEY:}
    model: ${DEEPSEEK_MODEL:deepseek-chat}
```
- The `api-url` for embedding is the **base**; `EmbeddingService` appends `/models/gemini-embedding-001:embedContent?key=...`. Keys default to empty so the app still boots without secrets (calls fail with `AiException`, app stays up).

---

## 5. Edge cases & error handling

| Case | Handling |
|---|---|
| Player belongs to another coach (or missing) | `findByIdAndCoachId` empty → `EntityNotFoundException` → **404** `{"error":"Player not found"}`. |
| Player has **0** observations | `PlayerWeaknessProfileBuilder.build` throws `IllegalStateException("Player has no observations")` → **400** with that message. (Coach must log a session first.) |
| Drills not yet embedded | `findSimilarDrills` sees empty `findAllByEmbeddingIsNotNull()` → `AiException("No embedded drills found — run /api/admin/drills/embed first")` → **502**. |
| Gemini timeout / non-2xx / null body | `EmbeddingService` → `AiException` → **502** `{"error":"Embedding request failed"}`. App stays up. |
| DeepSeek timeout / non-2xx / empty `choices` | `LlmService` → `AiException` → **502**. |
| DeepSeek returns fenced JSON (```` ```json ````) | Fences stripped before parse (decision #13). |
| DeepSeek returns malformed / non-array JSON | Jackson throws → caught → `AiException("Failed to parse AI response")` → **502**. |
| DeepSeek recommends a drill **not** in the retrieved 8 | Filtered out (decision #14). If that empties the list → `AiException` → 502. |
| DeepSeek returns > 5 valid | Capped to 5. |
| Vector length mismatch (mixed/stale embeddings) | `cosineSimilarity` → `IllegalArgumentException` → **400** (signals a re-embed is needed). |
| Regenerate within 24h, `force=false` | Returns cached set, **no external calls**, 200. |
| `?force=true` within 24h | Bypasses cache, runs full pipeline, swaps `is_current`. |
| `GET` recommendations when none exist | 200 with `recommendations: []` and `generatedAt: null`. |
| Concurrent `generate` for same player | Each runs in its own `@Transactional`; `markAllNotCurrent` + insert is atomic per tx. Worst case two sets briefly both `is_current` if perfectly interleaved — acceptable for single-coach usage; `findCurrentByPlayerId` ordering still returns a coherent list. |
| Missing API keys (empty env) | App boots (defaults empty); first external call fails → `AiException` → 502. No crash. |
| Embedding column round-trip | `DrillEmbeddingConverter` handles null/blank → null `List`; non-null → parsed list. |

---

## 6. Validation rules

| Input | Rule | On violation |
|---|---|---|
| `playerId` path var | Must be a `Long` and resolve to a player owned by the JWT coach | non-numeric → 400 (Spring type mismatch); not owned/missing → 404 `Player not found` |
| `force` query param | Optional boolean, default `false` | bad value → 400 (Spring binding) |
| JWT | Required on all three endpoints (`/api/players/**`, `/api/admin/**` covered by `anyRequest().authenticated()`) | missing/invalid → 401 `{"error":"Unauthorized"}` (existing `authenticationEntryPoint`) |
| LLM `drillId` | Must exist in the retrieved top-8 set | filtered; all-invalid → 502 |
| LLM result size | 3–5 expected; capped at 5; ≥1 required | 0 valid → 502 |
| Embedding vectors | Query and drill vectors equal length | mismatch → 400 |
| Drill must have observations to profile | ≥1 observation in history | 0 → 400 `Player has no observations` |

No request **body** is accepted by any endpoint in this feature (all inputs are path/query), so there are no Jakarta `@Valid` DTOs to add.

---

## 7. Dependencies between files (build order)

```
V9, V10 migrations ............................ (no code dep; must exist for ddl validate at runtime)
AiConfig ...................................... RestTemplate bean + props
DrillEmbeddingConverter ....................... ObjectMapper
Drill (modify) ................................ DrillEmbeddingConverter
DrillRepository (modify) ...................... Drill
AiException ................................... —
DrillMatch .................................... Drill
GeminiEmbeddingResponse ....................... —
EmbeddingService .............................. AiConfig, DrillRepository, DrillMatch, GeminiEmbeddingResponse, AiException
DrillEmbeddingService ......................... EmbeddingService, DrillRepository
AdminController ............................... DrillEmbeddingService
DrillRecommendation (entity) .................. Player, Drill, BaseEntity
DrillRecommendationRepository ................. DrillRecommendation
PlayerWeaknessProfileBuilder .................. PlayerObservationRepository, Player
LlmDrillRecommendation, DeepSeekResponse ...... —
LlmService .................................... AiConfig, DrillMatch, LlmDrillRecommendation, DeepSeekResponse, AiException
RecommendationResponse ........................ DrillRecommendation, Category
RecommendationService ......................... PlayerRepository, DrillRecommendationRepository, PlayerWeaknessProfileBuilder,
                                                EmbeddingService, LlmService, DrillRepository, RecommendationResponse, AiException
RecommendationController ...................... RecommendationService, @CurrentUser/User
GlobalExceptionHandler (modify) ............... AiException
application.yml (modify) ...................... (consumed by AiConfig)
```

Implement top-to-bottom; nothing references a file above it that isn't already listed.

---

## 8. Verification checklist

Prereqs: `docker compose up` (MySQL), `GEMINI_API_KEY` and `DEEPSEEK_API_KEY` exported, backend running on `:8080`, a coach JWT in `$TOKEN`, and a player id (`$PID`) owned by that coach with **≥3 logged sessions**.

1. **Migrations apply** — backend starts cleanly with `ddl-auto: validate`:
   ```bash
   ./mvnw -q spring-boot:run   # boots without Flyway/Hibernate validation errors; V9 & V10 applied
   ```
   Confirm: `SELECT * FROM flyway_schema_history;` shows V9 and V10 `success=1`; `SHOW COLUMNS FROM drills LIKE 'embedding';` returns a `longtext` column; `SHOW TABLES LIKE 'drill_recommendations';` returns the table.

2. **Embed drills** (one-time):
   ```bash
   curl -s -X POST localhost:8080/api/admin/drills/embed -H "Authorization: Bearer $TOKEN"
   # → {"embedded":30}
   ```
   Confirm: `SELECT COUNT(*) FROM drills WHERE embedding IS NOT NULL;` → `30`; spot-check one row's `embedding` is a JSON array of doubles.

3. **Unauthenticated is rejected**:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" -X POST localhost:8080/api/admin/drills/embed   # → 401
   curl -s -o /dev/null -w "%{http_code}" localhost:8080/api/players/$PID/recommendations  # → 401
   ```

4. **Generate recommendations** (cold):
   ```bash
   curl -s -X POST "localhost:8080/api/players/$PID/recommendations/generate" -H "Authorization: Bearer $TOKEN" | jq
   ```
   Confirm: 200; `recommendations` has **3–5** items; each has a real `drillId`/`drillName`, non-empty `rationale` & `expectedOutcome`, and a numeric `similarityScore` in `(0,1]`; `generatedAt` is now. `SELECT COUNT(*) FROM drill_recommendations WHERE player_id=$PID AND is_current=1;` matches the array length.

5. **Cache cooldown holds** — immediate re-generate returns the same set without calling out:
   ```bash
   curl -s -X POST "localhost:8080/api/players/$PID/recommendations/generate" -H "Authorization: Bearer $TOKEN" | jq '.generatedAt'
   ```
   Confirm: identical `generatedAt` to step 4; server logs show no Gemini/DeepSeek request.

6. **Force bypasses cache & swaps current**:
   ```bash
   curl -s -X POST "localhost:8080/api/players/$PID/recommendations/generate?force=true" -H "Authorization: Bearer $TOKEN" | jq '.generatedAt'
   ```
   Confirm: new `generatedAt`; `SELECT COUNT(*) FROM drill_recommendations WHERE player_id=$PID AND is_current=0;` increased (old set marked stale); exactly one current set remains.

7. **GET returns cached, no external calls**:
   ```bash
   curl -s "localhost:8080/api/players/$PID/recommendations" -H "Authorization: Bearer $TOKEN" | jq
   ```
   Confirm: matches the most recent generated set; logs show no AI calls.

8. **Player with no observations → 400**:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" -X POST "localhost:8080/api/players/<EMPTY_PID>/recommendations/generate" -H "Authorization: Bearer $TOKEN"  # → 400, body "Player has no observations"
   ```

9. **Cross-coach isolation → 404** — using coach A's token against coach B's player id returns 404 `Player not found`.

10. **Provider-down resilience → 502, app survives** — temporarily set `DEEPSEEK_API_KEY` to garbage, `force=true` generate:
    ```bash
    curl -s -o /dev/null -w "%{http_code}" -X POST "localhost:8080/api/players/$PID/recommendations/generate?force=true" -H "Authorization: Bearer $TOKEN"  # → 502
    curl -s localhost:8080/actuator/health   # → {"status":"UP"} — app did not crash
    ```

11. **No-embeddings guard** — `UPDATE drills SET embedding=NULL;` then `force=true` generate → 502 `No embedded drills found — run /api/admin/drills/embed first`. (Re-run step 2 to restore.)

12. **Compiles clean / no leftover scaffolding**:
    ```bash
    ./mvnw -q -DskipTests compile   # builds; grep shows no TODO/obvious comments in new files
    grep -rn "TODO" backend/src/main/java/com/crick/{embedding,recommendation,config/AiConfig.java}  # → no output
    ```

---

## 9. Self-score

**Confidence: 9/10** for one-pass implementation.

Rationale: file list, package layout, entity/column mappings, repository queries, the two external-call contracts (auth styles, URL shapes, response DTOs), cache logic, validation, exception→status mapping, migrations, and verification are all specified against the actual codebase conventions verified by reading the existing source (BaseEntity, GlobalExceptionHandler envelope, `@CurrentUser`, `findByIdAndCoachId`, the existing fetch-join observation query, migration style).

Two deliberate deviations from INITIAL.md, both justified inline and low-risk:
- **Decision #2** — used a JPA `AttributeConverter` instead of `setEmbeddingFromList`/`getEmbeddingAsList` helpers on the entity (entities can't inject `ObjectMapper`; the converter is idiomatic and writes the identical JSON string). If you'd rather I follow INITIAL.md literally with static-`ObjectMapper` helper methods on `Drill`, say so.
- **Decision #15** — `AiException` mapped to **502** (upstream failure) rather than a generic 500. This better matches "external call failed" semantics.

The only residual unknown is the exact runtime output dimensionality of `gemini-embedding-001` (768 vs 3072) — it does not affect the code (cosine is dimension-agnostic as long as query and drills share the model), and the length-guard (decision #19) catches any accidental mix. No blocking questions; safe to proceed to `/execute-prp`.
