import crypto from 'crypto';

/**
 * Generates a high-entropy, URL-safe public token (what actually goes into
 * the QR code / refresh-token cookie) and returns both the raw value and its
 * SHA-256 hash. Only the hash is ever persisted — see access_tokens.token_hash
 * and refresh_tokens.token_hash. This mirrors password hashing practice:
 * a DB dump alone should never be enough to grant access.
 */
export function generateOpaqueToken(bytes = 32): { raw: string; hash: string } {
  const raw = crypto.randomBytes(bytes).toString('base64url');
  const hash = hashToken(raw);
  return { raw, hash };
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * A short numeric code for dev-mode email verification (no email service is
 * configured in this environment, so this is handed back in the API
 * response instead of being emailed — see 009_email_verification.sql).
 * Only its hash is persisted, same as any other credential.
 */
export function generateVerificationCode(): { raw: string; hash: string } {
  const raw = crypto.randomInt(100000, 1000000).toString();
  return { raw, hash: hashToken(raw) };
}
