import { Request, Response, NextFunction } from 'express';

export type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

export function asyncHandler(handler: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
