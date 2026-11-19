import { defineConfig } from "prisma/config";
import { databaseUrlFromEnv } from "./src/db/database-url";

// Generates the Prisma client into src/db/generated (`pnpm db:generate`, and on install),
// and migrates test databases (src/db/test-helpers/postgres.ts) as DB_MIGRATION_*.
// The backend migrates the real database with its own config (backend/prisma.config.ts).
export default defineConfig({
  schema: "../prisma/schema.prisma",
  migrations: { path: "../prisma/migrations" },
  datasource: { url: databaseUrlFromEnv(process.env, "migration") ?? "" },
});
