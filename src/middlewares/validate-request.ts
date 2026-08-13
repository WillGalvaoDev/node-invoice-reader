import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../errors/app-error.js';

function validate(schema: ZodType, value: unknown): unknown {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError('Dados inválidos.', 400);
  return result.data;
}

export function validateBody(schema: ZodType) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    try {
      request.body = validate(schema, request.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateQuery(schema: ZodType) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    try {
      validate(schema, request.query);
      next();
    } catch (error) {
      next(error);
    }
  };
}
