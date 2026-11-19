import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { ADMIN_SESSION_COOKIE } from "@saas-core/shared";
import { adminLoginBody, adminSchema, auditEntrySchema, bulkInviteBody, bulkInviteResultSchema, companyDetailSchema, companyStateSchema, companySummarySchema, companyUserSchema, createCompanyBody, newUserBody, updateUserBody } from "../../schemas";
import type { CompanyDetail, CompanySummary } from "../../types";
import type { Services } from "../../services/container";
import { sessionCookieOptions } from "../../libs/http/cookies";
import { DeliveryFailedError } from "../../libs/errors";
import { errorResponses, idParams, noContent } from "../../libs/http/schema";
import { CompanyAudit, type CompanyDTO, type CompanyLimitsDTO } from "../../services";
import { updateCompanyBody } from "../../schemas";
import type { RouteGuard } from "../../libs/route-guard";
import { toAuditEntry, toCompanyUser } from "../../libs/http/mappers";

export type AdminRoutesOptions = { services: Services; guard: RouteGuard; cookieSecure: boolean };

const userParams = z.object({ id: z.string().min(1), userId: z.string().min(1) });

// --- Response mapping (service DTOs -> API types) ------------------------

const toCompanySummary = (t: CompanyDTO): CompanySummary => ({
  id: t.id,
  name: t.name,
  slug: t.slug,
  isActive: t.isActive,
  plan: t.plan,
  createdAt: t.createdAt.toISOString(),
  userCount: t.userCount ?? 0,
});

const toCompanyDetail = (t: CompanyDTO, limits: CompanyLimitsDTO): CompanyDetail => ({
  id: t.id,
  name: t.name,
  slug: t.slug,
  isActive: t.isActive,
  plan: t.plan,
  createdAt: t.createdAt.toISOString(),
  users: (t.users ?? []).map(toCompanyUser),
  limits,
});

