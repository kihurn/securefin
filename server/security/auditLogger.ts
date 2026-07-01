import fs from 'fs';
import path from 'path';

// Define the root logs directory.
const LOGS_DIR = path.join(process.cwd(), 'logs');

// SECURE DESIGN CHOICE - Audit Trail Integrity:
// Security logs must be written to a local file system (or forwarded to a secure SIEM).
// If the directory does not exist, we initialize it.
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const LOG_FILE_PATH = path.join(LOGS_DIR, 'security.log');

/**
 * SECURE DESIGN CHOICE - PII and Secrets Redaction:
 * To prevent the accidental disclosure of passwords, API keys, or session tokens in plain text log files,
 * this function recursively traverses the log details and replaces sensitive values with '[REDACTED]'.
 */
function redactSecrets(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => redactSecrets(item));
  }

  const redactedObj: Record<string, any> = {};
  const sensitivePatterns = [/password/i, /token/i, /secret/i, /key/i, /credit.*card/i];

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      const isSensitive = sensitivePatterns.some(pattern => pattern.test(key));

      if (isSensitive) {
        redactedObj[key] = '[REDACTED]';
      } else if (typeof val === 'object' && val !== null) {
        redactedObj[key] = redactSecrets(val);
      } else {
        redactedObj[key] = val;
      }
    }
  }

  return redactedObj;
}

/**
 * Logs a security-relevant event to a structured, tamper-evident log file.
 * 
 * @param userId The ID of the user performing the action, or 'anonymous'.
 * @param eventType Description of the security action (e.g. 'LOGIN_FAILURE', 'PRIVILEGE_ESCALATION').
 * @param status Event status, typically 'SUCCESS' or 'FAILURE'.
 * @param details Additional context variables.
 */
export function logSecurityEvent(
  userId: string,
  eventType: string,
  status: 'SUCCESS' | 'FAILURE' | string,
  details: Record<string, any> = {}
): void {
  const sanitizedDetails = redactSecrets(details);

  // SECURE DESIGN CHOICE - Structured Logging (JSON Lines):
  // Structured log entries are easy to ingest into SIEM (Security Information and Event Management) tools.
  // Including precise ISO timestamps is critical for timeline reconstruction during forensic audits.
  const logEntry = {
    timestamp: new Date().toISOString(),
    userId: userId || 'anonymous',
    eventType,
    status,
    details: sanitizedDetails,
  };

  const logString = JSON.stringify(logEntry) + '\n';

  fs.appendFile(LOG_FILE_PATH, logString, (err) => {
    if (err) {
      // Fallback to standard error output if file logging fails (to prevent silent logging failures)
      console.error('CRITICAL: Failed to write security audit log to file:', err);
    }
  });
}
