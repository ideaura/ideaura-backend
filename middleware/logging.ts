import type { Request, Response, NextFunction } from 'express';
import appState from '../utils/AppState.ts';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const clientId = (req.headers['x-client-id'] as string) || req.ip || 'unknown';
  appState.addClient(clientId);

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
  });

  next();
}
