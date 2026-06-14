# Deploying Crick (free tier)

This guide deploys the MVP fully free:

| Piece            | Host                  | How                         |
|------------------|-----------------------|-----------------------------|
| MySQL 8 database | **Aiven** (free plan) | Managed MySQL               |
| Spring Boot API  | **Render** Web Service| **Docker** container        |
| React frontend   | **Render** Static Site| Vite build → static files   |

```
[ Render Static Site ] --HTTPS /api--> [ Render Web Service (Docker) ] --TLS--> [ Aiven MySQL ]
        React build                          Spring Boot jar                       managed DB
```

Render's free web service **sleeps after 15 min idle** — the first request then takes ~30–50s to wake. Fine for a demo.

---

## Prerequisites

- Code pushed to GitHub (branch with the Docker config — see bottom).
- A free **GitHub**, **Aiven**, and **Render** account (sign into Aiven & Render *with* GitHub).

---

## Part 1 — Create the MySQL database (Aiven)

1. Go to https://aiven.io → **Sign up** (use GitHub).
2. **Create service** → choose **MySQL**.
3. Plan: pick the **Free** plan. Cloud/region: pick one close to you (e.g. an EU/US region).
4. Name it `crick-mysql` → **Create service**. Wait ~2–3 min until status is **Running**.
5. Open the service → **Overview** tab → **Connection information**. Note these (you'll need them):
   - **Host**, **Port**, **User** (`avnadmin`), **Password**, **Database name** (`defaultdb`).
6. Build your JDBC URL (Aiven requires SSL):
   ```
   jdbc:mysql://HOST:PORT/defaultdb?sslMode=REQUIRED&serverTimezone=UTC
   ```
   Replace `HOST` and `PORT` with the values from step 5.

> Flyway will create all tables + seed the 30 drills automatically on first backend boot.

---

## Part 2 — Deploy the backend (Render Web Service, Docker)

1. Go to https://render.com → **Sign up** with GitHub.
2. **New +** → **Web Service** → connect your `CoachLog` repo.
3. Settings:
   - **Name:** `crick-api`
   - **Root Directory:** `backend`
   - **Runtime / Language:** **Docker** (Render auto-detects `backend/Dockerfile`)
   - **Instance Type:** **Free**
4. **Environment Variables** → add these (Add from .env or one by one):

   | Key | Value |
   |-----|-------|
   | `SPRING_PROFILES_ACTIVE` | `prod` |
   | `SPRING_DATASOURCE_URL` | your JDBC URL from Part 1 |
   | `SPRING_DATASOURCE_USERNAME` | `avnadmin` |
   | `SPRING_DATASOURCE_PASSWORD` | Aiven password |
   | `JWT_SECRET` | a long random string (see below) |
   | `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` *(update in Part 4)* |
   | `PARENT_LINK_BASE_URL` | `http://localhost:5173/parent` *(update in Part 4)* |
   | `GEMINI_API_KEY` | your Gemini key (for AI features) |
   | `DEEPSEEK_API_KEY` | your DeepSeek key (for AI features) |
   | `CRICK_REGISTRATION_ENABLED` | `false` |

   Generate a JWT secret locally:
   ```bash
   openssl rand -base64 48
   ```
5. **Create Web Service.** First build takes ~5–8 min (Docker build + Maven). When live, note the URL, e.g. `https://crick-api.onrender.com`.
6. Sanity check: open `https://crick-api.onrender.com/actuator/health` → should show `{"status":"UP"}`.

---

## Part 3 — Deploy the frontend (Render Static Site)

1. Render → **New +** → **Static Site** → same repo.
2. Settings:
   - **Name:** `crick-web`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
3. **Environment Variables:**

   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://crick-api.onrender.com/api` (your backend URL + `/api`) |

   > Vite bakes this in at **build** time, so it must be set before the build.
4. **Create Static Site.** Note the URL, e.g. `https://crick-web.onrender.com`.
5. **Add the SPA rewrite** (so React Router deep links / parent links work):
   - Static site → **Redirects/Rewrites** → **Add Rule**
   - **Source:** `/*`  **Destination:** `/index.html`  **Action:** **Rewrite**

---

## Part 4 — Connect the two (fix the URLs)

Now that you know the frontend URL, update the backend env vars:

1. Render → `crick-api` → **Environment** → edit:
   - `CORS_ALLOWED_ORIGINS` = `https://crick-web.onrender.com`
   - `PARENT_LINK_BASE_URL` = `https://crick-web.onrender.com/parent`
2. **Save** → Render auto-redeploys the backend.

---

## Part 5 — Seed demo data + verify

The prod DB has the schema + 30 drills, but no coach/players yet. Seed it (run once):

```bash
# from the backend/ folder, using the Aiven connection details:
mysql -h HOST -P PORT -u avnadmin -pPASSWORD defaultdb < seed_prod.sql
```
(`seed_prod.sql` is generated for you — see the seeding step.)

Then verify:
- Open `https://crick-web.onrender.com` → log in with **demo@crick.app / password**.
- Dashboard, charts, recommendations, and a parent link should all load.

---

## Environment variable reference

**Backend (`crick-api`):** `SPRING_PROFILES_ACTIVE`, `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`, `PARENT_LINK_BASE_URL`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `CRICK_REGISTRATION_ENABLED`

**Frontend (`crick-web`):** `VITE_API_URL`

---

## Troubleshooting

- **Frontend loads but every call fails / CORS error** → `CORS_ALLOWED_ORIGINS` doesn't exactly match the frontend URL (no trailing slash), or you didn't redeploy after changing it.
- **Backend won't start, `Communications link failure`** → wrong `SPRING_DATASOURCE_URL`/password, or missing `sslMode=REQUIRED`.
- **`Flyway ... validate failed`** → the DB already has partial tables; for a fresh demo, drop & recreate the Aiven database, or use a clean `defaultdb`.
- **First request super slow** → free web service was asleep; this is expected.
- **Refreshing a deep link 404s** → the SPA rewrite rule (Part 3.5) is missing.
