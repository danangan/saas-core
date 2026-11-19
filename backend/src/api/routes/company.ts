import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { UserAction } from "@saas-core/shared";
import { renameCompanyBody } from "../../schemas";
import { CompanyAudit } from "../../services";
import { errorResponses } from "../../libs/http/schema";
import type { RouteOptions } from "../app";

/** What a company admin's rename returns. */
const renamedCompanySchema = z.object({ id: z.string(), name: z.string(), slug: z.string() });

/**
 * The Company page: the signed-in user's company's details, mounted at /api/company
 * inside buildApp's signed-in user group. Every route needs company management
 * (UserAction.CompanyManagement). Activating, deactivating and plans stay with platform admins.
 */
export async function companyRoutes(fastify: FastifyInstance, { services, guard }: RouteOptions) {
  const app = fastify.withTypeProvider<ZodTypeProvider>();
  const { companies, audit } = services;

  await app.register(
    guard.withPermission(
      UserAction.CompanyManagement,
      (company) => {
        // Renames the company; its slug (in its sign-in address) stays the same.
        company.patch(
          "",
          { schema: { body: renameCompanyBody, response: { 200: renamedCompanySchema, ...errorResponses } } },
          async (request) => {
            const { user } = request.userSession;
            const { before, after } = await companies.updateCompany(request.context.companyId, {
              name: request.body.name,
            });
            await new CompanyAudit(audit, { type: "user", id: user.id, label: user.email }).companyUpdated(
              before,
              after,
            );
            return { id: after.id, name: after.name, slug: after.slug };
          },
        );
      },
      "Only your company's admins can change its details.",
    ),
  );
}
