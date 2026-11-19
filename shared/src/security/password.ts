import { hash, verify } from "@node-rs/argon2";

/** argon2id password hashing (salted per hash; parameters are stored in the hash string). */

export { PASSWORD_MIN_LENGTH } from "../constants";

export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Runs a verification that always fails. Use when the account does not exist, so a
 * missing account takes about as long to reject as a wrong password.
 */
export async function verifyDummyPassword(password: string): Promise<false> {
  dummyHash ??= hash("saas-core-dummy-password");
  await verifyPassword(await dummyHash, password);
  return false;
}
