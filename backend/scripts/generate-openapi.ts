/**
 * Writes the API's OpenAPI document to web/openapi.json, from the routes' zod schemas.
 * The UI's client types are generated from it (pnpm api:generate, in web/).
 *
 *   pnpm openapi
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildApp } from "../src/api/app";
import type { Services } from "../src/services/container";

/** Where the document is written, for the UI's generated client. */
export const OPENAPI_PATH = new URL("../../openapi.json", import.meta.url);

/** Any service, at any depth: registering the routes only reads their shape. */
function stubServices(): Services {
  const stub: object = new Proxy(() => stub, {
    // A setting read as a number (e.g. the session's max age) is 0.
    get: (_target, key) => (key === Symbol.toPrimitive ? () => 0 : stub),
    apply: () => stub,
  });
  return stub as Services;
}

/**
 * The API's OpenAPI document, built from the routes' zod schemas. Registering the
 * routes needs no database or network, so this runs anywhere.
 */
export async function buildOpenApiDocument(): Promise<string> {
  const app = await buildApp({
    services: stubServices(),
    appOrigin: "http://localhost:3000",
    cookieSecure: false,
    logger: false,
  });
  await app.ready();
  const document = JSON.stringify(app.swagger(), null, 2) + "\n";
  await app.close();
  return document;
}

// Writes the file when run (pnpm openapi); importing it (the up-to-date test) doesn't.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await writeFile(OPENAPI_PATH, await buildOpenApiDocument());
  console.info(`Wrote ${fileURLToPath(OPENAPI_PATH)}`);
}
