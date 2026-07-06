import crypto from 'crypto';

/**
 * Creates a secure salt and pbkdf2 hash of a password.
 * 1.) Password Hashing / Encryption (scrambles user passwords before storing them)
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies a raw password matches a previously generated salt and hash.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    if (!storedHash || !storedHash.includes(':')) {
      return password === storedHash;
    }
    const parts = storedHash.split(':');
    if (parts.length !== 2) {
      return password === storedHash;
    }
    const [salt, hash] = parts;
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  } catch {
    // Fallback if hash format is not pbkdf2 format (e.g. plain text seed user)
    return password === storedHash;
  }
}
