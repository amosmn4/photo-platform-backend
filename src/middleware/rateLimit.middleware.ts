import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

// General API rate limit — generous, just an abuse backstop.
export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
});

// Tighter limit on auth endpoints to slow down credential stuffing / brute force.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many attempts. Please try again later.' } },
});

// Limiter for public gallery/QR resolution, keyed by IP — first line of defense against token scraping.
export const publicGalleryLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
