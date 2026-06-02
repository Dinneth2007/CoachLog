# Feature 6 Frontend: AI Drill Recommendations

## What to build

A recommendations section on the player profile page. Shows AI-generated drill recommendations with rationale, similarity scores, and links to drill details. Coach can trigger new recommendations.

This is frontend only. Backend endpoints already exist.

## Context

Read `CLAUDE.md` before writing any code.

Backend endpoints available:
- `GET /api/players/{id}/recommendations` — returns cached recommendations (may be empty array)
- `POST /api/players/{id}/recommendations/generate?force=false` — triggers RAG pipeline, returns recommendations
- `GET /api/drills/{id}` — drill detail (already built)

Each recommendation: `{ drillId, drillName, skillArea, rationale, expectedOutcome, similarityScore }`

Feature 4 frontend (player profile with analytics) is complete.

## Files to create

### API functions (`src/api/recommendations.ts`)
- `getRecommendations(playerId)` — GET cached recommendations
- `generateRecommendations(playerId, force?)` — POST to trigger generation
- Typed interfaces

### Recommendations component (`src/components/RecommendationSection.tsx`)
- Displayed on the player profile page below the analytics section
- **States:**
  - Empty: "No recommendations yet — generate your first set" with generate button
  - Loaded: list of 3–5 recommendation cards
  - Loading: spinner/skeleton during generation (LLM calls take a few seconds)
  - Error: "Recommendations unavailable — try again later"
- **Each recommendation card:**
  - Drill name (linked to `/drills/{drillId}`)
  - Skill area badge (same colour scheme as analytics charts)
  - Similarity score as a subtle percentage or bar
  - Rationale text (the AI's explanation — this is the trust layer)
  - Expected outcome text
- **Generate button:**
  - "Generate Recommendations" if none exist
  - "Refresh Recommendations" if they exist, with "Last generated: [timestamp]" below
  - Disable and show "Generated recently — available again in X hours" if within 24h cooldown (unless force)
- **Section header:** "AI-Recommended Drills" with a subtle AI/sparkle icon

### Update PlayerProfilePage
- Import and render RecommendationSection below existing analytics
- Pass playerId as prop

## Constraints

- TanStack Query for fetching. Mutation for generate with cache invalidation.
- If backend returns empty recommendations, show empty state — don't auto-trigger generation.
- Link drill names to drill detail pages (already built in Feature 5).
- Keep styling consistent with the analytics section above it.
- No obvious comments. No TODOs.

## Testing note

The embedding API key is currently exhausted. To test the UI, you can either:
- Manually insert a few rows into `drill_recommendations` table, or
- Just verify the empty state and loading state render correctly for now

## Verify

1. Player profile shows recommendation section — empty state with generate button renders correctly
