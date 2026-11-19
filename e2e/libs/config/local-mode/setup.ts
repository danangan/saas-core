/**
 * Playwright's globalSetup in local mode (E2E_MODE=local):
 * 1. starts the containers (stack.ts);
 * 2. connects the test data's Prisma client to their Postgres, as its admin, and migrates it;
 * 3. starts the app's services against the containers (services.ts).
 * The tests make the admins, companies and users they need themselves (libs/db/).
 *
 * The function it returns is the teardown: Playwright runs it after the tests. It deletes
 * everything named after the run, then stops the services and removes the containers.
 * One function, so the cleanup always runs before the stack goes.
 *
 * Staging's is ../staging-mode/setup.ts.
 */
import { cleanupOrWarn } from "../../db/cleanup.ts";
import { closePrismaClient, initPrismaClient } from "../../db/client.ts";
import { migrate } from "../../db/migrate.ts";
import { config } from "../config.ts";
import { Services } from "./services.ts";
import { Stack } from "./stack.ts";

export default async function setup(): Promise<() => Promise<void>> {
  console.info(`[e2e] local run ${config.testExecutionId}`);
  console.info("[e2e] starting Postgres and Mailpit containers…");
  const stack = Stack.getInstance();
  await stack.start();
  console.info("[e2e] containers up");

  // Workers start after globalSetup and inherit this: libs/helpers/mailpit.ts reads it.
  process.env.E2E_MAILPIT_URL = stack.mailpit.getURL();

  const services = new Services(stack);
  const stop = async () => {
    console.info("[e2e] stopping the services and containers…");
    await closePrismaClient();
    await services.stop();
    await stack.stop();
  };

  // As the container's admin (owner) role. Also passed to the workers (see db/client.ts).
  const dbConnectionString = stack.postgres.getURL();
  initPrismaClient(dbConnectionString);
  try {
    await migrate(dbConnectionString);
    await services.start();
  } catch (error) {
    // Nothing to clean up: the containers go, and the database with them.
    await stop();
    throw error;
  }

  return async () => {
    await cleanupOrWarn();
    await stop();
  };
}
