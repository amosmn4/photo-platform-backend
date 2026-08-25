import { NextFunction, Request, Response } from 'express';
import { TokenService } from '../services/token.service';
import { ApiError } from '../utils/ApiError';

/**
 * Resolves the opaque token from a public gallery URL (/g/:token or
 * X-Gallery-Token header) into a validated access_tokens row, attached as
 * req.accessToken. Everything downstream (gallery listing, find-my-photos,
 * downloads) trusts req.accessToken.event_id — never a client-supplied
 * event id — closing off IDOR access to other photographers' galleries.
 */
export async function requireAccessToken(req: Request, _res: Response, next: NextFunction) {
  const raw = req.params.token ?? (req.headers['x-gallery-token'] as string | undefined);
  if (!raw) return next(ApiError.unauthorized('Missing access token'));

  try {
    const token = await TokenService.resolve(raw, {
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    req.accessToken = token;
    next();
  } catch (err) {
    next(err);
  }
}
