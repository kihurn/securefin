import crypto from 'crypto';

const SERVER_SECRET = process.env.JWT_SECRET || 'fintrust-sovereign-node-secret-key-1337-abc';

/**
 * Generates a signed custom token (JWT) with secure payload.
 * 2.) Secure Session Management (manages secure login tokens and cookies)
 */
export function generateCustomToken(payload: { uid: string; email: string; name: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SERVER_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Verifies and decodes a custom token (JWT).
 */
export function verifyCustomToken(token: string): { uid: string; email: string; name: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', SERVER_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    if (signature !== expectedSignature) return null;
    
    const decodedBody = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (decodedBody.exp && decodedBody.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decodedBody;
  } catch {
    return null;
  }
}
