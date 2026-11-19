/**
 * Playwright's globalSetup in staging mode (E2E_MODE=staging): connects the test data's
 * Prisma client to staging's database, as its admin (E2E_DATABASE_URL). Staging is
 * already deployed and migrated. The tests make the admins, companies and users they need
 * themselves (libs/db/), named after the run (`e2e-<id>`).
 *
 * The function it returns is the teardown: Playwright runs it after the tests, and it
 * deletes everything named after the run.
 *
 * Local mode's is ../local-mode/setup.ts.
 */
import { cleanupOrWarn } from "../../db/cleanup.ts";
import { closePrismaClient, initPrismaClient } from "../../db/client.ts";
import { config, E2EConfig } from "../config.ts";

export default async function setup(): Promise<() => Promise<void>> {
  console.info(`[e2e] staging run ${config.testExecutionId} against ${config.baseURL}`);

  const dbConnectionString = E2EConfig.required("E2E_DATABASE_URL");
  initPrismaClient(dbConnectionString);

  return async () => {
    await cleanupOrWarn();
    await closePrismaClient();
  };
}
