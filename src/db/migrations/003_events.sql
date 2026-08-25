-- 003_events.sql
-- An Event is a shoot: a wedding, a school graduation, a corporate sports day.
-- Everything else (photos, sessions, QR tokens) hangs off an event.

CREATE TYPE event_status AS ENUM ('draft', 'processing', 'published', 'archived');
CREATE TYPE gallery_visibility AS ENUM ('public', 'private_by_token', 'find_my_photos');
-- public            = anyone with the link/QR sees the whole gallery (Model 1)
-- private_by_token  = QR grants access, but browsing is all-or-nothing per token (Model 2)
-- find_my_photos    = QR opens a landing page; browsing full gallery is gated,
--                      "find my photos" (time/session filter now, face search
--                      in Phase 2) is the primary path (Model 3 — the one the
--                      product should default new events to)

CREATE TABLE events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photographer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    name                TEXT NOT NULL,
    slug                TEXT NOT NULL,            -- human-friendly part of the gallery URL
    description         TEXT,

    event_date          DATE,                     -- the real-world date of the shoot
    photos_available_from  TIMESTAMPTZ,            -- when the gallery becomes visible
    photos_available_until TIMESTAMPTZ,            -- when the gallery/QR access expires
                                                    -- (independent of any single QR's expiry —
                                                    -- see access_tokens.expires_at)

    visibility          gallery_visibility NOT NULL DEFAULT 'find_my_photos',
    status               event_status NOT NULL DEFAULT 'draft',

    cover_photo_id       UUID,                     -- FK added after photos table exists (006)

    photo_count           INTEGER NOT NULL DEFAULT 0,   -- denormalized, kept accurate by trigger
    total_size_bytes       BIGINT NOT NULL DEFAULT 0,

    -- watermark / branding config for previews (Phase 1.5 monetization hook)
    settings              JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at            TIMESTAMPTZ,

    CONSTRAINT uq_events_photographer_slug UNIQUE (photographer_id, slug),
    CONSTRAINT chk_events_availability_window
        CHECK (photos_available_until IS NULL OR photos_available_from IS NULL
               OR photos_available_until > photos_available_from)
);

CREATE INDEX idx_events_photographer ON events (photographer_id, created_at DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_events_status ON events (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_name_trgm ON events USING gin (name gin_trgm_ops);

-- Photographer sessions within an event ("Morning Session 9-10am", "Session 3
-- - Podium"). This is Option B/C from the product doc: a coarser, cheap
-- alternative to per-minute time filtering that photographers can define
-- up front and generate a dedicated QR for.
CREATE TABLE photo_sessions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    starts_at    TIMESTAMPTZ,
    ends_at      TIMESTAMPTZ,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_sessions_window CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX idx_sessions_event ON photo_sessions (event_id, sort_order);
