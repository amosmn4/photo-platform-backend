-- 004_access_tokens.sql
--
-- This is the security-critical table. Design rule from the product doc:
-- the QR code itself must NEVER embed the event id or any guessable
-- identifier. It encodes only an opaque, random, revocable token. The token
-- is hashed at rest (same treatment as a password) so a DB leak doesn't hand
-- out live access to every gallery.

CREATE TYPE access_token_status AS ENUM ('active', 'revoked', 'expired');
CREATE TYPE access_token_scope AS ENUM ('full_gallery', 'session_only', 'find_my_photos');

CREATE TABLE access_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    session_id      UUID REFERENCES photo_sessions(id) ON DELETE CASCADE, -- set when scope = session_only

    -- The public-facing value is a high-entropy random string generated in
    -- app code (see token.service.ts) and returned to the client exactly
    -- once, at creation time. Only its hash is persisted.
    token_hash      TEXT NOT NULL UNIQUE,
    label           TEXT,                     -- "QR #1 - printed at venue", "Morning session QR"
    scope           access_token_scope NOT NULL DEFAULT 'find_my_photos',

    status          access_token_status NOT NULL DEFAULT 'active',
    expires_at      TIMESTAMPTZ,              -- NULL = no fixed expiry (still revocable)
    max_uses        INTEGER,                  -- NULL = unlimited
    use_count       INTEGER NOT NULL DEFAULT 0,

    created_by      UUID NOT NULL REFERENCES users(id),
    revoked_at      TIMESTAMPTZ,
    revoked_reason  TEXT,
    last_used_at    TIMESTAMPTZ,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_token_session_scope
        CHECK ((scope = 'session_only' AND session_id IS NOT NULL)
            OR (scope <> 'session_only'))
);

CREATE INDEX idx_access_tokens_event ON access_tokens (event_id) WHERE status = 'active';
-- token_hash already has a unique index from the UNIQUE constraint, which is
-- exactly the lookup path used on every gallery request: hash the incoming
-- token, look up by hash, check status/expiry in the app layer.

-- Every resolution attempt is logged. This is what lets a photographer see
-- "312 scans, 47 unique visitors" and lets us detect abuse (one token being
-- hammered from thousands of IPs = likely leaked/scraped).
CREATE TABLE access_token_logs (
    id              BIGSERIAL PRIMARY KEY,
    access_token_id UUID NOT NULL REFERENCES access_tokens(id) ON DELETE CASCADE,
    ip_address      INET,
    user_agent      TEXT,
    outcome         TEXT NOT NULL,  -- 'granted' | 'expired' | 'revoked' | 'rate_limited'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partitioning-friendly access pattern: always queried by token + time range.
CREATE INDEX idx_token_logs_token_time ON access_token_logs (access_token_id, created_at DESC);
