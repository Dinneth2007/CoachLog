# PRP — Feature 1: Coach Authentication (Backend Only)

> Source: `INITIAL.MD`. Global rules: `CLAUDE.md`. Scaffolding state: Feature 0 complete (Spring Boot 3.5.14, Java 21, Flyway, JJWT 0.12.6, permissive `SecurityConfig`, `BaseEntity`, `GlobalExceptionHandler` returning `{ error, details }`, CORS for `localhost:5173`, `V1__baseline.sql` is a no-op).

---

## 1. Summary

Add JWT-based authentication for cricket coaches: a `Users` table (Flyway V2), a `User` JPA entity, register and login endpoints that issue 24-hour JWTs, a stateless Spring Security filter chain that protects every route except `/api/auth/**` and `/actuator/health`, and a `@CurrentUser` parameter resolver that any future controller can use to inject the authenticated coach. Passwords are BCrypt-hashed; bad-credential responses are intentionally generic to avoid user enumeration. This unblocks every subsequent feature, all of which scope data to `coach_id`.

---

## 2. Architecture decisions

| Decision | Choice | Why | Alternatives rejected |
|---|---|---|---|
| Token transport | `Authorization: Bearer <jwt>` header | INITIAL.MD specifies it; standard for stateless APIs; aligns with frontend axios JWT interceptor (Feature 0). | HttpOnly cookies — CLAUDE.md Feature 1 says localStorage is acceptable for portfolio scope; cookies add CSRF surface for SPA. |
| JWT library | JJWT 0.12.6 (already in `pom.xml`) | Already a project dependency; modern fluent API; `Jwts.parser().verifyWith(key).build()` style for 0.12.x. | Auth0 `java-jwt` — would require a new dependency. Spring Authorization Server — overkill for a single-tenant portfolio app. |
| JWT claims | `sub = userId` (string), `email` (custom claim), standard `iat`/`exp` | INITIAL.MD requires `userId` claim; using `sub` is idiomatic. Email kept for logging/debugging. | Putting `role` claim in — only one role exists (COACH); deferred per INITIAL.MD constraint. |
| JWT signing | HS256 with a `SecretKey` derived from `JWT_SECRET` env var (Base64-decoded if ≥256-bit material, otherwise UTF-8 bytes). Fail fast if dev default is used in `prod` profile. | HS256 is the right choice for a single-service backend; avoids keypair management. | RS256 — adds key-rotation complexity not justified at portfolio scale. |
| Auth filter wiring | `JwtAuthenticationFilter extends OncePerRequestFilter`, registered via `http.addFilterBefore(..., UsernamePasswordAuthenticationFilter.class)` | INITIAL.MD specifies it; OncePerRequestFilter is the canonical Spring filter base class. | Custom `AuthenticationProvider` + `DaoAuthenticationProvider` — heavier; we don't use form login. |
| User principal in `SecurityContext` | Store `userId` (Long) as the `Authentication.principal`, no `UserDetailsService` | We never need Spring's authority/role machinery in v1; lighter. The `CurrentUserArgumentResolver` re-hydrates the `User` from the DB. | Custom `UserDetails` impl — unnecessary; we'd just be ignoring its fields. |
| `@CurrentUser` re-hydration | Resolver loads `User` from `UserRepository` on every request | Trivially correct, single SELECT by PK is cheap, ensures stale-token-after-user-deleted returns 401. | Caching `User` on the filter and passing via request attribute — premature optimisation; introduces cache invalidation. |
| Bad-credential response | Same 401 + `{"error":"Invalid email or password"}` for "no such user" and "wrong password" | INITIAL.MD requires it (anti-enumeration). | Distinct 404 vs 401 — leaks account existence. |
| Duplicate email | 409 with `{"error":"Email already registered"}` | Standard REST semantics for conflict. INITIAL.MD specifies 409. | 400 — wrong code; conflict is the precise meaning. |
| Validation errors | 400 with `{"error":"Validation failed","details":{ field: msg }}` via existing `GlobalExceptionHandler` | Already wired in Feature 0; consistent with project's error contract. | New handler per controller — duplication. |
| Lombok | Use `@Getter`/`@Setter`/`@RequiredArgsConstructor` for entity + services; **records** for DTOs | Matches the existing `BaseEntity` style; records are idiomatic for immutable DTOs. | All-Lombok everywhere — DTOs as records are more concise and read-only. |
| `RegisterRequest` exposure | Keep endpoint always on; gate with config flag in `application.yml` (`crick.auth.registration-enabled`) — default `true` in `dev`, `false` in `prod`. Return 404 (route effectively absent) when disabled. | INITIAL.MD says "disable or protect in prod". Config flag is the smallest change; portfolio app doesn't need an admin role. | Remove endpoint entirely in prod build — would break demo seeding flow in Feature 9. |
| Password verification | `PasswordEncoder` bean (BCrypt, strength 10 = Spring default) | INITIAL.MD specifies BCrypt. | Argon2 — fine but not requested; BCrypt is the explicit ask. |

