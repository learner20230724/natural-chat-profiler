import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors';
import { errorResponse } from '../shared/api';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('[errorHandler]', {
    name: err.name,
    message: err.message,
    stack: err.stack?.split('\n').slice(0, 3).join('\n') ?? null,
  });

  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json(
      errorResponse({
        code: err.code,
        message: err.message,
        details: err.details,
      })
    );
  }

  return res.status(500).json(
    errorResponse({
      code: 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
    })
  );
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json(
    errorResponse({
      code: 'ROUTE_NOT_FOUND',
      message: 'Route not found',
    })
  );
}
