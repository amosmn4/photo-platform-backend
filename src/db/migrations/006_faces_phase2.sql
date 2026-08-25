-- 006_faces_phase2.sql
--
-- PHASE 2 SCHEMA — created now, per the architecture doc's recommendation
-- ("design Phase 1's database around Phase 2 from day one"), but NOT used
-- by any Phase 1 route/service/worker. Nothing in Phase 1 writes to these
-- tables. They exist so adding face search later is additive, not a
-- migration-and-rewrite exercise.
--
-- pgvector is used for the embedding column. If the extension is
-- unavailable in a given environment this migration can be skipped
-- entirely without affecting Phase 1 — it has no inbound FKs from any
-- Phase 1 table.

CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TABLE faces (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id        UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    face_index      SMALLINT NOT NULL,           -- nth face detected within the photo
    bounding_box    JSONB NOT NULL,              -- {x, y, width, height} in normalized coords
    confidence      REAL NOT NULL,
    embedding       vector(512),                 -- typical face-embedding dimensionality
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_faces_photo_index UNIQUE (photo_id, face_index)
);

-- Approximate nearest-neighbour index for "search embeddings similar to this
-- selfie's embedding, scoped to one event". ivfflat needs a rough row-count
-- estimate to tune `lists`; ANALYZE / rebuild after each event's face
-- backfill finishes rather than at migration time.
CREATE INDEX idx_faces_embedding ON faces USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX idx_faces_photo ON faces (photo_id);

-- An ephemeral face-search "session": a customer's selfie, kept only long
-- enough to run the search (product doc section 15 — don't retain biometric
-- data without explicit reason). The raw selfie image is deleted by a worker
-- shortly after the search completes; only this row (with no image
-- reference retained past that point) persists for auditing/rate-limiting.
CREATE TABLE face_search_sessions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    access_token_id   UUID REFERENCES access_tokens(id) ON DELETE SET NULL,
    selfie_deleted_at TIMESTAMPTZ,
    match_count       INTEGER,
    ip_address        INET,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour')
);

CREATE INDEX idx_face_sessions_event ON face_search_sessions (event_id, created_at DESC);
