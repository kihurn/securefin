import { Request, Response, NextFunction } from 'express';
import { verifyToken } from './session';

// SECURE DESIGN CHOICE - TypeScript Declarations:
// Extend Express Request interface globally to support type-safe 'req.user' injection
// across all routes using this middleware.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: string;
        [key: string]: any;
      };
    }
  }
}

/**
 * SECURE DESIGN CHOICE - Default-Deny Authentication Guard:
 * Establishes a zero-trust default-deny security perimeter. Unless explicitly authenticated,
 * access to endpoints is rejected immediately.
 * 
 * Extracts token from two channels to maximize API flexibility:
 * 1. HTTP-Only Cookies (primarily for web browsers to protect against XSS token harvesting).
 * 2. Authorization Header (Bearer schema for mobile apps, REST clients, or cross-origin requests).
 */
export function authGuard(req: Request, res: Response, next: NextFunction): void {
  let token: string | undefined = undefined;

  // 1. Check for token in secure HTTP-only cookies
  if (req.cookies && req.cookies.session_token) {
    token = req.cookies.session_token;
  }
  
  // 2. Fallback to authorization header (Bearer token)
  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Extract the token string
    }
  }

  // DEFAULT DENY: If no token is provided, fail closed
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Access denied.' });
    return;
  }

  try {
    // Validate JWT signature and expiration
    const decoded = verifyToken(token);
    
    // Inject decoded claims into request object for downstream middlewares/controllers to consume
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
    };

    next();
  } catch (error) {
    // SECURE DESIGN CHOICE - Sanitized Errors:
    // Reject request with a generic unauthorized response instead of detailed debugging reports
    // to prevent leakage of internal JWT verification parameters or logic to potential attackers.
    res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}
