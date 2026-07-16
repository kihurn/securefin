import { logSecurityEvent } from './auditLogger';

let sanitizationCount = 0;

export function getSanitizationCount() {
  return sanitizationCount;
}

/**
 * Strips script tags and escapes hazardous SQL quotes to mitigate XSS and injection.
 * 6.) Input Cleaning and Validation (checks and cleans all user inputs to ensure they are safe)
 */
export function sanitizeInput(val: string): string {
  if (typeof val !== 'string') return val;
  // Remove script tags and their inner content
  let cleaned = val.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '');
  // Escape single quotes for SQL safety by doubling them
  cleaned = cleaned.replace(/'/g, "''");
  
  if (cleaned !== val) {
    sanitizationCount++;
    logSecurityEvent('Input Sanitized', { 
      hasScriptTag: /<script/i.test(val),
      hasQuotes: /'/.test(val)
    });
  }
  return cleaned;
}