---

## 3. File-by-file implementation plan

Implementation order is bottom-up: migration → entity/repo → DTOs → JWT/security primitives → service → controller → security wiring → argument resolver. Each file should stay under ~80 lines per INITIAL.MD constraint.

### Step 1 — Migration

**`backend/src/main/resources/db/migration/V2__create_users_table.sql`** (new)
- Creates the `users` table per the schema in INITIAL.MD.
- Single statement; uses MySQL 8 syntax (InnoDB default, utf8mb4).
- Includes `UNIQUE` constraint on `email` for both validation and concurrent-insert safety.
- See full SQL in section 4.

### Step 2 — Entity & Repository

**`backend/src/main/java/com/crick/auth/User.java`** (new)
- JPA entity, `@Entity @Table(name="users")`, extends `BaseEntity` (inherits `id` + `createdAt`).
- Fields: `email` (String, non-null, unique), `passwordHash` (String, non-null, mapped to `password_hash`, annotated `@JsonIgnore` so it never serializes), `name` (String, non-null), `role` (enum `Role` mapped via `@Enumerated(EnumType.STRING)`, default `Role.COACH`).
- Nested or sibling enum `Role { COACH }` — keep in same file to stay under 80 lines and because it's referenced only here in v1.
- Lombok `@Getter @Setter @NoArgsConstructor` (JPA needs no-arg) + an all-args constructor or builder for the service to use.

**`backend/src/main/java/com/crick/auth/UserRepository.java`** (new)
- `interface UserRepository extends JpaRepository<User, Long>`.
- `Optional<User> findByEmail(String email);`
- `boolean existsByEmail(String email);`
- Spring Data derives both query methods from naming; no `@Query` needed.

### Step 3 — DTOs (records)

**`backend/src/main/java/com/crick/auth/RegisterRequest.java`** (new)
- `public record RegisterRequest(@Email @NotBlank String email, @NotBlank @Size(min=8, max=72) String password, @NotBlank @Size(max=100) String name) {}`.
- `max=72` on password is the BCrypt limit (truncation safety).
- `max=100` on name matches `VARCHAR(100)` in the table.

**`backend/src/main/java/com/crick/auth/LoginRequest.java`** (new)
- `public record LoginRequest(@Email @NotBlank String email, @NotBlank String password) {}`.
- No length constraint on password input — we only constrain at registration; login just verifies what was sent.

**`backend/src/main/java/com/crick/auth/AuthResponse.java`** (new)
- `public record AuthResponse(String token, UserSummary user) { public record UserSummary(Long id, String email, String name) {} }`.
- Used as the response body for both register and login.

### Step 4 — JWT primitives

