-- 002_users.sql
-- Photographers (and future staff/admin accounts). End customers scanning a
-- QR code are deliberately NOT users — see design note at the bottom.

CREATE TYPE user_role AS ENUM ('photographer', 'admin', 'staff');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'pending_verification');

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               CITEXT NOT NULL UNIQUE,
    password_hash       TEXT NOT NULL,
    full_name           TEXT NOT NULL,
    business_name       TEXT,                       -- shown on public galleries / QR pages
    phone               TEXT,
    role                user_role NOT NULL DEFAULT 'photographer',
    status              user_status NOT NULL DEFAULT 'pending_verification',

    -- storage accounting: lets us enforce plan limits / bill without scanning
    -- the photos table. Kept accurate via trigger, see 009.
    storage_used_bytes  BIGINT NOT NULL DEFAULT 0,
    storage_quota_bytes BIGINT NOT NULL DEFAULT 53687091200, -- 50 GB default plan

    email_verified_at   TIMESTAMPTZ,
    last_login_at       TIMESTAMPTZ,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ                 -- soft delete: keep events/photos of a
                                                       -- closed account resolvable for a
                                                       -- retention window
);

CREATE INDEX idx_users_role_status ON users (role, status) WHERE deleted_at IS NULL;

-- Refresh tokens live in their own table (not on `users`) so a user can be
-- logged in on multiple devices and any single device can be revoked without
-- invalidating the others.
CREATE TABLE refresh_tokens (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   TEXT NOT NULL UNIQUE,   -- never store the raw token
    user_agent   TEXT,
    ip_address   INET,
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_refresh_tokens_expiry ON refresh_tokens (expires_at);

-- DESIGN NOTE: end customers (people who scan a QR code) are intentionally
-- NOT rows in `users`. Forcing signup/login on the customer side kills the
-- "scan -> see your photos" experience the product depends on. Customer
-- identity is instead scoped per-event via `access_tokens` (005) and,
-- in Phase 2, an ephemeral face-search session (007) — never a durable
-- account record. This is a deliberate privacy-by-design choice, not an
-- oversight.
