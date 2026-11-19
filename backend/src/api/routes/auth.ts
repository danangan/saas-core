import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { USER_SESSION_COOKIE } from "@saas-core/shared";
import { acceptInvitationBody, companyPublicSchema, companyRedirectSchema, invitationInfoSchema, passwordResetConfirmBody, passwordResetRequestBody, userLoginPayload, userSchema } from "../../schemas";
import type { Services } from "../../services/container";
import { sessionCookieOptions } from "../../libs/http/cookies";
import { errorResponses, noContent } from "../../libs/http/schema";
import { tokenBody } from "../../schemas";

export type AuthRoutesOptions = { services: Services; cookieSecure: boolean };

const sessionMeta = (request: FastifyRequest) => ({ userAgent: request.headers["user-agent"] ?? null });

/**
 * User sign-in, sign-up, and password reset, mounted at /api/auth. No session needed.
 * Tokens from email links are sent in request bodies, never URLs, so they aren't logged.
 */
export async function authRoutes(fastify: FastifyInstance, { services, cookieSecure }: AuthRoutesOptions) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const { companies, auth, users, sessions } = services;
  const cookieOptions = sessionCookieOptions({ secure: cookieSecure, maxAgeMs: sessions.policy.maxAgeMs });

  // Login step 1: does this workspace exist?
  app.get(
    "/companies/:slug",
    {
      schema: {
        params: z.object({ slug: z.string() }),
        response: { 200: companyPublicSchema, ...errorResponses },
      },
    },
    async (request) => companies.findActiveBySlug(request.params.slug.toLowerCase()),
  );

  // Login step 2: password. Sets the session cookie.
  app.post(
    "/login",
    { schema: { body: userLoginPayload, response: { 200: userSchema, ...errorResponses } } },
    async (request, reply) => {
      const { token, me } = await auth.loginUser(request.body, sessionMeta(request));
      reply.setCookie(USER_SESSION_COOKIE, token, cookieOptions);
      return me;
    },
  );

  app.post("/logout", { schema: { response: noContent } }, async (request, reply) => {
    const token = request.cookies[USER_SESSION_COOKIE];
    if (token) await sessions.deleteSession(token);
    reply.clearCookie(USER_SESSION_COOKIE, { path: "/" });
    return reply.code(204).send(null);
  });

  // Sign up from an invitation link.
  app.post(
    "/invitations/lookup",
    { schema: { body: tokenBody, response: { 200: invitationInfoSchema, ...errorResponses } } },
    async (request) => users.describeInvitation(request.body.token),
  );

  app.post(
    "/invitations/accept",
    {
      schema: {
        body: acceptInvitationBody,
        response: { 200: companyRedirectSchema, ...errorResponses },
      },
    },
    async (request) => users.acceptInvitation(request.body.token, request.body.password),
  );

  // Forgot password. Always 204, whether or not the account exists.
  app.post(
    "/password-reset/request",
    { schema: { body: passwordResetRequestBody, response: noContent } },
    async (request, reply) => {
      await auth.requestPasswordReset(request.body.slug, request.body.email);
      return reply.code(204).send(null);
    },
  );

  app.post(
    "/password-reset/confirm",
    {
      schema: {
        body: passwordResetConfirmBody,
        response: { 200: companyRedirectSchema, ...errorResponses },
      },
    },
    async (request) => auth.resetPassword(request.body.token, request.body.password),
  );
}
