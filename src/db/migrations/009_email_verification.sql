-- 009_email_verification.sql
--
-- Dev-mode email verification: no outbound email service is configured in
-- this environment, so the verification code is a short-lived numeric code
-- whose hash is stored here and whose raw value is handed back directly in
-- the API response (register/resend) instead of being emailed. Swap that
-- hand-back for a real email send later without touching this schema.

ALTER TABLE users
    ADD COLUMN email_verification_code_hash TEXT,
    ADD COLUMN email_verification_expires_at TIMESTAMPTZ;
