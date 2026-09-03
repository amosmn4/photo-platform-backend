import crypto from 'crypto';

// Generates a token and its SHA-256 hash; only the hash is ever persisted.
export function generateOpaqueToken(bytes = 32): { raw: string; hash: string } {
  const raw = crypto.randomBytes(bytes).toString('base64url');
  const hash = hashToken(raw);
  return { raw, hash };
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// Numeric dev-mode email verification code; only its hash is persisted.
export function generateVerificationCode(): { raw: string; hash: string } {
  const raw = crypto.randomInt(100000, 1000000).toString();
  return { raw, hash: hashToken(raw) };
}