**`backend/src/main/java/com/crick/config/JwtService.java`** (new)
- `@Service` (or `@Component`) with `@Value`-injected `${crick.jwt.secret}` and `${crick.jwt.expiration-ms:86400000}` (24h).
- On construction (`@PostConstruct`), derive a `javax.crypto.SecretKey` via `Keys.hmacShaKeyFor(secretBytes)`. Accept the secret as either Base64 (preferred) or raw UTF-8 bytes — try Base64 decode first, fall back to `getBytes(UTF_8)`. Throw on startup if the resulting key is < 32 bytes (HS256 minimum).
- `String generateToken(Long userId, String email)` — sets `subject = userId.toString()`, claim `email`, `issuedAt = now`, `expiration = now + expirationMs`, signs with the key. JJWT 0.12 API: `Jwts.builder().subject(...).claim(...).issuedAt(...).expiration(...).signWith(key).compact()`.
- `Optional<Long> parseUserId(String token)` — `Jwts.parser().verifyWith(key).build().parseSignedClaims(token)`; on any `JwtException` return `Optional.empty()`. Returns `Long.valueOf(claims.getSubject())`.

**`backend/src/main/java/com/crick/config/JwtAuthenticationFilter.java`** (new)
- `@Component`, extends `OncePerRequestFilter`. Constructor-injected `JwtService` (no `UserRepository` here — keeps the filter cheap; resolver does the DB lookup).
- Reads `Authorization` header; if it starts with `"Bearer "`, strips the prefix and calls `jwtService.parseUserId(token)`.
- On valid token: builds a `UsernamePasswordAuthenticationToken(userId, null, List.of())` (empty authorities — we don't use roles in v1) with `details = WebAuthenticationDetailsSource().buildDetails(req)`, sets it on `SecurityContextHolder`.
- On missing/invalid: does nothing — `chain.doFilter` proceeds; Spring Security will 401 if the matched route requires auth.
- Skip filter logic entirely for `/api/auth/**` and `/actuator/health` via an early `if (path.startsWith(...)) { chain.doFilter; return; }` — small perf win, also prevents accidental context pollution.

### Step 5 — Service

**`backend/src/main/java/com/crick/auth/AuthService.java`** (new)
- `@Service`, constructor-injected `UserRepository`, `PasswordEncoder`, `JwtService`.
- `AuthResponse register(RegisterRequest req)`:
  1. `if (userRepository.existsByEmail(req.email())) throw new EmailAlreadyExistsException(...)` — see custom exception below.
  2. Build `User`: email lowercased+trimmed (`req.email().trim().toLowerCase(Locale.ROOT)`), `passwordHash = passwordEncoder.encode(req.password())`, name trimmed, role `COACH`.
  3. `userRepository.save(user)`.
  4. Generate token, return `AuthResponse`.
- `AuthResponse login(LoginRequest req)`:
  1. Look up user by email (lowercased+trimmed).
  2. If missing OR `passwordEncoder.matches(req.password(), user.getPasswordHash())` returns false → throw `InvalidCredentialsException`. Same exception in both branches.
  3. Generate token, return `AuthResponse`.
- Two small exceptions defined in the same package (or as nested static classes inside `AuthService`):
  - `EmailAlreadyExistsException extends RuntimeException`
  - `InvalidCredentialsException extends RuntimeException`
  Adding two `@ExceptionHandler`s in `GlobalExceptionHandler` is cleaner than throwing `ResponseStatusException` inline.

### Step 6 — Controller

**`backend/src/main/java/com/crick/auth/AuthController.java`** (new)
- `@RestController @RequestMapping("/api/auth") @RequiredArgsConstructor`.
- Constructor-injected `AuthService` and `@Value("${crick.auth.registration-enabled:true}") boolean registrationEnabled`.
- `POST /register` — `@Valid @RequestBody RegisterRequest`. If `!registrationEnabled` throw `ResponseStatusException(HttpStatus.NOT_FOUND)` so prod looks like the route doesn't exist. Else delegate to `authService.register(...)`, return `ResponseEntity.status(201).body(response)`.
- `POST /login` — `@Valid @RequestBody LoginRequest`, returns `ResponseEntity.ok(authService.login(...))`.
- No other endpoints (no `/me` per INITIAL.MD).

### Step 7 — Update existing files

**`backend/src/main/java/com/crick/common/GlobalExceptionHandler.java`** (modify)
- Add handler for `AuthService.EmailAlreadyExistsException` → 409 with `new ErrorResponse("Email already registered", null)`.
- Add handler for `AuthService.InvalidCredentialsException` → 401 with `new ErrorResponse("Invalid email or password", null)`.
- Add handler for `org.springframework.web.server.ResponseStatusException` → returns its status with `new ErrorResponse(ex.getReason() != null ? ex.getReason() : "Not found", null)` (used by the disabled-registration path).

**`backend/src/main/java/com/crick/config/SecurityConfig.java`** (modify)
- Constructor-inject `JwtAuthenticationFilter` and a custom `AuthenticationEntryPoint` (return 401 with `{"error":"Unauthorized","details":null}` JSON — write a tiny inline lambda using `response.setStatus(401)`, `setContentType("application/json")`, write the bytes manually; this keeps the dependency footprint zero).
- Replace `auth.anyRequest().permitAll()` with:
  - `requestMatchers("/api/auth/**", "/actuator/health").permitAll()`
  - `anyRequest().authenticated()`
- Add `.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)`.
- Add `.exceptionHandling(eh -> eh.authenticationEntryPoint(entryPoint))`.
- Add `@Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }`.

**`backend/src/main/resources/application.yml`** (modify)
- Under root (shared by all profiles), add:
  ```yaml
  crick:
    jwt:
      secret: ${JWT_SECRET:dev-only-secret-change-me-32-bytes-min-1234567890}
      expiration-ms: 86400000
    auth:
      registration-enabled: ${CRICK_REGISTRATION_ENABLED:true}
  ```
- Under `prod` profile, override `crick.auth.registration-enabled: false` (so registration is off in prod by default; can be flipped via env var for seeding).
- Under `prod`, also override `crick.jwt.secret: ${JWT_SECRET}` with no default so the app fails fast in prod if the env var is missing.

### Step 8 — Argument resolver

**`backend/src/main/java/com/crick/auth/CurrentUser.java`** (new)
- `@Target(ElementType.PARAMETER) @Retention(RetentionPolicy.RUNTIME) public @interface CurrentUser {}`.
- Marker annotation only; no attributes.

**`backend/src/main/java/com/crick/auth/CurrentUserArgumentResolver.java`** (new)
- `@Component`, constructor-injected `UserRepository`.
- `implements HandlerMethodArgumentResolver`.
- `supportsParameter`: returns `param.hasParameterAnnotation(CurrentUser.class) && param.getParameterType().equals(User.class)`.
- `resolveArgument`: read `Authentication` from `SecurityContextHolder.getContext()`; if null or principal is not a `Long`, throw `ResponseStatusException(HttpStatus.UNAUTHORIZED)`. Otherwise `userRepository.findById((Long) principal).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED))`.

**`backend/src/main/java/com/crick/config/WebMvcConfig.java`** (new)
- `@Configuration implements WebMvcConfigurer`. Constructor-injects `CurrentUserArgumentResolver`.
- Overrides `addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers)` to add it.

---

## 4. Data model changes

### Migration: `V2__create_users_table.sql`

```sql
CREATE TABLE users (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    name            VARCHAR(100) NOT NULL,
    role            VARCHAR(20)  NOT NULL DEFAULT 'COACH',
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Notes:
- `email` `VARCHAR(255)` matches the BaseEntity-agnostic length used everywhere; the unique key prevents a race between two simultaneous registrations slipping past the `existsByEmail` check.
- `role` stored as `VARCHAR(20)` to match the JPA `@Enumerated(EnumType.STRING)` mapping. Default `'COACH'` allows future inserts without specifying the column.
- `created_at` has a DB-side default so seed scripts can omit it; JPA's `@CreatedDate` will populate it on entity persistence either way.

No other schema changes. No alterations to `V1__baseline.sql` (CLAUDE.md: never modify a released migration).

---

## 5. Edge cases and error handling

| Scenario | Behaviour |
|---|---|
| Register with email already in use | `existsByEmail` returns true → `EmailAlreadyExistsException` → 409 `{"error":"Email already registered"}`. |
| Race: two registers with same email pass `existsByEmail` simultaneously | Second `save` throws `DataIntegrityViolationException` from the unique constraint. Add a handler in `GlobalExceptionHandler` that maps it to the same 409 response. (Belt-and-braces; portfolio-acceptable.) |
| Register with malformed email | `@Email` fails → 400 with `details.email`. |
| Register with password < 8 chars or > 72 | `@Size` fails → 400. The 72-char ceiling avoids BCrypt's silent truncation. |
| Register with empty name | `@NotBlank` fails → 400. |
| Login with nonexistent email | `InvalidCredentialsException` → 401 `{"error":"Invalid email or password"}`. Same message as wrong-password. Anti-enumeration. |
| Login with wrong password | Same as above. **Do not** add timing-safe comparison beyond what BCrypt provides; BCrypt `matches` is constant-time over the hash. Still call `passwordEncoder.matches` against a dummy hash when the user is missing? **Not required for v1** — flag below. |
| Request with `Authorization: Bearer <garbage>` | `parseUserId` returns empty → filter does nothing → matched route requires auth → entry point returns 401. |
| Request with expired token | `Jwts.parser` throws `ExpiredJwtException` (subtype of `JwtException`) → caught → empty → 401. |
| Request with valid token but user deleted from DB | Argument resolver throws 401. Filter would have set authentication based on a stale `userId`, but no controller can run without the resolver succeeding. |
| Missing `Authorization` header on protected route | Filter does nothing → `AuthenticationEntryPoint` returns 401. |
| `JWT_SECRET` env var missing in prod | `JwtService` constructor fails fast at startup. Acceptable: prod must not boot without a real secret. |
| `JWT_SECRET` is < 32 bytes | `Keys.hmacShaKeyFor` throws `WeakKeyException` at startup. Make this fatal — log a clear message. |
| Clock skew between issuer and verifier (same process here) | N/A — single service issues and verifies. |
| Email casing inconsistency | Normalise (lowercase + trim) before save AND before lookup. Document inline only if it would surprise a reader. |
| Whitespace in name | Trim during register; do not over-validate. |
| CORS preflight (`OPTIONS`) hits filter | `CorsFilter` is already registered as a `@Bean`; ensure the JWT filter does not block OPTIONS. The "skip for `/api/auth/**` and `/actuator/health`" early-return already covers nothing here — add `if (HttpMethod.OPTIONS.matches(req.getMethod())) { chain.doFilter; return; }` at the very top of `doFilterInternal`. |
| Disabled registration in prod | `AuthController.register` throws `ResponseStatusException(NOT_FOUND)` → handler returns 404. Looks identical to a non-existent endpoint. |

**Deliberately not handled in v1** (out of scope per CLAUDE.md "do not add features beyond what is specified"):
- Refresh tokens, password reset, email verification, account lockout / rate limiting on login, audit logging of login attempts.

---

## 6. Validation rules

| Field | Rule | Error response on failure |
|---|---|---|
| `RegisterRequest.email` | `@Email`, `@NotBlank`, ≤ 255 chars | 400 `{"error":"Validation failed","details":{"email":"..."}}` |
| `RegisterRequest.password` | `@NotBlank`, `@Size(min=8, max=72)` | 400 `{"error":"Validation failed","details":{"password":"..."}}` |
| `RegisterRequest.name` | `@NotBlank`, `@Size(max=100)` | 400 `{"error":"Validation failed","details":{"name":"..."}}` |
| `LoginRequest.email` | `@Email`, `@NotBlank` | 400 (validation error) — note: only triggered for malformed JSON; a well-formed but wrong email yields 401. |
| `LoginRequest.password` | `@NotBlank` | 400 if blank, else proceeds to credential check. |
| Email uniqueness | Service-level check + DB unique constraint | 409 `{"error":"Email already registered"}` |
| Credentials match | Service-level | 401 `{"error":"Invalid email or password"}` |
| JWT validity | `JwtAuthenticationFilter` + entry point | 401 `{"error":"Unauthorized"}` |

Note on details payload shape: `GlobalExceptionHandler.handleValidation` already builds `Map<String,String>` from `FieldError.getField → FieldError.getDefaultMessage`. Keep that as-is.

---

## 7. Dependencies between files (implementation order)

Strictly bottom-up so each step compiles before the next:

1. `V2__create_users_table.sql`
2. `User.java` (entity + `Role` enum)
3. `UserRepository.java`
4. `RegisterRequest.java`, `LoginRequest.java`, `AuthResponse.java` (independent; can be done in parallel)
5. `JwtService.java` (depends on nothing in this feature; reads `crick.jwt.*`)
6. `application.yml` update (adds `crick.jwt.*` and `crick.auth.*`) — must precede running the app even if `JwtService` will be created next
7. `AuthService.java` (depends on `UserRepository`, DTOs, `PasswordEncoder` bean, `JwtService`)
8. `GlobalExceptionHandler.java` update (adds handlers for the two custom exceptions + `DataIntegrityViolationException` + `ResponseStatusException`)
9. `AuthController.java` (depends on `AuthService` + DTOs)
10. `JwtAuthenticationFilter.java` (depends on `JwtService`)
11. `SecurityConfig.java` update (depends on `JwtAuthenticationFilter`; adds `PasswordEncoder` bean, switches authorization rules, wires entry point)
12. `CurrentUser.java` (no deps)
13. `CurrentUserArgumentResolver.java` (depends on `UserRepository`, `CurrentUser`, `User`)
14. `WebMvcConfig.java` (depends on `CurrentUserArgumentResolver`)

The `PasswordEncoder` bean in step 11 must exist before `AuthService` can be instantiated, but Spring resolves the bean graph at startup so source-order between 7 and 11 doesn't matter — both must be present before the app boots.

---

## 8. Verification checklist

Boot the app with `./mvnw spring-boot:run` (default `dev` profile, MySQL up via `docker compose up -d`). Run each check; all must pass before declaring done.

### Migrations
- [ ] **V2 ran:** `docker compose exec mysql mysql -ucrick -pcrick crick -e "DESCRIBE users;"` shows the expected columns and `uk_users_email` unique index (`SHOW INDEX FROM users;`).

### Register endpoint (INITIAL.MD verification items 1–3)
- [ ] **Happy path:**
  ```bash
  curl -i -X POST http://localhost:8080/api/auth/register \
    -H 'Content-Type: application/json' \
    -d '{"email":"coach@example.com","password":"password123","name":"Coach Name"}'
  ```
  Expect `HTTP/1.1 201`, body shape `{"token":"<jwt>","user":{"id":1,"email":"coach@example.com","name":"Coach Name"}}`. The JWT should have three dot-separated segments. The response body must **not** contain `password_hash` or `passwordHash`.
- [ ] **Duplicate email:** repeat the same request → `HTTP/1.1 409`, body `{"error":"Email already registered","details":null}`.
- [ ] **Validation errors:**
  ```bash
  curl -i -X POST http://localhost:8080/api/auth/register \
    -H 'Content-Type: application/json' \
    -d '{"email":"not-an-email","password":"short","name":""}'
  ```
  Expect `HTTP/1.1 400` with `details` containing keys `email`, `password`, `name`.

### Login endpoint (items 4–6)
- [ ] **Happy path:**
  ```bash
  curl -i -X POST http://localhost:8080/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"coach@example.com","password":"password123"}'
  ```
  Expect `HTTP/1.1 200`, same body shape as register.
- [ ] **Wrong password:** same body with `"password":"wrong"` → `HTTP/1.1 401`, body `{"error":"Invalid email or password","details":null}`.
- [ ] **Nonexistent email:** same body with `"email":"nobody@example.com"` → `HTTP/1.1 401`, **identical** body to the wrong-password case (byte-for-byte; verify with `diff`).

### Security filter (items 7–8)
- [ ] **Protected route, no token:**
  ```bash
  curl -i http://localhost:8080/api/players
  ```
  Expect `HTTP/1.1 401`. (Endpoint doesn't exist yet, but security check fires before the handler-not-found check, so we see 401, not 404 — this is the desired behaviour and is what INITIAL.MD asserts.)
- [ ] **Protected route, valid token:**
  ```bash
  TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"coach@example.com","password":"password123"}' | jq -r .token)
  curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/players
  ```
  Expect `HTTP/1.1 404` (no controller mapped yet) — proves the filter let an authenticated request through.
- [ ] **Protected route, garbage token:** `curl -i -H 'Authorization: Bearer garbage' http://localhost:8080/api/players` → `HTTP/1.1 401`.
- [ ] **Public actuator:** `curl -i http://localhost:8080/actuator/health` → `HTTP/1.1 200`.

### Token shape (item 9)
- [ ] **Decode payload:** `echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq` shows `sub` equal to the user id (as a string), an `email` claim, `iat`, and `exp` ≈ `iat + 86400`. Confirm `exp - iat == 86400`.

### Configuration & prod safety
- [ ] **Prod profile blocks weak secret:** `JWT_SECRET=short SPRING_PROFILES_ACTIVE=prod ./mvnw spring-boot:run` fails at startup with a clear message about key length (Keys.hmacShaKeyFor's `WeakKeyException`).
- [ ] **Prod disables registration:** with the prod profile and a valid secret/db, `POST /api/auth/register` returns 404.

### Code hygiene (per INITIAL.MD constraints)
- [ ] No file exceeds 80 lines. (`find backend/src/main/java/com/crick/{auth,config} -name '*.java' -exec wc -l {} +` — each file < 80.)
- [ ] No Javadoc, no "what" comments, no `TODO`s, no unused imports. (`./mvnw compile` succeeds with no warnings of these kinds; spot-check the files.)
- [ ] No `/api/auth/me` endpoint exists.
- [ ] `passwordHash` never appears in any JSON response. (`grep -i 'password' <login response>` returns nothing.)

### Unit/integration tests (optional but recommended for portfolio polish)
- [ ] `AuthControllerIT` spinning up `@SpringBootTest` with Testcontainers MySQL or `@DataJpaTest` for the repository plus `MockMvc` for the controller covers: register success, duplicate email, login success, login wrong-password (same response as missing email), protected-route 401.

---

## 9. Self-score

**Confidence: 9 / 10.**

What's solid:
- Every file in INITIAL.MD's "Files to create" list is mapped to a concrete plan with dependencies, behaviour, and rationale.
- The existing scaffolding (`GlobalExceptionHandler`, `BaseEntity`, `CorsFilter`, `application.yml` profile structure) has been read and the plan composes with it rather than duplicating it.
- The 0.12.x JJWT API is the right one for the project's pinned version (`0.12.6`).
- Verification checklist is mechanical — each item is a single curl or shell command.

Minor uncertainties (acceptable to resolve during implementation, not blocking):
- The exact wording of the validation messages for `@Email`/`@Size`/`@NotBlank` is locale-dependent (Hibernate Validator defaults). The contract just asserts that `details.<field>` exists with a non-empty string — that's enough.
- Whether to add the "dummy BCrypt compare on missing user to defend against timing-based enumeration" is intentionally **deferred**. INITIAL.MD only requires the same error *message*; equalising response time is a hardening step not requested for v1. Calling it out so we don't drift into scope creep.
- The dev default `JWT_SECRET` literal needs to be at least 32 ASCII bytes; the placeholder in section 3 is 48 chars to be safe. If the implementer prefers Base64, they can substitute, but the dev default must work without an env var per INITIAL.MD.

No blocking ambiguities. Proceeding to implementation should be one-pass.
