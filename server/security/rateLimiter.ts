import rateLimit from 'express-rate-limit';

/**
 * SECURE DESIGN CHOICE - Rate Limiting (DDoS & Brute-Force Mitigation):
 * Implements a rate limiter configured to restrict rapid-fire authentication
 * or credential harvesting attempts.
 * 
 * - windowMs: 1 minute (60,000 milliseconds).
 * - max: 5 requests.
 * 
 * This design protects high-risk endpoints (login, registration, two-factor auth, transactions)
 * from brute-force password cracking, credential stuffing, and application-layer Denial of Service (DoS) attacks.
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 20, // Limit each IP to 20 requests per windowMs
  standardHeaders: true, // Return standard rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers to avoid unnecessary information disclosure
  statusCode: 429, // Return HTTP 429 Too Many Requests
  message: {
    error: 'Too many requests from this IP. Please try again after a minute.',
  },
  // Ensure that behind reverse proxies (like Cloudflare, Nginx, or Heroku), the correct IP is resolved.
  // The server must have trust proxy enabled: app.set('trust proxy', 1).
});
