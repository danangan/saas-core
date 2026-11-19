import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, type PrismaClient } from "@saas-core/shared/db";
import { FailureLimiter } from "../../libs/rate-limit";
import { dbConnectors, type DBConnectors } from "@saas-core/shared/db/test-helpers";
import { startTestDatabase, type TestDatabase } from "@saas-core/shared/db/test-helpers";
import { EmailService, type EmailMessage, type EmailTransport } from "../email/email";
import {
  AuthenticationError,
  InvalidInputError,
  NotFoundError,
  TooManyAttemptsError,
} from "../../libs/errors";
import { SessionService } from "../session/session";
import { AuthService } from "./auth";

class FakeTransport implements EmailTransport {
  sent: EmailMessage[] = [];
  async send(message: EmailMessage) {
    this.sent.push(message);
  }
}

/** The token in an email's link (sign-up or password reset). */
const linkToken = (message: EmailMessage) =>
  new URL(/https?:\/\/\S+/.exec(message.text)![0]).searchParams.get("token")!;

describe("AuthService (integration)", () => {
  const run = randomUUID().slice(0, 8);
  const mailer = new FakeTransport();
  let pg: TestDatabase;
  let db: PrismaClient;
  let sessions: SessionService;
  let fixtures: DBConnectors;
  let auth: AuthService;

  beforeAll(async () => {
    pg = await startTestDatabase();
    db = createPrismaClient(pg.url);
    sessions = new SessionService(db);
    fixtures = dbConnectors(db);
    const email = new EmailService(mailer, "test@saas-core.local");
    auth = new AuthService(
      db,
      sessions,
      email,
      new FailureLimiter({ maxFailures: 3, windowMs: 60_000 }),
      new FailureLimiter({ maxFailures: 2, windowMs: 60_000 }),
      "http://localhost:3000",
    );
  });

  afterAll(async () => {
    await db?.$disconnect();
    await pg?.stop();
  });

  /** A signed-up user ("Uma Tester") in a company of its own, with their credentials. */
  async function signedUpUser(label: string, { isActive = true } = {}) {
    const company = await fixtures.companies.createCompany(label, { isActive });
    const user = await fixtures.users.createUser(company, "Uma", { password: "user-long-password" });
    return { company, user, email: user.email, password: user.password };
  }

  describe("admins", () => {
    it("authenticates and rate limits by username", async () => {
      const username = `test-admin2-${run}`;
      const { admin } = await auth.createOrResetAdmin(username, "a-long-password");

      expect((await auth.authenticateAdmin(username, "a-long-password")).id).toBe(admin.id);
      await expect(auth.authenticateAdmin(username, "wrong")).rejects.toBeInstanceOf(
        AuthenticationError,
      );
      await expect(auth.authenticateAdmin(username, "wrong")).rejects.toBeInstanceOf(
        AuthenticationError,
      );
      await expect(auth.authenticateAdmin(username, "a-long-password")).rejects.toBeInstanceOf(
        TooManyAttemptsError,
      );
    });

    it("returns the signed-in admin by id", async () => {
      const username = `test-admin4-${run}`;
      const { admin } = await auth.createOrResetAdmin(username, "a-long-password");
      expect(await auth.getAdmin({ adminId: admin.id })).toEqual({ id: admin.id, username });
      await expect(auth.getAdmin({ adminId: "missing" })).rejects.toBeInstanceOf(NotFoundError);
    });

    it("rejects short passwords", async () => {
      await expect(auth.createOrResetAdmin(`test-admin3-${run}`, "short")).rejects.toBeInstanceOf(
        InvalidInputError,
      );
    });
  });

  describe("users", () => {
    it("signs in with a password", async () => {
      const { company, email, password } = await signedUpUser("Login");
      const { token, me } = await auth.loginUser({ slug: company.slug, email, password });
      expect(me.user.email).toBe(email);
      expect(me.company.slug).toBe(company.slug);
      expect(await sessions.validateUserSession(token)).not.toBeNull();
    });

    it("rejects wrong passwords generically and rate limits", async () => {
      const { company, email } = await signedUpUser("Wrong pw");
      for (let i = 0; i < 3; i++) {
        await expect(
          auth.loginUser({ slug: company.slug, email, password: "nope" }),
        ).rejects.toBeInstanceOf(AuthenticationError);
      }
      await expect(
        auth.loginUser({ slug: company.slug, email, password: "nope" }),
      ).rejects.toBeInstanceOf(TooManyAttemptsError);
      await expect(
        auth.loginUser({ slug: company.slug, email: `missing-${run}@x.test`, password: "nope" }),
      ).rejects.toBeInstanceOf(AuthenticationError);
    });

    it("rejects invited users who have no password yet, and users of inactive companies", async () => {
      const company = await fixtures.companies.createCompany("No pw");
      const { user: invited } = await fixtures.users.createInvitedUser(company);
      await expect(
        auth.loginUser({ slug: company.slug, email: invited.email, password: "anything" }),
      ).rejects.toBeInstanceOf(AuthenticationError);

      const inactive = await signedUpUser("Inactive co", { isActive: false });
      await expect(
        auth.loginUser({
          slug: inactive.company.slug,
          email: inactive.email,
          password: inactive.password,
        }),
      ).rejects.toBeInstanceOf(AuthenticationError);
    });

    it("returns the signed-in user and their company, only within that company", async () => {
      const { company, user, email } = await signedUpUser("Me");
      const { session } = await fixtures.sessions.createUserSession(user);
      const me = await auth.getMe({
        userId: user.id,
        companyId: company.id,
        sessionId: session.id,
      });
      expect(me).toEqual({
        user: { id: user.id, firstName: "Uma", lastName: "Tester", email, role: "member" },
        company: { id: company.id, name: company.name, slug: company.slug },
        permissions: [],
      });
      const other = await fixtures.companies.createCompany("Not mine");
      await expect(
        auth.getMe({ userId: user.id, companyId: other.id, sessionId: session.id }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("records when the user last signed in", async () => {
      const { company, email, password } = await signedUpUser("Last sign-in");
      expect((await db.user.findFirstOrThrow({ where: { email } })).lastSignInAt).toBeNull();
      const before = Date.now();
      await auth.loginUser({ slug: company.slug, email, password });
      const { lastSignInAt } = await db.user.findFirstOrThrow({ where: { email } });
      expect(lastSignInAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    });

    it("lets the user change their own name", async () => {
      const { company, user, email } = await signedUpUser("Profile");
      const me = await auth.updateProfile(
        { userId: user.id, companyId: company.id },
        { firstName: "Una", lastName: "Renamed" },
      );
      expect(me.user).toMatchObject({ firstName: "Una", lastName: "Renamed", email });
    });

    it("changes the password and signs out other sessions only", async () => {
      const { company, user, email, password } = await signedUpUser("Change pw");
      const a = await fixtures.sessions.createUserSession(user);
      const b = await fixtures.sessions.createUserSession(user);
      const current = { userId: user.id, companyId: company.id, sessionId: a.session.id };

      await expect(
        auth.changePassword(current, { currentPassword: "wrong", newPassword: "another-long-pw" }),
      ).rejects.toBeInstanceOf(InvalidInputError);
      await auth.changePassword(current, {
        currentPassword: password,
        newPassword: "another-long-pw",
      });
      expect(await sessions.validateUserSession(a.token)).not.toBeNull();
      expect(await sessions.validateUserSession(b.token)).toBeNull();
      await expect(
        auth.loginUser({ slug: company.slug, email, password: "another-long-pw" }),
      ).resolves.toBeTruthy();
    });
  });

  describe("password reset", () => {
    it("emails a link only for real accounts and resets once, signing out everywhere", async () => {
      const { company, user, email } = await signedUpUser("Reset");
      const before = mailer.sent.length;
      await auth.requestPasswordReset(company.slug, `nobody-${run}@x.test`);
      expect(mailer.sent.length).toBe(before);

      await auth.requestPasswordReset(company.slug, email);
      expect(mailer.sent.length).toBe(before + 1);
      // Cooldown: an immediate second request sends nothing.
      await auth.requestPasswordReset(company.slug, email);
      expect(mailer.sent.length).toBe(before + 1);

      const token = linkToken(mailer.sent.at(-1)!);
      const s = await fixtures.sessions.createUserSession(user);

      expect(await auth.resetPassword(token, "reset-long-password")).toEqual({
        companySlug: company.slug,
      });
      expect(await sessions.validateUserSession(s.token)).toBeNull();
      await expect(auth.resetPassword(token, "again-long-password")).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });
});
