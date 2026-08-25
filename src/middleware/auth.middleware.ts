import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { ApiError } from '../utils/ApiError';
import { UserRole } from '../types';

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('Missing bearer token'));
  }
  const token = header.slice('Bearer '.length);
  const payload = AuthService.verifyAccessToken(token);
  req.user = { id: payload.sub, role: payload.role };
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };
}
