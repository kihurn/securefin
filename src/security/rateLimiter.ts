import { Request, Response, NextFunction } from 'express';
import { logSecurityEvent } from './auditLogger';

// 1. IP-based tracking for failed login attempts
interface LockoutRecord {
  count: number;
  lockedUntil: number;
}
const failedAttempts = new Map<string, LockoutRecord>();
const blockedIps = new Set<string>();

export function getBlockedIps() {
  return Array.from(blockedIps);
}

/**
 * Middleware: Checks if an IP is currently locked out due to prior failed logins [1].
 */
export function checkFailedAttempts(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || 'unknown';
  const now = Date.now();

  const record = failedAttempts.get(ip);
  if (record && record.lockedUntil > now) {
    const minutesLeft = Math.ceil((record.lockedUntil - now) / 60000);
    return res.status(429).json({
      error: `Too many failed login attempts. Your IP has been temporarily locked. Please try again in ${minutesLeft} minute(s).`
    });
  }

  // If the lockout window has expired, cleanly lift the block
  if (record && record.lockedUntil <= now && record.lockedUntil !== 0) {
    failedAttempts.delete(ip);
    blockedIps.delete(ip);
  }

  next();
}

/**
 * Records a failed login attempt. Locks the IP for 15 minutes after 5 consecutive failures [1].
 */
export function recordFailedAttempt(ip: string) {
  const now = Date.now();
  const record = failedAttempts.get(ip) || { count: 0, lockedUntil: 0 };

  record.count++;
  if (record.count >= 5) {
    record.lockedUntil = now + 15 * 60 * 1000; // 15-minute lockout window
    blockedIps.add(ip);
    logSecurityEvent('Rate Limit Blocked', { ip, failedAttemptsCount: record.count, duration: '15m' });
  }
  failedAttempts.set(ip, record);
}

/**
 * Resets failed attempts tracker. Call this upon successful login [1].
 */
export function resetFailedAttempts(ip: string) {
  failedAttempts.delete(ip);
  blockedIps.delete(ip);
}

/**
 * Traditional rate limiter for general endpoint protection (legacy fallback)
 */
export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  next();
}

// 2. Standard Request Rate Limiter (For Registration endpoints to prevent account creation spam) [1]
const registrationAttempts = new Map<string, { count: number; firstAttempt: number }>();

export function registrationRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRegistrations = 3;  // Max 3 registrations per minute from same IP

  const attempt = registrationAttempts.get(ip);
  if (!attempt) {
    registrationAttempts.set(ip, { count: 1, firstAttempt: now });
    return next();
  }

  if (now - attempt.firstAttempt > windowMs) {
    registrationAttempts.set(ip, { count: 1, firstAttempt: now });
    return next();
  }

  attempt.count++;
  if (attempt.count > maxRegistrations) {
    logSecurityEvent('Registration Rate Limit Exceeded', { ip, count: attempt.count });
    return res.status(429).json({ error: 'Too many account registration requests. Please wait a minute.' });
  }

  next();
}