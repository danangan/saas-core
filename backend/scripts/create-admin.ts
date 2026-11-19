/**
 * Creates an admin account, or resets the password of an existing one.
 *
 *   pnpm admin:create [username]
 *
 * Prompts for anything not given (password input is hidden). Without a terminal
 * (CI, scripts), pass the username as an argument and the password in ADMIN_PASSWORD.
 * Only needs the DB_* variables.
 */
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { createPrismaClient } from "@saas-core/shared/db";
import { databaseUrlFromEnv } from "@saas-core/shared/db";
import { FailureLimiter } from "../src/libs/rate-limit";
import { PASSWORD_MIN_LENGTH } from "@saas-core/shared/security";
import { InvalidInputError } from "../src/libs/errors";
import { AuthService, EmailService, SessionService } from "../src/services";

const interactive = Boolean(process.stdin.isTTY);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function prompt(question: string, { hidden = false } = {}): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stdout.write(chunk);
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  const answer = rl.question(question);
  muted = hidden;
  try {
    return (await answer).trim();
  } finally {
    rl.close();
    if (hidden) process.stdout.write("\n");
  }
}

async function readUsername(): Promise<string> {
  const fromArgs = process.argv[2]?.trim();
  if (fromArgs) return fromArgs;
  if (!interactive) fail("Usage: pnpm admin:create <username>   (set ADMIN_PASSWORD when not in a terminal)");
  const username = await prompt("Username: ");
  if (!username) fail("Username is required.");
  return username;
}

async function readPassword(): Promise<string> {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (!interactive) fail("ADMIN_PASSWORD is not set, and there is no terminal to prompt for a password.");
  const password = await prompt(`Password (at least ${PASSWORD_MIN_LENGTH} characters): `, { hidden: true });
  if (password !== (await prompt("Confirm password: ", { hidden: true }))) fail("Passwords do not match.");
  return password;
}

async function main() {
  const databaseUrl = databaseUrlFromEnv(process.env, "app");
  if (!databaseUrl) fail("DB_HOST, DB_NAME and DB_USERNAME must be set. Copy backend/.env.example to backend/.env.");

  const username = await readUsername();
  const password = await readPassword();

  const db = createPrismaClient(databaseUrl);
  const limiter = () => new FailureLimiter({ maxFailures: 5, windowMs: 15 * 60 * 1000 });
  // Creating an admin sends no email and builds no links, so this script needs only the DB_* variables.
  const noEmail = new EmailService(
    {
      send: async () => {
        throw new Error("Email isn't available in create-admin.");
      },
    },
    "",
  );
  const auth = new AuthService(db, new SessionService(db), noEmail, limiter(), limiter(), "http://localhost");
  try {
    const { created } = await auth.createOrResetAdmin(username, password);
    console.log(
      created
        ? `Admin "${username}" created. Sign in at /admin.`
        : `Password updated for admin "${username}"; their sessions were signed out.`,
    );
  } catch (error) {
    if (error instanceof InvalidInputError) fail(error.message);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
