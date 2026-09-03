# DEPLOYMENT.md — PhotoDrop Backend

This is the single source of truth for backend setup, local development, and
deployment commands. (API reference lives in `API.md`. Frontend instructions
live in `frontend/README.md`.)

The app name (`PhotoDrop` by default) is read from `APP_NAME` in `.env` at
runtime — change it there, nowhere else.

---

## 1. Prerequisites

- Node.js >= 20
- Docker + Docker Compose (for local Postgres/Redis/MinIO)
- npm

## 2. Local setup

```bash
cd backend
cp .env.example .env
# edit .env: at minimum set a real JWT_ACCESS_SECRET
#   openssl rand -base64 48

npm install

# Starts Postgres, Redis, and MinIO (local S3) in the background
docker compose up -d

# Create the MinIO bucket referenced by S3_BUCKET in .env
docker compose exec minio mc alias set local http://localhost:9000 photodrop_minio photodrop_minio_secret
docker compose exec minio mc mb local/photodrop-photos
docker compose exec minio mc anonymous set download local/photodrop-photos  # public read for thumbnails

# Apply the database schema (runs every migration in src/db/migrations, in order)
npm run migrate
```

## 3. Running in development

Two processes run side by side: the API server and the background worker
that does thumbnailing/EXIF extraction. They are separate processes on
purpose — a slow/CPU-heavy image job must never block API request handling.

```bash
# terminal 1
npm run dev

# terminal 2
npm run dev:worker
```

API is now at `http://localhost:4000/api`. Health check: `GET /api/health`.

## 4. Running the test suite

```bash
npm test
```

## 5. Building for production

```bash
npm run build      # compiles TypeScript to dist/
npm run start       # runs the compiled API server (dist/server.js)
npm run start:worker  # runs the compiled worker (dist/workers/index.js)
```

Run `start` and `start:worker` as **separate, independently scalable
processes** (e.g. two ECS services, two Kubernetes deployments, or two
Railway/Render services). Scale worker replica count with photo-upload
volume, independent of API replica count.

## 6. Database migrations

Migrations are plain, numbered `.sql` files in `src/db/migrations/`, applied
forward-only and tracked in a `schema_migrations` table.

```bash
# Apply any migrations not yet applied to the target DATABASE_URL
npm run migrate
```

To add a new migration: create `src/db/migrations/0XX_description.sql` with
the next number, write forward-only SQL (no down-migrations — roll forward
with a corrective migration instead), and run `npm run migrate`.

### First-time production setup

`npm run migrate` expects the target database to already exist. For a brand
new production Postgres instance (self-managed — most managed platforms
auto-provision the database named in your connection string), use:

```bash
DATABASE_URL=postgresql://user:pass@prod-host:5432/photodrop npm run db:deploy
```

This creates the database if it doesn't exist yet (safe/idempotent — skips
creation if it's already there), then runs `npm run migrate` against it.
Prompts for confirmation before doing anything; pass `--yes` to skip the
prompt for CI/non-interactive use. If your host requires SSL (RDS, Supabase,
Neon, Railway, etc.), append `?sslmode=require` to `DATABASE_URL` — `pg`
picks that up directly from the connection string.

> Migration `006_faces_phase2.sql` needs the `vector` (pgvector) extension.
> If it's not installed on your production Postgres, that migration — and
> `db:deploy` — will fail there. See src/db/migrations/006_faces_phase2.sql;
> it's Phase 2 schema with no Phase 1 dependents, so install pgvector on the
> server or drop that one file for this deployment.

## 7. Environment variables

See `.env.example` for the full list with inline explanations. Grouped
summary:

| Group | Variables |
|---|---|
| App identity | `APP_NAME`, `NODE_ENV`, `PORT`, `APP_URL`, `PUBLIC_GALLERY_BASE_URL` |
| Database | `DATABASE_URL`, `DB_POOL_MAX` |
| Queue | `REDIS_URL` |
| Auth | `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL_DAYS`, `BCRYPT_SALT_ROUNDS` |
| Object storage | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `S3_SIGNED_URL_TTL_SECONDS`, `CDN_BASE_URL` |
| Upload limits | `MAX_UPLOAD_FILE_SIZE_BYTES`, `MAX_UPLOAD_BATCH_SIZE` |
| Access tokens | `DEFAULT_ACCESS_TOKEN_TTL_DAYS` |
| Rate limiting | `RATE_LIMIT_WINDOW_MINUTES`, `RATE_LIMIT_MAX_REQUESTS` |

`src/config/env.ts` validates all of these at boot with `zod` — the process
refuses to start if a required variable is missing or malformed, rather than
failing unpredictably later.

## 8. Production deployment notes

- **Self-hosted Postgres/MinIO via docker-compose**: `docker-compose.yml`
  reads `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` and
  `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` from `.env` (falling back to the
  local-dev defaults if unset). Before running `docker compose up -d` on any
  shared or production box, set real values for these in `.env` — and keep
  `DATABASE_URL` (user:password@.../db) and `S3_ACCESS_KEY_ID`/
  `S3_SECRET_ACCESS_KEY` in sync with whatever you set here, since those are
  what the app actually authenticates with. See `.env.example` for details.
- **Object storage**: swap `S3_ENDPOINT`/credentials to real AWS S3 (or
  Spaces/B2) — no code changes required, only `.env`.
- **CDN**: set `CDN_BASE_URL` to serve thumbnails/previews through a CDN
  instead of the storage origin directly.
- **Database**: run migrations (`npm run migrate`) as a release step, before
  the new API/worker versions start receiving traffic. For a brand new
  database, use `npm run db:deploy` once instead (see section 6) — it
  creates the database first, then runs the same migrations.
- **Secrets**: never commit `.env`. Inject `JWT_ACCESS_SECRET` and storage
  credentials via your platform's secret manager.
- **Horizontal scaling**: the API server is stateless (JWT auth, no
  in-memory session) and safe to run behind a load balancer with N replicas.
  The worker scales independently based on `photo-processing` queue depth.
- **Backups**: enable automated Postgres backups (originals live in object
  storage, which should have its own versioning/backup policy — Postgres
  backups protect metadata, not the images themselves).

## 9. Useful one-off commands

```bash
# Tail worker logs only
npm run dev:worker

# Connect to local Postgres directly
docker compose exec postgres psql -U photodrop -d photodrop

# Reset local dev environment completely (destroys local data)
docker compose down -v
```
