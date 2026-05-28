# Feature 1 Frontend: Auth (Login & Protected Routes)

## What to build

Login page, auth state management, and route protection. After this, unauthenticated users see only the login page. Authenticated users see the app shell with navigation.

This is frontend only. Backend auth endpoints already exist.

## Context

Read `CLAUDE.md` before writing any code.

Backend endpoints available:
- `POST /api/auth/register` → `{ token, user: { id, email, name } }`
- `POST /api/auth/login` → `{ token, user: { id, email, name } }`
- All other routes return 401 without a valid JWT

Frontend scaffolding from Feature 0 exists: Vite + React + TypeScript, Tailwind, TanStack Query, React Router, axios client with JWT interceptor in `src/api/client.ts`.

## Files to create

### Auth state (`src/hooks/useAuth.tsx`)
- AuthContext + AuthProvider wrapping the app
- State: `user` (null or `{ id, email, name }`), `token`, `isAuthenticated`, `isLoading`
- `login(email, password)` — calls `/api/auth/login`, stores token in localStorage, sets user
- `logout()` — clears token and user, redirects to `/login`
- On mount: check localStorage for existing token. If found, decode the user info from it or validate against the API. Set `isLoading` true until resolved.
- Export `useAuth()` hook

### API functions (`src/api/auth.ts`)
- `loginRequest(email, password)` — POST to `/api/auth/login`, returns response data
- `registerRequest(email, password, name)` — POST to `/api/auth/register`, returns response data
- Typed request/response interfaces

### Login page (`src/pages/LoginPage.tsx`)
- Email + password form
- Submit calls `login()` from useAuth
- Show error message on failed login
- Redirect to `/` on success
- Clean, centered layout. Nothing fancy — a card with form fields.
- No register form — registration is dev/seed only per CLAUDE.md

### Protected route wrapper (`src/components/ProtectedRoute.tsx`)
- Wraps routes that require auth
- If `isLoading`, show a simple spinner
- If not authenticated, redirect to `/login`
- If authenticated, render children

### Update `src/App.tsx`
- Wrap everything in `AuthProvider`
- `/login` route renders LoginPage (public)
- All other routes wrapped in ProtectedRoute
- `/parent/:token` stays outside ProtectedRoute (it uses magic links, not JWT)

### Update `src/layouts/AppLayout.tsx`
- Show coach name somewhere in the nav/header
- Add a logout button that calls `logout()` from useAuth

### Update `src/api/client.ts`
- Make sure the axios interceptor reads the token from localStorage
- On 401 response, clear token and redirect to `/login`

## Constraints

- No register page. Coach accounts are seeded or created via API directly.
- Token in localStorage is acceptable for portfolio scope. Do not overcomplicate with httpOnly cookies.
- Do not build any player-related UI — that's Feature 2 frontend.
- Keep styling minimal and clean. Functional, not decorative.
- No Javadoc-style comments. No TODOs.

## Verify

1. Open app → redirected to login → enter credentials → lands on dashboard
2. Refresh page → still logged in (token persists)
3. Click logout → redirected to login → cannot access other pages
