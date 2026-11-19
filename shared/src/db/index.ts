/**
 * The database, for the backend and the e2e tests (`@saas-core/shared/db`): the models'
 * types and the Prisma client generated from web/prisma/schema.prisma, and
 * createPrismaClient to connect. Never imported from the main entry, so the UI doesn't
 * bundle Prisma.
 */
export { createPrismaClient, isPrismaError, PrismaErrorCode } from "./client";
export { buildDatabaseUrl, databaseUrlFromEnv, type DatabaseConnection } from "./database-url";
export * from "./generated/prisma/client";
