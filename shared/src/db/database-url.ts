/**
 * Builds Postgres connection strings from the DB_* variables. The app connects as
 * DB_USERNAME (the restricted saas_app role); migrations run as DB_MIGRATION_USERNAME
 * (the owner). Host, port and database name are shared.
 */
export type DatabaseConnection = {
  host: string;
  port: number | string;
  name: string;
  username: string;
  password: string;
  /**
   * The server's CA bundle (e.g. AWS's RDS bundle): when set, the connection requires TLS
   * and verifies the server's certificate against it.
   */
  sslRootCert?: string;
  /**
   * Who reads the URL, since they name the CA bundle differently: the app's driver (pg,
   * `sslrootcert`) or Prisma's migration engine (`sslcert`).
   */
  client?: "pg" | "prisma";
};

export function buildDatabaseUrl(c: DatabaseConnection): string {
  const user = encodeURIComponent(c.username);
  const password = encodeURIComponent(c.password);
  const url = `postgresql://${user}:${password}@${c.host}:${c.port}/${encodeURIComponent(c.name)}`;
  if (!c.sslRootCert) return url;
  const ca = encodeURIComponent(c.sslRootCert);
  return c.client === "prisma" ? `${url}?sslmode=require&sslcert=${ca}` : `${url}?sslmode=verify-full&sslrootcert=${ca}`;
}

/**
 * The connection string for `role` from environment variables, or undefined when any
 * required variable is missing. For scripts and tooling that don't load the full config.
 */
export function databaseUrlFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  role: "app" | "migration",
): string | undefined {
  const username = role === "app" ? env.DB_USERNAME : env.DB_MIGRATION_USERNAME;
  const password = role === "app" ? env.DB_PASSWORD : env.DB_MIGRATION_PASSWORD;
  if (!env.DB_HOST || !env.DB_NAME || !username) return undefined;
  return buildDatabaseUrl({
    host: env.DB_HOST,
    port: env.DB_PORT || 5432,
    name: env.DB_NAME,
    username,
    password: password ?? "",
    sslRootCert: env.DB_SSL_ROOT_CERT || undefined,
    // Migrations run through Prisma's engine; the app (and scripts) through pg.
    client: role === "migration" ? "prisma" : "pg",
  });
}
