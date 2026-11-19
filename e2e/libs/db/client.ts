/**
 * The Prisma client for the test data, as the database's admin (owner) role.
 *
 * The global setup calls initPrismaClient() in the runner's process. The tests run in
 * worker processes, which start after it and inherit its env: so it also leaves the URL
 * in E2E_DATABASE_URL, and getPrismaClient() makes a worker's client from it on first use.
 */
import { createPrismaClient, type PrismaClient } from "@saas-core/shared/db";

const DATABASE_URL_ENV = "E2E_DATABASE_URL";

let prismaClient: PrismaClient | null = null;

export function initPrismaClient(connectionUrl: string): void {
  process.env[DATABASE_URL_ENV] = connectionUrl;
  prismaClient = createPrismaClient(connectionUrl);
}

export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    const url = process.env[DATABASE_URL_ENV];
    if (!url)
      throw new Error(
        "Prisma client is not yet initialised: the global setup calls initPrismaClient().",
      );
    prismaClient = createPrismaClient(url);
  }
  return prismaClient;
}

export async function closePrismaClient(): Promise<void> {
  await prismaClient?.$disconnect();
  prismaClient = null;
}
