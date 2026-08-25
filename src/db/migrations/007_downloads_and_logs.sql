-- 007_downloads_and_logs.sql

CREATE TABLE downloads (
    id              BIGSERIAL PRIMARY KEY,
    photo_id        UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    access_token_id UUID REFERENCES access_tokens(id) ON DELETE SET NULL,
    ip_address      INET,
    user_agent      TEXT,
    variant         TEXT NOT NULL DEFAULT 'original', -- 'original' | 'large' | 'medium'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_downloads_photo ON downloads (photo_id, created_at DESC);
CREATE INDEX idx_downloads_token ON downloads (access_token_id, created_at DESC);

-- Generic upload-batch tracking so the photographer dashboard can show
-- "3,421 / 5,000 uploaded, 2,890 / 5,000 processed" (product doc section 7)
-- without the client re-deriving progress from thousands of individual
-- photo rows on every poll.
CREATE TYPE upload_batch_status AS ENUM ('uploading', 'processing', 'completed', 'completed_with_errors');

CREATE TABLE upload_batches (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    created_by        UUID NOT NULL REFERENCES users(id),

    status            upload_batch_status NOT NULL DEFAULT 'uploading',
    total_files        INTEGER NOT NULL DEFAULT 0,
    uploaded_files       INTEGER NOT NULL DEFAULT 0,
    processed_files       INTEGER NOT NULL DEFAULT 0,
    failed_files            INTEGER NOT NULL DEFAULT 0,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at      TIMESTAMPTZ
);

CREATE INDEX idx_upload_batches_event ON upload_batches (event_id, created_at DESC);

ALTER TABLE photos ADD COLUMN upload_batch_id UUID REFERENCES upload_batches(id) ON DELETE SET NULL;
CREATE INDEX idx_photos_upload_batch ON photos (upload_batch_id);
