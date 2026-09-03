-- 011_site_settings.sql
--
-- Singleton row holding admin-managed site branding/contact info: the logo
-- shown in the header and footer, footer tagline and social links, and
-- contact details. Read publicly (header/footer render on unauthenticated
-- pages too); written only by an admin.

CREATE TABLE site_settings (
    id                SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    logo_key          TEXT,
    tagline           TEXT,
    contact_email     TEXT,
    contact_phone     TEXT,
    contact_address   TEXT,
    social_links      JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO site_settings (id) VALUES (1);
