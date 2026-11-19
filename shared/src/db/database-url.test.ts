import { describe, expect, it } from "vitest";
import { buildDatabaseUrl, databaseUrlFromEnv } from "./database-url";

const base = { host: "db.internal", port: 5432, name: "saas", username: "app", password: "p@ss" };

describe("database URLs", () => {
  it("are plain without a CA bundle", () => {
    expect(buildDatabaseUrl(base)).toBe("postgresql://app:p%40ss@db.internal:5432/saas");
  });

  it("require verified TLS with one, in each client's own parameters", () => {
    const ca = "/etc/ssl/rds-global-bundle.pem";
    expect(buildDatabaseUrl({ ...base, sslRootCert: ca })).toBe(
      "postgresql://app:p%40ss@db.internal:5432/saas?sslmode=verify-full&sslrootcert=%2Fetc%2Fssl%2Frds-global-bundle.pem",
    );
    expect(buildDatabaseUrl({ ...base, sslRootCert: ca, client: "prisma" })).toBe(
      "postgresql://app:p%40ss@db.internal:5432/saas?sslmode=require&sslcert=%2Fetc%2Fssl%2Frds-global-bundle.pem",
    );
  });

  it("use Prisma's parameters for migrations, from the environment", () => {
    const env = {
      DB_HOST: "db.internal",
      DB_NAME: "saas",
      DB_MIGRATION_USERNAME: "owner",
      DB_MIGRATION_PASSWORD: "x",
      DB_SSL_ROOT_CERT: "/ca.pem",
    };
    expect(databaseUrlFromEnv(env, "migration")).toBe(
      "postgresql://owner:x@db.internal:5432/saas?sslmode=require&sslcert=%2Fca.pem",
    );
  });
});
