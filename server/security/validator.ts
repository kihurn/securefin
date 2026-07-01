import { Request, Response, NextFunction } from 'express';

/**
 * SECURE DESIGN CHOICE - Input Validation and Sanitization (XSS and SQL Injection Mitigation):
 * Unsanitized inputs are the root cause of Cross-Site Scripting (XSS) and SQL Injection vulnerabilities.
 * 
 * This module:
 * 1. Sanitizes string inputs by stripping HTML and `<script>` tags (mitigating XSS).
 * 2. Escapes potential SQL characters like quotes and semicolons (providing defense-in-depth against SQL injection).
 * 3. Enforces strict schema validations for known endpoints.
 */

// Strips out HTML/Script tags and escapes dangerous SQL injection indicators.
export function sanitizeString(value: string): string {
  if (typeof value !== 'string') {
    return value;
  }

  let sanitized = value;

  // 1. Strip <script> ... </script> tags and content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // 2. Strip generic HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // 3. Escape single quotes, double quotes, and semicolons to mitigate SQL injection
  // Note: While parameterized queries are the primary defense, sanitizing inputs at the gateway
  // provides robust defense-in-depth.
  sanitized = sanitized
    .replace(/'/g, "''")      // Escape single quote (SQL Standard)
    .replace(/"/g, '\\"')     // Escape double quote
    .replace(/;/g, '');       // Strip semicolons (prevent multi-statement execution)

  return sanitized.trim();
}

// Recursively walks through request payloads (body, query, params) to sanitize strings.
function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      if (typeof val === 'string') {
        obj[key] = sanitizeString(val);
      } else if (typeof val === 'object') {
        obj[key] = sanitizeObject(val);
      }
    }
  }
  return obj;
}

/**
 * Express middleware to sanitize all incoming request parameters (body, query, and path parameters).
 */
export function sanitizeInputs(req: Request, res: Response, next: NextFunction): void {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
}

/**
 * Middleware factory for strict validation of inputs against predefined simple schemas.
 * Rejects requests failing validation immediately with HTTP 400 Bad Request.
 * 
 * Example usage:
 * validateSchema({
 *   username: { type: 'string', required: true, minLength: 3 },
 *   amount: { type: 'number', required: true }
 * })
 */
export function validateSchema(schema: Record<string, { type: 'string' | 'number' | 'boolean'; required?: boolean; minLength?: number }>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const data = req.body || {};
    
    for (const field in schema) {
      const rule = schema[field];
      const val = data[field];

      // Check required fields
      if (rule.required && (val === undefined || val === null || val === '')) {
        res.status(400).json({ error: `Field '${field}' is required.` });
        return;
      }

      if (val !== undefined && val !== null) {
        // Enforce strict types
        if (rule.type === 'number') {
          const num = Number(val);
          if (isNaN(num)) {
            res.status(400).json({ error: `Field '${field}' must be a valid number.` });
            return;
          }
        } else if (typeof val !== rule.type) {
          res.status(400).json({ error: `Field '${field}' must be of type ${rule.type}.` });
          return;
        }

        // Min length validation for strings
        if (rule.type === 'string' && rule.minLength && (val as string).length < rule.minLength) {
          res.status(400).json({ error: `Field '${field}' must be at least ${rule.minLength} characters.` });
          return;
        }
      }
    }
    next();
  };
}
