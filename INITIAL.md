# Feature 1: Coach Authentication (Backend Only)

## What to build

JWT-based authentication for coaches. Register and login endpoints. A security filter that protects all routes except auth endpoints. A mechanism to inject the current authenticated user into any controller method.

This is backend only. No frontend work.

## Context

Read `CLAUDE.md` before writing any code — it defines the schema, tech stack, and code standards.

Feature 0 is complete. The project has:
- Spring Boot 3.x running with Java 21
- MySQL 8 via Docker Compose
- Flyway migrations enabled (V1__baseline.sql exists)
- SecurityConfig currently permits all requests
- GlobalExceptionHandler with consistent error format
- BaseEntity with `id` and `createdAt`
- CORS configured for localhost:5173

## Endpoints

### POST /api/auth/register

Request body:
```json
{
  "email": "coach@example.com",
  "password": "minimum8chars",
  "name": "Coach Name"
}
```

Response (201):
```json
{
  "token": "jwt-string",
  "user": { "id": 1, "email": "coach@example.com", "name": "Coach Name" }
}
```

Validation: email must be valid format, email must be unique (409 if duplicate), password minimum 8 characters, name not blank.

### POST /api/auth/login

Request body:
```json
{
  "email": "coach@example.com",
  "password": "minimum8chars"
}
```

Response (200): same shape as register response.

On bad credentials return 401 with `{ "error": "Invalid email or password" }`. Do not reveal whether email exists or password is wrong — same message for both.

## Files to create

### Migration
- `V2__create_users_table.sql` — Users table: `id` BIGINT AUTO_INCREMENT, `email` VARCHAR(255) UNIQUE NOT NULL, `password_hash` VARCHAR(255) NOT NULL, `name` VARCHAR(100) NOT NULL, `role` VARCHAR(20) NOT NULL DEFAULT 'COACH', `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP.

### Entity
- `User.java` — extends BaseEntity. Fields map to the table. Role is an enum (`COACH`). Password hash is never serialized to JSON (`@JsonIgnore`).

### Auth package (`com.crick.auth`)
- `AuthController.java` — the two endpoints above. Uses `AuthService`.
- `AuthService.java` — handles registration (hash password, save user, generate token) and login (find by email, verify password, generate token).
- `RegisterRequest.java` — DTO with Jakarta validation annotations.
- `LoginRequest.java` — DTO with Jakarta validation annotations.
- `AuthResponse.java` — DTO with token and user info (record or class, either works).

### Security package (`com.crick.config`)
- `JwtService.java` — generate token (claims: userId, email; expiry: 24h), parse/validate token, extract userId from token. Use `io.jsonwebtoken` (jjwt). Signing key from `JWT_SECRET` env var.
- `JwtAuthenticationFilter.java` — extends `OncePerRequestFilter`. Reads `Authorization: Bearer <token>` header. If valid, sets authentication in SecurityContext. If missing or invalid, does nothing (let Spring Security handle the 401).
- Update `SecurityConfig.java` — add the JWT filter before `UsernamePasswordAuthenticationFilter`. Permit `/api/auth/**` and `/actuator/health`. Require authentication for everything else. Keep CSRF disabled, stateless sessions.

### User resolution
- `CurrentUser.java` — custom annotation (`@Target(PARAMETER)`, `@Retention(RUNTIME)`).
- `CurrentUserArgumentResolver.java` — implements `HandlerMethodArgumentResolver`. Reads userId from SecurityContext, loads User from repository, injects into controller parameter. Returns 401 if user not found.
- Register the resolver in a `WebMvcConfig.java`.

### Repository
- `UserRepository.java` — extends JpaRepository. Methods: `findByEmail(String email)`, `existsByEmail(String email)`.

## Constraints

- Password hashing with BCrypt via Spring Security's `PasswordEncoder` bean.
- JWT secret must come from environment variable, not hardcoded. In `application.yml` default to a dev-only value so local development works without setting env vars.
- Do not create a `/api/auth/me` endpoint — not needed for v1.
- Do not add role-based access control beyond checking that a valid JWT exists. There is only one role (COACH) in v1.
- Do not create any user seeding or admin endpoints. Seeding comes in Feature 9.
- No Javadoc. No comments explaining obvious code. Only comment `why`, never `what`.
- No unused imports. No placeholder TODOs.
- Keep files short — if any file exceeds 80 lines, reconsider.

## How to verify

After implementation, these must all pass:

1. `POST /api/auth/register` with valid data → 201, returns JWT and user object
2. `POST /api/auth/register` with duplicate email → 409, error message
3. `POST /api/auth/register` with missing/invalid fields → 400, validation errors in details
4. `POST /api/auth/login` with correct credentials → 200, returns JWT
5. `POST /api/auth/login` with wrong password → 401, generic error
6. `POST /api/auth/login` with nonexistent email → 401, same generic error
7. `GET /api/players` (a protected route, even though the controller doesn't exist yet) without token → 401
8. `GET /actuator/health` without token → 200 (public)
9. JWT token contains userId claim and expires after 24h

Run these checks with curl or write a quick test. Fix any failures before declaring done.
