import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/** General API rate limit — generous, just an abuse backstop. */
export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Tighter limit on auth endpoints to slow down credential stuffing / brute force. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many attempts. Please try again later.' } },
});

/**
 * Public gallery/QR resolution gets its own limiter keyed loosely by IP.
 * A single token being hit thousands of times from one IP is exactly the
 * scraping/leak pattern access_token_logs is meant to help catch (see
 * 004_access_tokens.sql) — this middleware is the first line of defense,
 * the logs are the forensic trail.
 */
export const publicGalleryLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
