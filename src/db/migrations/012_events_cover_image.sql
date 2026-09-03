-- 012_events_cover_image.sql
--
-- A photographer-uploaded cover image for the event card, distinct from the
-- unused cover_photo_id (which points at a processed photo row) — this is a
-- standalone image uploaded directly, settable at creation time or later.

ALTER TABLE events ADD COLUMN cover_image_key TEXT;
