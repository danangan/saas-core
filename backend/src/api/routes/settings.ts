import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { USER_SESSION_COOKIE } from "@saas-core/shared";
import { changePasswordBody, companyLimitsSchema, updateProfileBody, userSchema } from "../../schemas";
import { errorResponses, noContent } from "../../libs/http/schema";
import type { RouteOptions } from "../app";

/**
 * The signed-in user's own account (the Settings page), mounted at /api/settings.
 */
export async function settingsRoutes(fastify: FastifyInstance, { services }: RouteOptions) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const { auth } = services;

  app.get(
    "/me",
    { schema: { response: { 200: userSchema, ...errorResponses } } },
    async (request) => auth.getMe(request.context),
  );

  app.patch(
    "/profile",
    { schema: { body: updateProfileBody, response: { 200: userSchema, ...errorResponses } } },
    async (request) => auth.updateProfile(request.context, request.body),
  );

  // The company's plan, limits and usage (the Team page's user count).
  app.get(
    "/limits",
    { schema: { response: { 200: companyLimitsSchema, ...errorResponses } } },
    async (request) => services.plans.getLimits(request.context.companyId),
  );

  app.post(
    "/password",
    { schema: { body: changePasswordBody, response: noContent } },
    async (request, reply) => {
      await auth.changePassword(request.context, request.body);
      return reply.code(204).send(null);
    },
  );

  app.post("/sign-out-everywhere", { schema: { response: noContent } }, async (request, reply) => {
    await auth.signOutEverywhere(request.context);
    reply.clearCookie(USER_SESSION_COOKIE, { path: "/" });
    return reply.code(204).send(null);
  });
}
