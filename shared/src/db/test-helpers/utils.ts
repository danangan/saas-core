import { randomBytes } from "node:crypto";


/** A random secret: a password or a sign-up token. */
export function randomSecret(): string {
  return randomBytes(18).toString("base64url");
}
