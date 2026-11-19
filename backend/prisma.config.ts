import "dotenv/config";
import { defineConfig } from "prisma/config";
import { databaseUrlFromEnv } from "@saas-core/shared/db";

// Migrations run as the database owner (DB_MIGRATION_USERNAME); the app itself
// connects as the restricted saas_app role (DB_USERNAME). Commands that don't
// connect (e.g. `prisma generate`) work without the DB_* variables.
export default defineConfig({
  // The schema and migrations are shared by the packages, in web/prisma.
  schema: "../prisma/schema.prisma",
  migrations: { path: "../prisma/migrations" },
  datasource: { url: databaseUrlFromEnv(process.env, "migration") ?? "" },
});
