import { z } from "zod";
import { buildDatabaseUrl } from "@saas-core/shared/db";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // "true" behind a reverse proxy that only it can be reached through (Caddy in production).
  TRUST_PROXY: z.preprocess((v) => v === "true", z.boolean()),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_URL: z.url(),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().min(1),
  DB_USERNAME: z.string().min(1),
  DB_PASSWORD: z.string().default(""),
  // The database server's CA bundle: set, connections require TLS and verify the server.
  DB_SSL_ROOT_CERT: optionalString,
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  EMAIL_FROM: z.string().default("SaaS Core <no-reply@saas-core.local>"),
  // Backend job worker (src/worker.ts).
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(4),
  WORKER_POLL_MS: z.coerce.number().int().positive().default(1000),
});

export type AppConfig = ReturnType<typeof loadConfig>;

/** Reads and validates configuration. The only place environment variables are read. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid configuration:\n${problems}`);
  }
  const e = result.data;
  const isProduction = e.NODE_ENV === "production";
  return {
    isProduction,
    trustProxy: e.TRUST_PROXY,
    host: e.HOST,
    port: e.PORT,
    appUrl: e.APP_URL,
    appOrigin: new URL(e.APP_URL).origin,
    cookieSecure: isProduction,
    databaseUrl: buildDatabaseUrl({
      host: e.DB_HOST,
      port: e.DB_PORT,
      name: e.DB_NAME,
      username: e.DB_USERNAME,
      password: e.DB_PASSWORD,
      sslRootCert: e.DB_SSL_ROOT_CERT,
    }),
    smtp: { host: e.SMTP_HOST, port: e.SMTP_PORT, user: e.SMTP_USER, password: e.SMTP_PASSWORD, from: e.EMAIL_FROM },
    worker: {
      concurrency: e.WORKER_CONCURRENCY,
      pollMs: e.WORKER_POLL_MS,
      sweepMs: 30_000,
    },
  };
}
