import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, type Company, type PrismaClient } from "@saas-core/shared/db";
import {
  dbConnectors,
  startTestDatabase,
  type DBConnectors,
  type TestDatabase,
} from "@saas-core/shared/db/test-helpers";
import { LimitReachedError } from "../../libs/errors";
import { EmailService, type EmailTransport } from "../email/email";
import { SessionService } from "../session/session";
import { UserService } from "../user/user";
import { PlanService } from "./plan";

const noEmail: EmailTransport = { send: async () => undefined };

describe("PlanService (integration)", () => {
  let pg: TestDatabase;
  let db: PrismaClient;
  let fixtures: DBConnectors;
  let plans: PlanService;
  let users: UserService;

  beforeAll(async () => {
    pg = await startTestDatabase();
    db = createPrismaClient(pg.url);
    fixtures = dbConnectors(db);
    plans = new PlanService(db);
    const sessions = new SessionService(db);
    users = new UserService(db, sessions, new EmailService(noEmail, "t@x.test"), plans, "http://x.test");
  });

  afterAll(async () => {
    await db?.$disconnect();
    await pg?.stop();
  });

  /** A company with `count` signed-up users. */
  async function companyWithUsers(label: string, count: number) {
    const company = await fixtures.companies.createCompany(label);
    for (let i = 0; i < count; i++) await fixtures.users.createUser(company, `user${i}`);
    return company;
  }

  const newUser = (company: Company, name: string) => ({
    companyId: company.id,
    firstName: name,
    lastName: "New",
    email: `${name.toLowerCase()}-${company.slug}@x.test`,
  });

  describe("limits", () => {
    it("starts on the free plan, and follows the plan unless an admin overrides it", async () => {
      const company = await fixtures.companies.createCompany("Plans");
      expect(await plans.getLimits(company.id)).toEqual({
        plan: "free",
        maxUsers: 5,
        overrides: { maxUsers: null },
        usage: { users: 0 },
      });

      const premium = await plans.updateLimits(company.id, { plan: "premium" });
      expect(premium.before.plan).toBe("free");
      expect(premium.after).toMatchObject({ plan: "premium", maxUsers: 20 });

      // An override wins over the plan; clearing it goes back to the plan's.
      await plans.updateLimits(company.id, { maxUsers: 3 });
      expect(await plans.getLimits(company.id)).toMatchObject({
        plan: "premium",
        maxUsers: 3,
        overrides: { maxUsers: 3 },
      });
      await plans.updateLimits(company.id, { maxUsers: null });
      expect(await plans.getLimits(company.id)).toMatchObject({ maxUsers: 20 });
    });

    it("counts users who can sign in or are invited", async () => {
      const company = await fixtures.companies.createCompany("Usage");
      await fixtures.users.createUser(company, "active");
      await fixtures.users.createInvitedUser(company, "invited");
      await fixtures.users.createUser(company, "gone", { isActive: false });

      expect((await plans.getLimits(company.id)).usage).toEqual({ users: 2 });
    });
  });

  describe("the user limit", () => {
    it("refuses a user beyond the limit, until the limit is raised", async () => {
      const company = await companyWithUsers("Full team", 5);
      await expect(users.addUser(newUser(company, "Sixth"))).rejects.toThrow(
        "Your company has reached its limit of 5 users.",
      );
      await expect(users.addUser(newUser(company, "Sixth"))).rejects.toBeInstanceOf(LimitReachedError);

      await plans.updateLimits(company.id, { maxUsers: 6 });
      await expect(users.addUser(newUser(company, "Sixth"))).resolves.toMatchObject({ status: "invited" });
    });

    it("invites a pasted list until the limit, and says who didn't fit", async () => {
      const company = await companyWithUsers("Bulk team", 4);
      const entries = ["Ann", "Bob", "Cat"].map((name) => {
        const { firstName, lastName, email } = newUser(company, name);
        return { firstName, lastName, email };
      });
      const { results } = await users.bulkInvite(company.id, entries, "member");
      expect(results.map((r) => r.outcome)).toEqual(["invited", "limit_reached", "limit_reached"]);
      expect((await plans.getLimits(company.id)).usage.users).toBe(5);
    });

    it("refuses to reactivate a user when the company is full, but deactivating frees a place", async () => {
      const company = await companyWithUsers("Reactivate", 5);
      const away = await fixtures.users.createUser(company, "away", { isActive: false });
      await expect(users.setActive(company.id, away.id, true)).rejects.toBeInstanceOf(LimitReachedError);

      const [someone] = await db.user.findMany({ where: { companyId: company.id, isActive: true }, take: 1 });
      await users.setActive(company.id, someone.id, false);
      await expect(users.setActive(company.id, away.id, true)).resolves.toMatchObject({ status: "active" });
    });

    it("keeps everyone when an admin lowers the limit below the team's size, and adds no one", async () => {
      const company = await companyWithUsers("Shrunk team", 4);
      await plans.updateLimits(company.id, { maxUsers: 2 });
      const limits = await plans.getLimits(company.id);
      expect(limits).toMatchObject({ maxUsers: 2, usage: { users: 4 } });
      await expect(users.addUser(newUser(company, "Extra"))).rejects.toThrow(
        "Your company has 4 users, over its limit of 2 users.",
      );
    });
  });

});
