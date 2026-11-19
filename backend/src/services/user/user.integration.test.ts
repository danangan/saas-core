import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, type PrismaClient } from "@saas-core/shared/db";
import { dbConnectors, type DBConnectors } from "@saas-core/shared/db/test-helpers";
import { startTestDatabase, type TestDatabase } from "@saas-core/shared/db/test-helpers";
import { EmailService, type EmailMessage, type EmailTransport } from "../email/email";
import {
  ConflictError,
  DeliveryFailedError,
  InvalidInputError,
  NotFoundError,
} from "../../libs/errors";
import { SessionService } from "../session/session";
import { UserService } from "./user";
import { PlanService } from "../plan/plan";

class FakeTransport implements EmailTransport {
  sent: EmailMessage[] = [];
  failNext = false;
  async send(message: EmailMessage) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("SMTP down");
    }
    this.sent.push(message);
  }
}

/** The token in an email's link (sign-up or password reset). */
const linkToken = (message: EmailMessage) =>
  new URL(/https?:\/\/\S+/.exec(message.text)![0]).searchParams.get("token")!;

describe("UserService (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const mailer = new FakeTransport();
  let pg: TestDatabase;
  let db: PrismaClient;
  let sessions: SessionService;
  let fixtures: DBConnectors;
  let users: UserService;

  beforeAll(async () => {
    pg = await startTestDatabase();
    db = createPrismaClient(pg.url);
    sessions = new SessionService(db);
    users = new UserService(
      db,
      sessions,
      new EmailService(mailer, "test@saas-core.local"),
      new PlanService(db),
      "http://localhost:3000",
    );
    fixtures = dbConnectors(db);
  });

  afterAll(async () => {
    await db?.$disconnect();
    await pg?.stop();
  });

  describe("users", () => {
    it("adds an invited user and emails a sign-up link", async () => {
      const company = await fixtures.companies.createCompany("Users");
      const email = `ann-${run}@x.test`;
      const user = await users.addUser({
        companyId: company.id,
        firstName: "Ann",
        lastName: "Lee",
        email,
      });
      expect(user.status).toBe("invited");
      expect(user).not.toHaveProperty("password");
      expect(mailer.sent.at(-1)?.to).toBe(email);
      expect(mailer.sent.at(-1)?.text).toMatch(/\/signup\?token=/);

      await expect(
        users.addUser({ companyId: company.id, firstName: "Ann", lastName: "Again", email }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("keeps the user when the invitation email fails", async () => {
      const company = await fixtures.companies.createCompany("Mail fail");
      mailer.failNext = true;
      const email = `bob-${run}@x.test`;
      await expect(
        users.addUser({ companyId: company.id, firstName: "Bob", lastName: "B", email }),
      ).rejects.toBeInstanceOf(DeliveryFailedError);
      expect(await db.user.count({ where: { companyId: company.id, email } })).toBe(1);
    });

    it("rejects adding a user to a missing company", async () => {
      await expect(
        users.addUser({
          companyId: "missing",
          firstName: "A",
          lastName: "B",
          email: `c-${run}@x.test`,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("resends only pending invitations, keeping one active invitation", async () => {
      const company = await fixtures.companies.createCompany("Resend");
      const { user } = await fixtures.users.createInvitedUser(company);
      await users.resendInvitation(company.id, user.id);
      expect(await db.invitation.count({ where: { userId: user.id } })).toBe(1);

      const signedUp = await fixtures.users.createUser(company);
      await expect(users.resendInvitation(company.id, signedUp.id)).rejects.toBeInstanceOf(
        ConflictError,
      );
    });

    it("deactivating signs the user out; deleting removes them", async () => {
      const company = await fixtures.companies.createCompany("Deact user");
      const user = await fixtures.users.createUser(company);
      await fixtures.sessions.createUserSession(user);

      expect((await users.setActive(company.id, user.id, false)).status).toBe("deactivated");
      expect(await db.session.count({ where: { userId: user.id } })).toBe(0);

      await users.deleteUser(company.id, user.id);
      await expect(users.deleteUser(company.id, user.id)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("never changes a user through another company", async () => {
      const company = await fixtures.companies.createCompany("Owner");
      const other = await fixtures.companies.createCompany("Other");
      const user = await fixtures.users.createInvitedUser(company).then((u) => u.user);
      await fixtures.sessions.createUserSession(user);

      await expect(users.setActive(other.id, user.id, false)).rejects.toBeInstanceOf(NotFoundError);
      await expect(users.resendInvitation(other.id, user.id)).rejects.toBeInstanceOf(NotFoundError);
      await expect(users.deleteUser(other.id, user.id)).rejects.toBeInstanceOf(NotFoundError);
      expect(await db.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({
        isActive: true,
      });
      expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
    });
  });

  describe("roles, edits and team management", () => {
    it("adds a user as a member by default, or as an admin", async () => {
      const company = await fixtures.companies.createCompany("Roles");
      const member = await users.addUser({
        companyId: company.id,
        firstName: "M",
        lastName: "M",
        email: `m-${run}@x.test`,
      });
      const admin = await users.addUser({
        companyId: company.id,
        firstName: "A",
        lastName: "A",
        email: `a-${run}@x.test`,
        role: "admin",
      });
      expect(member.role).toBe("member");
      expect(admin.role).toBe("admin");
    });

    it("shows an invited user's pending invitation, and none once they've signed up", async () => {
      const company = await fixtures.companies.createCompany("Pending");
      const user = await users.addUser({
        companyId: company.id,
        firstName: "P",
        lastName: "P",
        email: `p-${run}@x.test`,
      });
      expect(user.invitation).not.toBeNull();
      expect(user.invitation!.expiresAt.getTime() - user.invitation!.sentAt.getTime()).toBeCloseTo(
        7 * 24 * 3600 * 1000,
        -4,
      );
      expect(user.lastSignInAt).toBeNull();

      await users.acceptInvitation(linkToken(mailer.sent.at(-1)!), "p-long-password");
      expect((await users.getUser(company.id, user.id)).invitation).toBeNull();
    });

    it("updates name, email and role, and refuses an email already in the company", async () => {
      const company = await fixtures.companies.createCompany("Edit");
      const user = await fixtures.users.createUser(company, "Old");
      const taken = await fixtures.users.createUser(company, "Taken");

      const { before, after } = await users.updateUser(company.id, user.id, {
        firstName: "New",
        email: `new-${run}@x.test`,
        role: "admin",
      });
      expect(before).toMatchObject({ firstName: "Old", role: "member" });
      expect(after).toMatchObject({
        firstName: "New",
        lastName: "Tester",
        email: `new-${run}@x.test`,
        role: "admin",
      });
      await expect(
        users.updateUser(company.id, user.id, { email: taken.email }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("never lets a company admin change, deactivate or delete their own account", async () => {
      const company = await fixtures.companies.createCompany("Self");
      const admin = await fixtures.users.createUser(company, "Self", { role: "admin" });
      const actor = { userId: admin.id, name: "Self Tester" };
      await expect(
        users.updateUser(company.id, admin.id, { role: "member" }, actor),
      ).rejects.toBeInstanceOf(InvalidInputError);
      await expect(users.setActive(company.id, admin.id, false, actor)).rejects.toBeInstanceOf(
        InvalidInputError,
      );
      await expect(users.deleteUser(company.id, admin.id, actor)).rejects.toBeInstanceOf(
        InvalidInputError,
      );
      expect(await users.getUser(company.id, admin.id)).toMatchObject({
        role: "admin",
        status: "active",
      });
    });

    it("says who invited them when a company admin sends the invitation", async () => {
      const company = await fixtures.companies.createCompany("Invited by");
      await users.addUser(
        { companyId: company.id, firstName: "Iris", lastName: "I", email: `iris-${run}@x.test` },
        { userId: "someone", name: "Dana Admin" },
      );
      const email = mailer.sent.at(-1)!;
      expect(email.subject).toBe(`Dana Admin invited you to ${company.name} on SaaS Core`);
      expect(email.text).toContain("Dana Admin has invited you to join");
    });

    it("bulk-invites, skipping emails already in the company and keeping users whose email failed", async () => {
      const company = await fixtures.companies.createCompany("Bulk");
      const existing = await fixtures.users.createUser(company, "X");
      mailer.failNext = false;
      const entries = [
        { firstName: "One", lastName: "", email: `one-${run}@x.test` },
        { firstName: "X", lastName: "X", email: existing.email },
        { firstName: "Two", lastName: "T", email: `two-${run}@x.test` },
      ];
      // The second email delivery (for two-…) fails.
      const sent = mailer.sent.length;
      const original = mailer.send.bind(mailer);
      let deliveries = 0;
      mailer.send = async (message) => {
        deliveries += 1;
        if (deliveries === 2) throw new Error("SMTP down");
        return original(message);
      };
      try {
        const { results, invited } = await users.bulkInvite(company.id, entries, "member");
        expect(results).toEqual([
          { email: `one-${run}@x.test`, outcome: "invited" },
          { email: existing.email, outcome: "exists" },
          { email: `two-${run}@x.test`, outcome: "email_failed" },
        ]);
        expect(invited.map((u) => u.email)).toEqual([`one-${run}@x.test`, `two-${run}@x.test`]);
        expect(mailer.sent.length).toBe(sent + 1);
      } finally {
        mailer.send = original;
      }
      expect(await db.user.count({ where: { companyId: company.id } })).toBe(3);
    });
  });

  describe("invitations", () => {
    it("describes and accepts a valid invitation once", async () => {
      const company = await fixtures.companies.createCompany("Invite");
      const {
        user: { email },
        token,
      } = await fixtures.users.createInvitedUser(company, "Ivy");

      expect(await users.describeInvitation(token)).toMatchObject({
        email,
        firstName: "Ivy",
        companySlug: company.slug,
      });
      expect(await users.acceptInvitation(token, "ivy-long-password")).toEqual({
        companySlug: company.slug,
      });
      await expect(users.acceptInvitation(token, "ivy-long-password")).rejects.toBeInstanceOf(
        NotFoundError,
      );
      await expect(users.describeInvitation("not-a-token")).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
