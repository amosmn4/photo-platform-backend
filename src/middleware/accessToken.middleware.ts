import { NextFunction, Request, Response } from 'express';
import { TokenService } from '../services/token.service';
import { ApiError } from '../utils/ApiError';

// Resolves the gallery token into req.accessToken, which downstream trusts over client-supplied ids.
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
