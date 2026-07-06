import fs from 'fs';
import path from 'path';

/**
 * Appends a structured record of security-critical events to a local audit log, redacting PII or secrets.
 * 7.) System Activity Logging (creates a secure record of important security events)
 */
export function logSecurityEvent(event: string, details: any) {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Create a shadow copy and censor password/sensitive entries
    const redactedDetails = { ...details };
    if (redactedDetails.password) {
      redactedDetails.password = '[REDACTED]';
    }
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      details: redactedDetails
    };
    
    fs.appendFileSync(
      path.join(logsDir, 'security.log'),
      JSON.stringify(logEntry) + '\n'
    );
  } catch (error) {
    console.error('Failed to write security audit log event:', error);
  }
}
