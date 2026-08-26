import { AccessTokenModel } from '../models/AccessToken';
import { EventModel } from '../models/Event';
import { generateOpaqueToken, hashToken } from '../utils/token';
import { buildGalleryUrl, generateQrDataUrl } from './qrcode.service';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';
import { AccessToken, AccessTokenScope } from '../types';

export const TokenService = {
  /**
   * Issues a new QR/access token for an event. Returns the raw token (shown
   * to the photographer exactly once — it's never retrievable again, same
   * as the private half of any credential) plus a ready-to-print QR image.
   */
  async issue(input: {
    eventId: string;
    createdBy: string;
    label?: string;
    scope?: AccessTokenScope;
    sessionId?: string | null;
    ttlDays?: number | null; // null = no expiry
    maxUses?: number | null;
  }) {
    const event = await EventModel.findById(input.eventId);
    if (!event) throw ApiError.notFound('Event not found');

    const { raw, hash } = generateOpaqueToken();
    const ttlDays = input.ttlDays === undefined ? env.DEFAULT_ACCESS_TOKEN_TTL_DAYS : input.ttlDays;
    const expiresAt = ttlDays === null ? null : new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    const token = await AccessTokenModel.create({
      eventId: input.eventId,
      tokenHash: hash,
      createdBy: input.createdBy,
      label: input.label,
      scope: input.scope,
      sessionId: input.sessionId,
      expiresAt,
      maxUses: input.maxUses ?? null,
    });

    const qrDataUrl = await generateQrDataUrl(raw);
    const galleryUrl = buildGalleryUrl(raw);

    // `raw` is returned only in this response — the DB has just its hash.
    return { token, rawToken: raw, qrDataUrl, galleryUrl };
  },

  /**
   * Resolves a raw token from an incoming public gallery request. This is
   * the hot path hit on every QR scan, so it does exactly one indexed
   * lookup by hash, then an atomic validity+use-increment, then logs the
   * attempt (fire-and-forget-safe, but awaited here for correctness in
   * tests; can be moved to a queue if it becomes a bottleneck).
   */
  async resolve(rawToken: string, ctx: { ipAddress: string | null; userAgent: string | null }): Promise<AccessToken> {
    const hash = hashToken(rawToken);
    const token = await AccessTokenModel.findByHash(hash);

    if (!token) {
      throw ApiError.notFound('This link is invalid.');
    }

    const ok = await AccessTokenModel.recordUseIfValid(token.id);
    if (!ok) {
      const outcome = token.status === 'revoked' ? 'revoked' : 'expired';
      await AccessTokenModel.logAttempt({ accessTokenId: token.id, ...ctx, outcome });
      throw ApiError.forbidden(
        token.status === 'revoked'
          ? 'This link has been revoked by the photographer.'
          : 'This link has expired.',
      );
    }

    await AccessTokenModel.logAttempt({ accessTokenId: token.id, ...ctx, outcome: 'granted' });
    return token;
  },

  async revoke(eventId: string, tokenId: string, reason?: string): Promise<void> {
    const tokens = await AccessTokenModel.listForEvent(eventId);
    const match = tokens.find((t) => t.id === tokenId);
    if (!match) throw ApiError.notFound('Access token not found for this event');
    await AccessTokenModel.revoke(tokenId, reason);
  },

  /** Permanently removes a QR/access token, distinct from `revoke` (which
   *  just disables it while leaving it listed for the audit trail). */
  async remove(eventId: string, tokenId: string): Promise<void> {
    const tokens = await AccessTokenModel.listForEvent(eventId);
    const match = tokens.find((t) => t.id === tokenId);
    if (!match) throw ApiError.notFound('Access token not found for this event');
    await AccessTokenModel.delete(tokenId);
  },

  async listForEvent(eventId: string): Promise<AccessToken[]> {
    return AccessTokenModel.listForEvent(eventId);
  },
};