/** Admin API, mounted at /api/admin. */
export async function adminRoutes(
  fastify: FastifyInstance,
  { services, guard, cookieSecure }: AdminRoutesOptions,
) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const { auth, sessions, companies, users, audit, plans } = services;
  const cookieOptions = sessionCookieOptions({
    secure: cookieSecure,
    maxAgeMs: sessions.policy.maxAgeMs,
  });

  // --- Auth (no session required) -----------------------------------------

  app.post(
    "/auth/login",
    { schema: { body: adminLoginBody, response: { 200: adminSchema, ...errorResponses } } },
    async (request, reply) => {
      const { username, password } = request.body;
      const admin = await auth.authenticateAdmin(username, password);
      const { token } = await sessions.createSession(
        { kind: "admin", adminId: admin.id },
        { userAgent: request.headers["user-agent"] ?? null },
      );
      reply.setCookie(ADMIN_SESSION_COOKIE, token, cookieOptions);
      return admin;
    },
  );

  app.post("/auth/logout", { schema: { response: noContent } }, async (request, reply) => {
    const token = request.cookies[ADMIN_SESSION_COOKIE];
    if (token) await sessions.deleteSession(token);
    reply.clearCookie(ADMIN_SESSION_COOKIE, { path: "/" });
    return reply.code(204).send(null);
  });

  // --- Everything below requires an admin session ---------------------------

  app.register(
    guard.withAuthenticatedAdmin((authed) => {
      authed.decorateRequest("adminAudit", null as unknown as CompanyAudit);
      // Records audit entries as the signed-in admin (after the session guard).
      authed.addHook("onRequest", async (request: FastifyRequest) => {
        const { admin } = request.adminSession;
        request.adminAudit = new CompanyAudit(audit, { type: "admin", id: admin.id, label: admin.username });
      });

      authed.get(
        "/me",
        { schema: { response: { 200: adminSchema, ...errorResponses } } },
        async (request) => auth.getAdmin(request.adminContext),
      );

      // Companies

      authed.get(
        "/companies",
        { schema: { response: { 200: z.array(companySummarySchema), ...errorResponses } } },
        async () => (await companies.listCompanies()).map(toCompanySummary),
      );

      authed.post(
        "/companies",
        { schema: { body: createCompanyBody, response: { 201: companySummarySchema, ...errorResponses } } },
        async (request, reply) => {
          const company = await companies.createCompany(request.body.name);
          await request.adminAudit.companyCreated(company);
          return reply.code(201).send(toCompanySummary(company));
        },
      );

      authed.get(
        "/companies/:id",
        { schema: { params: idParams, response: { 200: companyDetailSchema, ...errorResponses } } },
        async (request) => {
          const company = await companies.getCompany(request.params.id);
          return toCompanyDetail(company, await plans.getLimits(company.id));
        },
      );

      // Any of: rename, activate or deactivate, change the plan.
      authed.patch(
        "/companies/:id",
        {
          schema: {
            params: idParams,
            body: updateCompanyBody,
            response: { 200: companyStateSchema, ...errorResponses },
          },
        },
        async (request) => {
          const { name, isActive, plan } = request.body;
          let company = await companies.getCompany(request.params.id); // 404 for an unknown one
          if (name !== undefined || isActive !== undefined) {
            const { before, after } = await companies.updateCompany(company.id, { name, isActive });
            await request.adminAudit.companyUpdated(before, after);
            company = after;
          }
          if (plan !== undefined) {
            const { before, after } = await plans.changePlan(company.id, plan);
            await request.adminAudit.planChanged(company, before.plan, after.plan);
          }
          return {
            id: company.id,
            name: company.name,
            isActive: company.isActive,
            limits: await plans.getLimits(company.id),
          };
        },
      );

      authed.get(
        "/companies/:id/activity",
        {
          schema: {
            params: idParams,
            response: { 200: z.array(auditEntrySchema), ...errorResponses },
          },
        },
        async (request) => {
          await companies.getCompany(request.params.id); // 404 for an unknown or deleted company
          return (await audit.listForCompany(request.params.id)).map(toAuditEntry);
        },
      );

      authed.delete(
        "/companies/:id",
        { schema: { params: idParams, response: noContent } },
        async (request, reply) => {
          await companies.deleteCompany(request.params.id);
          return reply.code(204).send(null);
        },
      );

      // Users

      authed.post(
        "/companies/:id/users",
        {
          schema: {
            params: idParams,
            body: newUserBody,
            response: { 201: companyUserSchema, ...errorResponses },
          },
        },
        async (request, reply) => {
          const body = request.body;
          try {
            const user = await users.addUser({ companyId: request.params.id, ...body });
            await request.adminAudit.userInvited(user);
            return reply.code(201).send(toCompanyUser(user));
          } catch (error) {
            // Added, but the email failed: still worth an entry.
            if (error instanceof DeliveryFailedError) {
              await request.adminAudit.userInvited(
                await users.getUserByEmail(request.params.id, body.email),
              );
            }
            throw error;
          }
        },
      );

      authed.post(
        "/companies/:id/users/bulk",
        {
          schema: {
            params: idParams,
            body: bulkInviteBody,
            response: { 200: bulkInviteResultSchema, ...errorResponses },
          },
        },
        async (request) => {
          const { users: entries, role } = request.body;
          await companies.getCompany(request.params.id); // 404 before inviting anyone
          const { results, invited } = await users.bulkInvite(request.params.id, entries, role);
          await request.adminAudit.usersInvited(request.params.id, results, invited);
          return results;
        },
      );

      // A user is always addressed within its company, so every query filters on both.
      authed.post(
        "/companies/:id/users/:userId/resend-invitation",
        { schema: { params: userParams, response: noContent } },
        async (request, reply) => {
          const user = await users.resendInvitation(request.params.id, request.params.userId);
          await request.adminAudit.invitationResent(user);
          return reply.code(204).send(null);
        },
      );

      // Any of name, email, role, and active.
      authed.patch(
        "/companies/:id/users/:userId",
        {
          schema: {
            params: userParams,
            body: updateUserBody,
            response: { 200: companyUserSchema, ...errorResponses },
          },
        },
        async (request) => {
          const { before, after } = await users.updateUser(
            request.params.id,
            request.params.userId,
            request.body,
          );
          await request.adminAudit.userUpdated(before, after);
          return toCompanyUser(after);
        },
      );

      authed.delete(
        "/companies/:id/users/:userId",
        { schema: { params: userParams, response: noContent } },
        async (request, reply) => {
          const user = await users.deleteUser(request.params.id, request.params.userId);
          await request.adminAudit.userDeleted(user);
          return reply.code(204).send(null);
        },
      );
    }),
  );
}
