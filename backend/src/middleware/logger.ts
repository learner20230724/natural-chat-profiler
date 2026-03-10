import { Request, Response, NextFunction } from 'express';

/**
 * Simple request logging middleware
 */
export function logger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`
    );
  });
  
  next();
}
