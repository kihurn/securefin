import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

// Import our isolated security modules
import { hashPassword, comparePassword } from './server/security/hashing';
import { signToken, sessionCookieOptions } from './server/security/session';
import { authGuard } from './server/security/authGuard';
import { authorizeRoles } from './server/security/rbac';
import { strictRateLimiter } from './server/security/rateLimiter';
import { sanitizeInputs, validateSchema } from './server/security/validator';
import { logSecurityEvent } from './server/security/auditLogger';
import { errorHandler } from './server/security/errorHandler';

// Load environment configuration
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * SECURE DESIGN CHOICE - Trust Proxy:
 * If the application is hosted behind a reverse proxy (e.g. Cloudflare, AWS ALB, Nginx),
 * we must trust the proxy headers (like X-Forwarded-For) so that our rate limiter
 * resolves the true client IP instead of the proxy's IP.
 */
app.set('trust proxy', 1);

// 1. Basic Middlewares
app.use(express.json()); // Parses incoming application/json payloads
app.use(cookieParser()); // Parses Cookie headers and populates req.cookies

// 2. Global Input Sanitization Middleware
// SECURE DESIGN CHOICE - Proactive Input Cleaning:
// All incoming strings in body, query, and route params are automatically sanitized 
// to strip HTML tags, script blocks, and strip standard SQL injection triggers.
app.use(sanitizeInputs);

// In-memory mock database for testing purposes
interface MockUser {
  id: string;
  username: string;
  passwordHash: string;
  role: 'user' | 'admin';
}
const mockUserDb: MockUser[] = [];

// ==========================================
// ROUTES & DEMONSTRATION OF CONTROLS
// ==========================================

/**
 * Endpoint: User Registration
 * Controls demonstrated:
 * - Rate Limiting (Strict 5 req/min)
 * - Strict Input Schema Validation
 * - Secure Password Hashing
 * - Secure Audit Logging
 */
app.post(
  '/api/auth/register',
  strictRateLimiter, // Mitigates mass-account creation script exploits
  validateSchema({
    username: { type: 'string', required: true, minLength: 3 },
    password: { type: 'string', required: true, minLength: 8 },
    role: { type: 'string', required: true }
  }),
  async (req, res, next) => {
    try {
      const { username, password, role } = req.body;

      // Enforce acceptable roles to prevent privilege escalation
      if (role !== 'user' && role !== 'admin') {
        logSecurityEvent('anonymous', 'REGISTRATION_ATTEMPT_INVALID_ROLE', 'FAILURE', { username, role });
        res.status(400).json({ error: 'Invalid role specified.' });
        return;
      }

      // Check if user already exists
      const existingUser = mockUserDb.find(u => u.username === username);
      if (existingUser) {
        logSecurityEvent('anonymous', 'REGISTRATION_FAILED_DUPLICATE', 'FAILURE', { username });
        res.status(400).json({ error: 'Username is already taken.' });
        return;
      }

      // Hash the password securely using bcrypt
      const hashed = await hashPassword(password);

      const newUser: MockUser = {
        id: `usr_${Date.now()}`,
        username,
        passwordHash: hashed,
        role: role as 'user' | 'admin',
      };
      
      mockUserDb.push(newUser);

      // Audit log registration event (password is not logged because auditLogger.ts automatically redacts it)
      logSecurityEvent(newUser.id, 'USER_REGISTRATION', 'SUCCESS', { username, role });

      res.status(201).json({
        message: 'User registered successfully.',
        userId: newUser.id,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Endpoint: User Login
 * Controls demonstrated:
 * - Rate Limiting (Strict 5 req/min to mitigate brute-force attempts)
 * - Strict Input Schema Validation
 * - Secure Password Hashing Verification
 * - JWT Issuance & Hardened Session Cookie
 * - Secure Audit Logging
 */
app.post(
  '/api/auth/login',
  strictRateLimiter,
  validateSchema({
    username: { type: 'string', required: true },
    password: { type: 'string', required: true },
  }),
  async (req, res, next) => {
    try {
      const { username, password } = req.body;

      // Find user
      const user = mockUserDb.find(u => u.username === username);
      if (!user) {
        logSecurityEvent('anonymous', 'LOGIN_ATTEMPT', 'FAILURE', { username, reason: 'User not found' });
        // SECURE DESIGN CHOICE - Generic Auth Failure Message:
        // Do not tell the user if the username or password was incorrect. Avoid username enumeration.
        res.status(401).json({ error: 'Invalid username or password.' });
        return;
      }

      // Compare password hash securely using timing-safe bcrypt.compare
      const isMatch = await comparePassword(password, user.passwordHash);
      if (!isMatch) {
        logSecurityEvent(user.id, 'LOGIN_ATTEMPT', 'FAILURE', { username, reason: 'Incorrect password' });
        res.status(401).json({ error: 'Invalid username or password.' });
        return;
      }

      // Sign JWT session token
      const sessionToken = signToken({
        id: user.id,
        username: user.username,
        role: user.role,
      });

      // Write token to hardened session cookie
      res.cookie('session_token', sessionToken, sessionCookieOptions);

      logSecurityEvent(user.id, 'LOGIN_SUCCESS', 'SUCCESS', { username, role: user.role });

      res.status(200).json({
        message: 'Logged in successfully.',
        user: { id: user.id, username: user.username, role: user.role },
        token: sessionToken, // Return in body as well for API clients
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Endpoint: Protected User Profile
 * Controls demonstrated:
 * - Default-Deny authGuard (requires session token in cookie or headers)
 */
app.get('/api/user/profile', authGuard, (req, res) => {
  // req.user has been attached by authGuard middleware
  res.status(200).json({
    message: 'Profile retrieved successfully.',
    profile: req.user,
  });
});

/**
 * Endpoint: Guarded Admin Dashboard
 * Controls demonstrated:
 * - Default-Deny authGuard (enforces authentication)
 * - Role-Based Access Control Middleware (enforces only 'admin' role)
 */
app.get(
  '/api/admin/dashboard',
  authGuard,
  authorizeRoles('admin'),
  (req, res) => {
    res.status(200).json({
      message: 'Welcome to the Secure Admin Dashboard.',
      adminUser: req.user,
      sensitiveSystemMetric: {
        activeConnections: 42,
        dbHealth: 'Excellent',
        lastAuditTimestamp: new Date().toISOString()
      }
    });
  }
);

/**
 * Endpoint: Error Demonstration
 * Controls demonstrated:
 * - Global Generic Error Handler (err, req, res, next)
 * - Catches internal backend crashes, logs details securely, and hides database/server internals from clients.
 */
app.get('/api/test-error', (req, res, next) => {
  const simulatedDbError = new Error('FATAL DB CONNECTION ERROR: SELECT * FROM users WHERE host="10.0.1.25"');
  // Pass the error to next() to let Express route it to our global error handling middleware
  next(simulatedDbError);
});

// 3. Global Generic Error Handler (MUST be registered last)
// SECURE DESIGN CHOICE - Catch-All Fail Safe:
// Handles any uncaught routing or syntax errors in the app.
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`[SecureFin Server] Running on http://localhost:${PORT}`);
});
