import bcrypt from 'bcrypt';

/**
 * SECURE DESIGN CHOICE - Work Factor / Salt Rounds:
 * Using 12 salt rounds (2^12 = 4096 iterations) strikes a robust balance between
 * security (delaying brute-force attacks) and performance (server response times).
 * Lower rounds are too weak for modern hardware, while higher rounds can trigger denial-of-service (DoS)
 * vulnerabilities by exhausting server CPU under heavy authentication loads.
 */
const SALT_ROUNDS = 12;

/**
 * Hashes a plaintext password using bcrypt's adaptive hashing algorithm.
 * Bcrypt automatically generates a unique secure random salt and pre-appends it to the resulting hash.
 * This prevents rainbow table attacks and guarantees that identical passwords hash to different values.
 * 
 * @param password The plaintext password to be hashed.
 * @returns A promise that resolves to the cryptographically secure hash string.
 */
export async function hashPassword(password: string): Promise<string> {
  // Defensive check: Ensure input is a valid string and not empty.
  if (!password || typeof password !== 'string') {
    throw new Error('Invalid password input provided for hashing.');
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compares a plaintext password against a stored bcrypt hash.
 * Bcrypt uses a timing-attack-resistant comparison algorithm. Comparing hashes with a standard
 * string equality operator (===) leaks information about how many characters match, allowing attackers
 * to reconstruct hashes character by character. Bcrypt's compare function prevents this.
 * 
 * @param password The plaintext password to verify.
 * @returns A promise that resolves to true if the password matches, or false otherwise.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }
  return bcrypt.compare(password, hash);
}
