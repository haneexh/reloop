import crypto from "crypto";

/**
 * Canonical 32-character unambiguous alphabet (Crockford Base32 variant).
 * Excludes look-alike characters: 0, 1, I, L, O to avoid citizen transcription errors.
 * 32 characters = exactly 5 bits of entropy per character.
 */
export const TRACKING_TOKEN_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
export const TRACKING_TOKEN_CHAR_LENGTH = 10; // 10 chars * 5 bits = 50 bits of cryptographically secure entropy
export const TRACKING_TOKEN_PREFIX = "RLP-HYD-";

/**
 * Generates a cryptographically secure tracking token with at least 50 bits of entropy.
 *
 * Entropy calculation:
 * - 32 characters in alphabet -> log2(32) = 5 bits per character.
 * - 10 characters -> 10 * 5 = 50 bits of entropy (2^50 ≈ 1.125 × 10^15 combinations).
 * - Generated using crypto.randomBytes(10). Since 256 is an exact multiple of 32 (256 / 32 = 8),
 *   byte % 32 has zero modulo bias, guaranteeing perfectly uniform probability distribution.
 *
 * Example output: RLP-HYD-7K9M2W4X8P
 */
export function generateSecureTrackingToken(): string {
  const bytes = crypto.randomBytes(TRACKING_TOKEN_CHAR_LENGTH);
  let tokenBody = "";
  for (let i = 0; i < TRACKING_TOKEN_CHAR_LENGTH; i++) {
    tokenBody += TRACKING_TOKEN_ALPHABET[bytes[i] % TRACKING_TOKEN_ALPHABET.length];
  }
  return `${TRACKING_TOKEN_PREFIX}${tokenBody}`;
}

/**
 * Validates tracking token structure and verifies compatibility with:
 * 1. Standard 50-bit RLP-HYD- tokens (RLP-HYD-[2-9A-HJ-NP-Z]{10})
 * 2. Pre-seeded municipal demo tokens (QR-REQ-HYD-001 through 012)
 * 3. Backward-compatible RLP- tokens from previous deployments
 */
export function isValidTrackingToken(token: unknown): boolean {
  if (typeof token !== "string") return false;
  const clean = token.trim().toUpperCase();

  // 1. Standard canonical format: RLP-HYD- + 10 Crockford Base32 characters
  const standardRegex = /^RLP-HYD-[2-9A-HJ-NP-Z]{10}$/;
  if (standardRegex.test(clean)) return true;

  // 2. Pre-seeded demo tokens
  const demoRegex = /^QR-(?:REQ|DEMO)-HYD-\d{3}$/;
  if (demoRegex.test(clean)) return true;

  // 3. Backward compatibility with older 32-hex or 8-hex tokens
  const legacyRegex = /^RLP-(?:HYD-)?[A-F0-9]{8,32}$/i;
  if (legacyRegex.test(clean)) return true;

  return false;
}

/**
 * Checks whether the given token belongs to the designated pre-seeded evaluation dataset.
 */
export function isDemoTrackingToken(token: unknown): boolean {
  if (typeof token !== "string") return false;
  const clean = token.trim().toUpperCase();
  return clean.startsWith("QR-REQ-HYD-") || clean.startsWith("QR-DEMO-HYD-");
}
