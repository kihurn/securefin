import { Request, Response, NextFunction } from 'express';

/**
 * Standard global Express middleware that catches and shields runtime application crash data from external networks.
 * 8.) Safe System Error Handling (hides detailed server crash errors from public view)
 */
export function errorHandling(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('[Error Shield]', err?.message || err);
  res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
}
