import { PLAN_LIMITS, type PlanName } from "@saas-core/shared";
import type { Prisma, PrismaClient } from "@saas-core/shared/db";
import { LimitReachedError, NotFoundError } from "../../libs/errors";

type Db = PrismaClient | Prisma.TransactionClient;

/** A company's plan, its limits, and what it uses. */
export type CompanyLimitsDTO = {
  plan: PlanName;
  maxUsers: number;
  usage: { users: number };
};

/**
 * Each company's limits: users (who can sign in or are invited; deactivated users don't
 * count). Add a product's own limits (storage, seats, API calls) here. Adding a user checks
 * it inside its transaction, under a per-company lock, so two requests at once can't
 * both pass the check and go over. A company can be over a limit (an admin moved it to a smaller plan):
 * what it has stays, and no one more can be added until it's back under.
 */
export class PlanService {
  constructor(private readonly db: PrismaClient) {}

  async getLimits(companyId: string, db: Db = this.db): Promise<CompanyLimitsDTO> {
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { plan: true, deletedAt: true },
    });
    if (!company || company.deletedAt) throw new NotFoundError("Company not found.");
    const users = await db.user.count({ where: { companyId, isActive: true } });
    return { plan: company.plan, maxUsers: PLAN_LIMITS[company.plan].maxUsers, usage: { users } };
  }

  /** Changes a company's plan; returns its limits before and after. */
  async changePlan(
    companyId: string,
    plan: PlanName,
  ): Promise<{ before: CompanyLimitsDTO; after: CompanyLimitsDTO }> {
    const before = await this.getLimits(companyId);
    await this.db.company.update({ where: { id: companyId }, data: { plan } });
    return { before, after: await this.getLimits(companyId) };
  }

  /**
   * Serialises the company's additions (users) until the transaction ends.
   * Call it first in the transaction that checks a limit and then adds.
   */
  async lock(tx: Prisma.TransactionClient, companyId: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('company-limits'), hashtext(${companyId}))`;
  }

  /** Throws LimitReachedError unless `count` more users fit within the user limit. */
  async assertCanAddUsers(companyId: string, count: number, db: Db = this.db): Promise<void> {
    const { maxUsers, usage } = await this.getLimits(companyId, db);
    if (usage.users + count <= maxUsers) return;
    const limit = `${maxUsers} ${maxUsers === 1 ? "user" : "users"}`;
    throw new LimitReachedError(
      usage.users > maxUsers
        ? `Your company has ${usage.users} users, over its limit of ${limit}. Deactivate or delete users, or ask about a bigger plan, before adding more.`
        : `Your company has reached its limit of ${limit}. Deactivate or delete a user, or ask about a bigger plan, to add more.`,
    );
  }
}
