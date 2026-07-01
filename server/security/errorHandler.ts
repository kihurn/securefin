import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

const LOGS_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}
const ERROR_LOG_PATH = path.join(LOGS_DIR, 'error.log');

/**
 * SECURE DESIGN CHOICE - Generic Error Handling (Information Disclosure Mitigation):
 * Attackers leverage detailed server error messages (like database syntax errors, file paths,
 * or stack traces) to understand the system's inner workings and plan targeted exploits.
 * 
 * This global error handler interceptor:
 * 1. Safely writes the detailed error stack trace and request information to an internal log file.
 * 2. Returns a generic, sanitized HTTP 500 error response to the client.
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const timestamp = new Date().toISOString();
  const errorDetails = {
    timestamp,
    message: err.message || 'No message provided',
    stack: err.stack || 'No stack trace available',
    method: req.method,
    url: req.url,
    ip: req.ip,
  };

  // Log detailed error context internally for developer diagnostics
  const logString = JSON.stringify(errorDetails) + '\n';
  fs.appendFile(ERROR_LOG_PATH, logString, (fsErr) => {
    if (fsErr) {
      console.error('CRITICAL: Failed to write to internal error log file:', fsErr);
    }
  });

  // Console output for development debugging
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[Error Context] ${timestamp} - ${req.method} ${req.url}:`, err);
  }

  // Handle known CSRF errors, rate limit errors, or other specific middleware errors if they have custom statuses
  const status = err.status || err.statusCode || 500;

  if (status < 500) {
    // If it's a client error (e.g. CSRF token mismatch, payload too large), we can return the error safely
    res.status(status).json({ error: err.message || 'Bad Request' });
  } else {
    // SECURE DESIGN CHOICE - Generic sanitized payload:
    // Fall back to a default server error response. Do NOT leak err.message or err.stack.
    res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
  }
}
