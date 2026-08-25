import { NextFunction, Request, Response } from 'express';

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Wraps an async Express handler so a rejected promise is forwarded to
 * next(err) instead of crashing the process / hanging the request. Every
 * controller in this codebase is wrapped in this.
 */
export const asyncHandler =
  (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
