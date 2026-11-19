import { createHash, randomBytes } from "node:crypto";

/**
 * Secret tokens (session cookies, invitation links, reset links).
 * The raw value goes to the user; only its hash is stored.
 */

/** Random 256-bit token, base64url encoded. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 of a token, as stored in the database. */
export function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
