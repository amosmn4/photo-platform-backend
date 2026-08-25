import { query } from '../db/pool';

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
}

export const RefreshTokenModel = {
  async create(input: {
    userId: string;
    tokenHash: string;
    userAgent?: string | null;
    ipAddress?: string | null;
    expiresAt: Date;
  }) {
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [input.userId, input.tokenHash, input.userAgent ?? null, input.ipAddress ?? null, input.expiresAt],
    );
  },

  async findValidByHash(tokenHash: string): Promise<RefreshTokenRow | null> {
    const { rows } = await query<RefreshTokenRow>(
      `SELECT * FROM refresh_tokens
        WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [tokenHash],
    );
    return rows[0] ?? null;
  },

  async revoke(tokenHash: string): Promise<void> {
    await query(`UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1`, [tokenHash]);
  },

  async revokeAllForUser(userId: string): Promise<void> {
    await query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  },
};
