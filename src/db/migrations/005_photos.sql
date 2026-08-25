-- 005_photos.sql
--
-- The image binary NEVER lives in Postgres or on the app server. Only
-- metadata + object-storage keys live here (see product doc section 5).
-- Designed for 100k+ rows per event without degrading gallery queries.

CREATE TYPE photo_processing_status AS ENUM (
    'uploaded',       -- original bytes are in object storage
    'processing',     -- queued/picked up by a worker
    'ready',          -- thumbnail + preview + EXIF all done, safe to show in gallery
    'failed'
);

CREATE TABLE photos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    session_id          UUID REFERENCES photo_sessions(id) ON DELETE SET NULL,
    uploaded_by          UUID NOT NULL REFERENCES users(id),

    original_filename    TEXT NOT NULL,

    -- Object storage keys — never full URLs. URLs (with short-lived signing)
    -- are generated on read so a bucket/CDN migration never requires a
    -- data migration.
    storage_key_original  TEXT NOT NULL,
    storage_key_large     TEXT,     -- ~1920px, used in lightbox view
    storage_key_medium    TEXT,     -- ~800px, used in grid on tap/hover preview
    storage_key_thumbnail TEXT,     -- ~320px webp, used in the scroll grid

    mime_type             TEXT NOT NULL,
    file_size_bytes        BIGINT NOT NULL,
    width                  INTEGER,
    height                  INTEGER,
    checksum_sha256         TEXT,     -- dedupe re-uploads of the same file within an event

    -- EXIF, pulled out into real columns because these are exactly the
    -- fields the gallery filters/sorts on (product doc section 8-9).
    -- Everything else stays in exif_raw for completeness/debugging.
    taken_at                TIMESTAMPTZ,       -- primary sort/filter key for customers
    camera_make              TEXT,
    camera_model              TEXT,
    lens_model                 TEXT,
    gps_latitude                DOUBLE PRECISION,
    gps_longitude                DOUBLE PRECISION,
    orientation                   SMALLINT,
    exif_raw                       JSONB,

    processing_status    photo_processing_status NOT NULL DEFAULT 'uploaded',
    processing_error     TEXT,

    -- Phase 2 hook: has this photo already been through face detection?
    -- Kept here (not inferred from the faces table) so we can cheaply query
    -- "how many photos still need face processing" without a join.
    face_processed_at     TIMESTAMPTZ,

    is_hidden              BOOLEAN NOT NULL DEFAULT false,  -- photographer can unpublish a single shot
    download_count          INTEGER NOT NULL DEFAULT 0,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                TIMESTAMPTZ,

    CONSTRAINT uq_photos_event_checksum UNIQUE (event_id, checksum_sha256)
);

-- The gallery's #1 query: "give me page N of photos for this event, newest
-- shoot-time first, only the ready+visible ones." This index serves it
-- directly, including the pagination predicate.
CREATE INDEX idx_photos_gallery_page
    ON photos (event_id, taken_at DESC, id DESC)
    WHERE deleted_at IS NULL AND is_hidden = false AND processing_status = 'ready';

-- "Find my photos by time range" filter.
CREATE INDEX idx_photos_event_taken_at ON photos (event_id, taken_at)
    WHERE deleted_at IS NULL;

-- Session-scoped browsing / session-only QR tokens.
CREATE INDEX idx_photos_session ON photos (session_id) WHERE deleted_at IS NULL;

-- Worker queue catch-up query: "find everything stuck in processing/uploaded".
CREATE INDEX idx_photos_processing_status ON photos (processing_status, created_at)
    WHERE processing_status IN ('uploaded', 'processing', 'failed');

-- Photographer's own management view is uploaded-order, not shoot-order.
CREATE INDEX idx_photos_event_uploaded ON photos (event_id, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE events
    ADD CONSTRAINT fk_events_cover_photo
    FOREIGN KEY (cover_photo_id) REFERENCES photos(id) ON DELETE SET NULL;
