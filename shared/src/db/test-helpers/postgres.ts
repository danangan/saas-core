import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PostgresTestContainer } from "../../test-container";

const run = promisify(execFile);

export type TestDatabase = {
  /** Connects as saas_app. */
  url: string;
  /** Connects as the database's admin (superuser), for tests that change server settings. */
  ownerUrl: string;
  stop: () => Promise<void>;
};

/** Starts Postgres (with the app's roles) and runs the Prisma migrations. */
export async function startTestDatabase(): Promise<TestDatabase> {
  const postgres = new PostgresTestContainer();
  await postgres.start();
  try {
    const admin = postgres.getUser();
    // prisma.config.ts builds its URL from the DB_MIGRATION_* variables; dotenv doesn't override them.
    await run("pnpm", ["exec", "prisma", "migrate", "deploy"], {
      cwd: new URL("../../..", import.meta.url).pathname,
      env: {
        ...process.env,
        DB_HOST: postgres.getHost(),
        DB_PORT: String(postgres.getPort()),
        DB_NAME: postgres.getDatabase(),
        DB_MIGRATION_USERNAME: admin.username,
        DB_MIGRATION_PASSWORD: admin.password,
      },
    });
  } catch (error) {
    await postgres.stop();
    throw error;
  }

  return {
    url: postgres.getURL("saas_app"),
    ownerUrl: postgres.getURL(),
    stop: () => postgres.stop(),
  };
}
