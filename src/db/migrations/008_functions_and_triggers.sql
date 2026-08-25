-- 008_functions_and_triggers.sql

-- Generic updated_at maintenance. Applied to every table that has the column
-- so "trust updated_at" is actually true app-wide, not table-by-table luck.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_photos_updated_at BEFORE UPDATE ON photos
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- Keep events.photo_count / events.total_size_bytes accurate as photos are
-- inserted, soft-deleted, hard-deleted, or restored — without the app ever
-- running a COUNT(*) over potentially 100k+ rows to render a dashboard.
CREATE OR REPLACE FUNCTION sync_event_photo_stats()
RETURNS TRIGGER AS $$
DECLARE
    v_event_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE events
           SET photo_count = photo_count + 1,
               total_size_bytes = total_size_bytes + NEW.file_size_bytes
         WHERE id = NEW.event_id;

    ELSIF TG_OP = 'DELETE' THEN
        UPDATE events
           SET photo_count = GREATEST(photo_count - 1, 0),
               total_size_bytes = GREATEST(total_size_bytes - OLD.file_size_bytes, 0)
         WHERE id = OLD.event_id;

    ELSIF TG_OP = 'UPDATE' THEN
        -- soft delete transition
        IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
            UPDATE events
               SET photo_count = GREATEST(photo_count - 1, 0),
                   total_size_bytes = GREATEST(total_size_bytes - OLD.file_size_bytes, 0)
             WHERE id = NEW.event_id;
        -- restore transition
        ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
            UPDATE events
               SET photo_count = photo_count + 1,
                   total_size_bytes = total_size_bytes + NEW.file_size_bytes
             WHERE id = NEW.event_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_photos_sync_event_stats
    AFTER INSERT OR UPDATE OR DELETE ON photos
    FOR EACH ROW EXECUTE FUNCTION sync_event_photo_stats();


-- Mirror the same size accounting up to the owning photographer so
-- storage_used_bytes / storage_quota_bytes enforcement (upload middleware)
-- never needs an aggregate query either.
CREATE OR REPLACE FUNCTION sync_user_storage_usage()
RETURNS TRIGGER AS $$
DECLARE
    v_owner UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT photographer_id INTO v_owner FROM events WHERE id = NEW.event_id;
        UPDATE users SET storage_used_bytes = storage_used_bytes + NEW.file_size_bytes
         WHERE id = v_owner;
    ELSIF TG_OP = 'DELETE' THEN
        SELECT photographer_id INTO v_owner FROM events WHERE id = OLD.event_id;
        UPDATE users SET storage_used_bytes = GREATEST(storage_used_bytes - OLD.file_size_bytes, 0)
         WHERE id = v_owner;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_photos_sync_user_storage
    AFTER INSERT OR DELETE ON photos
    FOR EACH ROW EXECUTE FUNCTION sync_user_storage_usage();


-- Auto-expire access tokens lazily: rather than a cron sweeping the table,
-- any read of an access token re-checks expiry and flips status if needed.
-- This function is called from token.service.ts on every resolution — kept
-- here too as a defensive DB-level guarantee usable from raw SQL/reporting.
CREATE OR REPLACE FUNCTION is_access_token_valid(p_token_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_row access_tokens%ROWTYPE;
BEGIN
    SELECT * INTO v_row FROM access_tokens WHERE id = p_token_id;
    IF NOT FOUND THEN RETURN false; END IF;
    IF v_row.status = 'revoked' THEN RETURN false; END IF;
    IF v_row.expires_at IS NOT NULL AND v_row.expires_at < now() THEN RETURN false; END IF;
    IF v_row.max_uses IS NOT NULL AND v_row.use_count >= v_row.max_uses THEN RETURN false; END IF;
    RETURN true;
END;
$$ LANGUAGE plpgsql STABLE;
