import { Request, Response, NextFunction } from 'express';
import { logSecurityEvent } from './auditLogger';

const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
const blockedIps = new Set<string>();

export function getBlockedIps() {
  return Array.from(blockedIps);
}

/**
 * Brute-force protection rate limiter.
 * 5.) Limiting Login Attempts (prevents automated attacks by limiting how fast someone can try to log in)
 */
export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 20;

  const attempt = loginAttempts.get(ip);
  if (!attempt) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return next();
  }

  if (now - attempt.firstAttempt > windowMs) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    blockedIps.delete(ip);
    return next();
  }

  attempt.count++;
  if (attempt.count > maxRequests) {
    if (!blockedIps.has(ip)) {
      blockedIps.add(ip);
      logSecurityEvent('Rate Limit Blocked', { ip, count: attempt.count, windowMs });
    }
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  next();
}
