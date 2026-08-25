-- 001_extensions.sql
-- Core Postgres extensions the rest of the schema depends on.

-- gen_random_uuid() for primary keys (avoids the client round-trip / collision
-- surface of app-generated UUIDs, and avoids sequential-id enumeration attacks
-- on public gallery URLs).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- case-insensitive text, used for email so "Photographer@X.com" and
-- "photographer@x.com" collide correctly at the DB constraint level.
CREATE EXTENSION IF NOT EXISTS "citext";

-- trigram search — used later for fast ILIKE-style search on event names /
-- photographer names without a full text-search stack.
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
