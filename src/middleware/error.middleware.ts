import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import { ApiError } from '../utils/ApiError';
import { logger } from '../config/logger';
import { env } from '../config/env';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { message: 'Validation failed', details: err.flatten() },
    });
  }

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (max 8MB)' : err.message;
    return res.status(400).json({ error: { message } });
  }

  if (err instanceof ApiError) {
    if (err.statusCode >= 500) logger.error({ err, path: req.path }, err.message);
    return res.status(err.statusCode).json({
      error: { message: err.message, details: err.details },
    });
  }

  logger.error({ err, path: req.path }, 'Unhandled error');
  return res.status(500).json({
    error: {
      message: 'Something went wrong on our end.',
      stack: env.NODE_ENV === 'development' && err instanceof Error ? err.stack : undefined,
    },
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { message: `No route for ${req.method} ${req.path}` } });
}
