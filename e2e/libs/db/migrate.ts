import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const BACKEND = fileURLToPath(new URL("../../../backend", import.meta.url));

/**
 * Runs the backend's migrations with its own Prisma CLI, as the database's owner
 * (`databaseUrl`). Local mode only: staging is migrated by its deploy. The backend's
 * Prisma config reads the DB_MIGRATION_* variables.
 */
export async function migrate(databaseUrl: string): Promise<void> {
  const url = new URL(databaseUrl);
  const env = {
    ...process.env,
    DB_HOST: url.hostname,
    DB_PORT: url.port || "5432",
    DB_NAME: decodeURIComponent(url.pathname.slice(1)),
    DB_MIGRATION_USERNAME: decodeURIComponent(url.username),
    DB_MIGRATION_PASSWORD: decodeURIComponent(url.password),
  };
  try {
    await promisify(execFile)("./node_modules/.bin/prisma", ["migrate", "deploy"], {
      cwd: BACKEND,
      env,
    });
  } catch (error) {
    const { stdout = "", stderr = "" } = error as { stdout?: string; stderr?: string };
    throw new Error(`[e2e] database migration failed:\n${stdout}${stderr}`, { cause: error });
  }
  console.info("[e2e] database migrated");
}
