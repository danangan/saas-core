import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { UserAction } from "@saas-core/shared";
import {
  auditEntrySchema,
  bulkInviteBody,
  bulkInviteResultSchema,
  companyUserSchema,
  newUserBody,
  updateUserBody,
} from "../../schemas";
import { CompanyAudit, type TeamActor } from "../../services";
import { DeliveryFailedError } from "../../libs/errors";
import { errorResponses, noContent } from "../../libs/http/schema";
import type { RouteOptions } from "../app";
import { toAuditEntry, toCompanyUser } from "../../libs/http/mappers";

const userParams = z.object({ userId: z.string().min(1) });

/**
 * The Team page: a company's users and its activity, mounted at /api/team inside
 * buildApp's signed-in user group. Every route needs team management (UserAction.TeamManagement).
 */
export async function teamRoutes(fastify: FastifyInstance, { services, guard }: RouteOptions) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const { users, audit } = services;

  // Who's acting, for invitations, the self-change guard and the audit log. Runs after
  // the user guard; the permission check below follows, before the handler.
  app.decorateRequest("teamActor", null as unknown as TeamActor);
  app.decorateRequest("teamAudit", null as unknown as CompanyAudit);
  app.addHook("onRequest", async (request) => {
    const { user } = request.userSession;
    request.teamActor = { userId: user.id, name: `${user.firstName} ${user.lastName}`.trim() };
    request.teamAudit = new CompanyAudit(audit, { type: "user", id: user.id, label: user.email });
  });

  // Every route here needs team management.
  await app.register(
    guard.withPermission(
      UserAction.TeamManagement,
      (team) => {
        team.get(
          "",
          { schema: { response: { 200: z.array(companyUserSchema), ...errorResponses } } },
          async (request) => (await users.listUsers(request.context.companyId)).map(toCompanyUser),
        );

        team.get(
          "/activity",
          { schema: { response: { 200: z.array(auditEntrySchema), ...errorResponses } } },
          async (request) => (await audit.listForCompany(request.context.companyId)).map(toAuditEntry),
        );

        team.post(
          "/users",
          { schema: { body: newUserBody, response: { 201: companyUserSchema, ...errorResponses } } },
          async (request, reply) => {
            const body = request.body;
            const { companyId } = request.context;
            try {
              const user = await users.addUser({ companyId, ...body }, request.teamActor);
              await request.teamAudit.userInvited(user);
              return reply.code(201).send(toCompanyUser(user));
            } catch (error) {
              if (error instanceof DeliveryFailedError) {
                await request.teamAudit.userInvited(await users.getUserByEmail(companyId, body.email));
              }
              throw error;
            }
          },
        );

        team.post(
          "/users/bulk",
          {
            schema: {
              body: bulkInviteBody,
              response: { 200: bulkInviteResultSchema, ...errorResponses },
            },
          },
          async (request) => {
            const { users: entries, role } = request.body;
            const { companyId } = request.context;
            const { results, invited } = await users.bulkInvite(
              companyId,
              entries,
              role,
              request.teamActor,
            );
            await request.teamAudit.usersInvited(companyId, results, invited);
            return results;
          },
        );

        team.post(
          "/users/:userId/resend-invitation",
          { schema: { params: userParams, response: noContent } },
          async (request, reply) => {
            const user = await users.resendInvitation(
              request.context.companyId,
              request.params.userId,
              request.teamActor,
            );
            await request.teamAudit.invitationResent(user);
            return reply.code(204).send(null);
          },
        );

        team.patch(
          "/users/:userId",
          {
            schema: {
              params: userParams,
              body: updateUserBody,
              response: { 200: companyUserSchema, ...errorResponses },
            },
          },
          async (request) => {
            const { before, after } = await users.updateUser(
              request.context.companyId,
              request.params.userId,
              request.body,
              request.teamActor,
            );
            await request.teamAudit.userUpdated(before, after);
            return toCompanyUser(after);
          },
        );

        team.delete(
          "/users/:userId",
          { schema: { params: userParams, response: noContent } },
          async (request, reply) => {
            const user = await users.deleteUser(
              request.context.companyId,
              request.params.userId,
              request.teamActor,
            );
            await request.teamAudit.userDeleted(user);
            return reply.code(204).send(null);
          },
        );
      },
      "Only your company's admins can manage the team.",
    ),
  );
}
