-- 010_photo_trash_index.sql
--
-- Speeds up the trash-cleanup worker's periodic scan for soft-deleted photos
-- past their retention window (see workers/photoCleanup.worker.ts). Existing
-- indexes on `photos` are all partial WHERE deleted_at IS NULL, so they
-- exclude soft-deleted rows entirely — this index covers the opposite case.

CREATE INDEX idx_photos_deleted_at ON photos (deleted_at) WHERE deleted_at IS NOT NULL;
