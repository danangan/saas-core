import Fastify, { type FastifyServerOptions } from "fastify";
import cookie from "@fastify/cookie";
import swagger from "@fastify/swagger";
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
} from "fastify-type-provider-zod";
import type { Services } from "../services/container";
import { registerCsrfProtection } from "../libs/http/csrf";
import { errorHandler } from "../libs/errors";
import { requestValidator } from "../libs/http/schema";
import { RouteGuard } from "../libs/route-guard";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { settingsRoutes } from "./routes/settings";
import { teamRoutes } from "./routes/team";
import { companyRoutes } from "./routes/company";

/** What each route group is registered with. */
export type RouteOptions = { services: Services; guard: RouteGuard };

export type AppOptions = {
  services: Services;
  appOrigin: string;
  cookieSecure: boolean;
  logger?: FastifyServerOptions["logger"];
  /** Behind a reverse proxy: take the client's address from X-Forwarded-For. */
  trustProxy?: boolean;
};

/**
 * Each named schema is listed twice, as it's sent ("User") and as it's received
 * ("UserInput"). Responses only use the first, so input copies nothing refers to go.
 */
function withoutUnusedInputs<T extends ReturnType<typeof jsonSchemaTransformObject>>(document: T): T {
  const { components } = document as { components?: { schemas?: Record<string, unknown> } };
  const schemas = components?.schemas;
  if (!schemas) return document;
  const text = JSON.stringify({ ...document, components: { ...components, schemas: {} } });
  for (const name of Object.keys(schemas)) {
    if (name.endsWith("Input") && !text.includes(`#/components/schemas/${name}"`)) delete schemas[name];
  }
  return document;
}

/** Builds the HTTP app. Services are passed in, so tests can supply their own. */
export async function buildApp({ services, appOrigin, cookieSecure, logger = true, trustProxy = false }: AppOptions) {
  const app = Fastify({
    logger,
    bodyLimit: 1024 * 1024,
    trustProxy,
  });

  // Requests are validated, and responses checked, with each route's zod schemas.
  app.setValidatorCompiler(requestValidator);
  app.setSerializerCompiler(serializerCompiler);
  // Builds the OpenAPI document from those schemas (scripts/generate-openapi.ts).
  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: { title: "SaaS Core API", version: "1.0.0" },
    },
    transform: jsonSchemaTransform,
    // Schemas with an id (`.meta({ id })`) become named components the routes refer to.
    transformObject: (document) => withoutUnusedInputs(jsonSchemaTransformObject(document)),
  });

  await app.register(cookie);
  registerCsrfProtection(app, appOrigin);
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: "Not found." }));

  app.get("/health", async () => ({ ok: true }));
  const guard = new RouteGuard(services.sessions);

  await app.register(adminRoutes, { prefix: "/api/admin", services, guard, cookieSecure });
  await app.register(authRoutes, { prefix: "/api/auth", services, cookieSecure });

  // Signed-in users: every group in here needs a user session.
  await app.register(
    guard.withAuthenticatedUser(async (app) => {
      await app.register(settingsRoutes, { prefix: "/api/settings", services, guard });
      await app.register(teamRoutes, { prefix: "/api/team", services, guard });
      await app.register(companyRoutes, { prefix: "/api/company", services, guard });
    }),
  );

  return app;
}
