import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthService } from '../services/auth.service';
import { env } from '../config/env';

const REFRESH_COOKIE = 'refreshToken';

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });
}

export const AuthController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const { user, devVerificationCode } = await AuthService.register(req.body);
    res.status(201).json({ user, devVerificationCode });
  }),

  verifyEmail: asyncHandler(async (req: Request, res: Response) => {
    const { user, accessToken, refreshToken } = await AuthService.verifyEmail({
      ...req.body,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    setRefreshCookie(res, refreshToken);
    res.json({ user, accessToken });
  }),

  resendVerification: asyncHandler(async (req: Request, res: Response) => {
    const { devVerificationCode } = await AuthService.resendVerification(req.body.email);
    res.json({ devVerificationCode });
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const { user, accessToken, refreshToken } = await AuthService.login({
      ...req.body,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    setRefreshCookie(res, refreshToken);
    res.json({ user, accessToken });
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const raw = req.cookies?.[REFRESH_COOKIE] ?? req.body.refreshToken;
    const { user, accessToken, refreshToken } = await AuthService.refresh(
      raw,
      req.headers['user-agent'],
      req.ip,
    );
    setRefreshCookie(res, refreshToken);
    res.json({ user, accessToken });
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const raw = req.cookies?.[REFRESH_COOKIE] ?? req.body.refreshToken;
    if (raw) await AuthService.logout(raw);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    res.status(204).send();
  }),
};
