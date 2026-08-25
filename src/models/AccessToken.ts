import { query } from '../db/pool';
import { AccessToken, AccessTokenScope } from '../types';

export const AccessTokenModel = {
  async create(input: {
    eventId: string;
    tokenHash: string;
    createdBy: string;
    label?: string | null;
    scope?: AccessTokenScope;
    sessionId?: string | null;
    expiresAt?: Date | null;
    maxUses?: number | null;
  }): Promise<AccessToken> {
    const { rows } = await query<AccessToken>(
      `INSERT INTO access_tokens
         (event_id, token_hash, created_by, label, scope, session_id, expires_at, max_uses)
       VALUES ($1, $2, $3, $4, COALESCE($5::access_token_scope, 'find_my_photos'), $6, $7, $8)
       RETURNING *`,
      [
        input.eventId,
        input.tokenHash,
        input.createdBy,
        input.label ?? null,
        input.scope ?? null,
        input.sessionId ?? null,
        input.expiresAt ?? null,
        input.maxUses ?? null,
      ],
    );
    return rows[0];
  },

  async findByHash(tokenHash: string): Promise<AccessToken | null> {
    const { rows } = await query<AccessToken>(`SELECT * FROM access_tokens WHERE token_hash = $1`, [tokenHash]);
    return rows[0] ?? null;
  },

  async listForEvent(eventId: string): Promise<AccessToken[]> {
    const { rows } = await query<AccessToken>(
      `SELECT * FROM access_tokens WHERE event_id = $1 ORDER BY created_at DESC`,
      [eventId],
    );
    return rows;
  },

  /** Atomically checks validity and records a use in one round trip, avoiding
   *  a check-then-act race under concurrent scans of the same token. */
  async recordUseIfValid(id: string): Promise<boolean> {
    const { rows } = await query<{ ok: boolean }>(
      `UPDATE access_tokens
          SET use_count = use_count + 1,
              last_used_at = now()
        WHERE id = $1
          AND status = 'active'
          AND (expires_at IS NULL OR expires_at > now())
          AND (max_uses IS NULL OR use_count < max_uses)
        RETURNING true AS ok`,
      [id],
    );
    return rows.length > 0;
  },

  async revoke(id: string, reason?: string): Promise<void> {
    await query(
      `UPDATE access_tokens SET status = 'revoked', revoked_at = now(), revoked_reason = $2 WHERE id = $1`,
      [id, reason ?? null],
    );
  },

  async logAttempt(input: {
    accessTokenId: string;
    ipAddress: string | null;
    userAgent: string | null;
    outcome: 'granted' | 'expired' | 'revoked' | 'rate_limited';
  }): Promise<void> {
    await query(
      `INSERT INTO access_token_logs (access_token_id, ip_address, user_agent, outcome)
       VALUES ($1, $2, $3, $4)`,
      [input.accessTokenId, input.ipAddress, input.userAgent, input.outcome],
    );
  },
};
