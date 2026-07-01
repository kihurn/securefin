import jwt from 'jsonwebtoken';
import { CookieOptions } from 'express';

// SECURE DESIGN CHOICE - Secret Management:
// In production, the JWT secret MUST be loaded from environment variables (e.g., process.env.JWT_SECRET).
// Never commit raw secrets or API keys to the repository. We implement a fallback only for development/testing
// with an explicit warning.
const JWT_SECRET = process.env.JWT_SECRET || 'dev_fallback_super_secret_key_change_me_in_production_12345';

if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'dev_fallback_super_secret_key_change_me_in_production_12345') {
  console.warn('CRITICAL WARNING: Running in production mode with a development fallback JWT secret!');
}

/**
 * SECURE DESIGN CHOICE - Cookie Hardening:
 * Enforcing security flags on cookies is vital for transport and storage protection:
 * - httpOnly: Prevents client-side scripts (JavaScript) from accessing the cookie. This makes
 *             stealing session identifiers via Cross-Site Scripting (XSS) impossible.
 * - secure: Restricts cookie transmission to HTTPS connections only, preventing packet-sniffing
 *           in-transit (Man-in-the-Middle attacks).
 * - sameSite: 'strict': Restricts cookies from being sent along with cross-site requests,
 *             providing solid mitigation against Cross-Site Request Forgery (CSRF).
 */
export const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 3600000, // 1 hour expiration (in milliseconds)
};

/**
 * Signs a payload to generate a secure JSON Web Token (JWT).
 * 
 * @param payload The user details to store inside the JWT.
 * @returns The signed JWT string.
 */
export function signToken(payload: object): string {
  // SECURE DESIGN CHOICE - Expiration Time:
  // Session tokens should have a short lifespan (e.g., 1 hour) to reduce the window of opportunity
  // if a token is ever compromised.
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '1h',
    algorithm: 'HS256', // Explicitly declare algorithm to prevent algorithm-switching attacks
  });
}

/**
 * Verifies and decodes a session JWT.
 * 
 * @param token The JWT string to verify.
 * @returns The decoded payload if signature and expiration checks pass.
 * @throws Error if token is invalid or expired.
 */
export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'], // Enforce checking against HS256 only
    });
  } catch (error: any) {
    // Log verification failures for security monitoring (e.g. potential token manipulation)
    throw new Error('Invalid or expired session token.');
  }
}
