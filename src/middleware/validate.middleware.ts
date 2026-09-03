import { NextFunction, Request, Response } from 'express';
import { AnyZodObject } from 'zod';

// Validates and replaces req.body/query/params so controllers can trust their shape.
export function validate(schema: {
  body?: AnyZodObject;
  query?: AnyZodObject;
  params?: AnyZodObject;
}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schema.body) req.body = schema.body.parse(req.body);
      if (schema.query) req.query = schema.query.parse(req.query) as typeof req.query;
      if (schema.params) req.params = schema.params.parse(req.params) as typeof req.params;
      next();
    } catch (err) {
      next(err);
    }
  };
}
