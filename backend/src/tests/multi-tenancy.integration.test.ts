import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { UserAction, USER_SESSION_COOKIE } from "@saas-core/shared";
import { buildApp } from "../api/app";
import { createContainer, type Container } from "../services/container";
import { loadConfig } from "../libs/config";
import type { Company } from "@saas-core/shared/db";
import { dbConnectors } from "@saas-core/shared/db/test-helpers";
import { startTestDatabase, type TestDatabase } from "@saas-core/shared/db/test-helpers";

// Who may use the team and company routes, over HTTP against a real database.
// Nothing here sends email.
describe("team and company routes (integration)", () => {
  let pg: TestDatabase;
  let container: Container;
  let app: FastifyInstance;
  let origin: string;

  beforeAll(async () => {
    pg = await startTestDatabase();
    const url = new URL(pg.url);
    const config = loadConfig({
      APP_URL: "http://localhost:3000",
      DB_HOST: url.hostname,
      DB_PORT: url.port,
      DB_NAME: url.pathname.slice(1),
      DB_USERNAME: decodeURIComponent(url.username),
      DB_PASSWORD: decodeURIComponent(url.password),
      SMTP_HOST: "127.0.0.1",
    });
    origin = config.appOrigin;
    container = createContainer(config);
    app = await buildApp({
      services: container.services,
      appOrigin: origin,
      cookieSecure: false,
      logger: false,
    });
  });

  afterAll(async () => {
    await app?.close();
    await container?.close();
    await pg?.stop();
  });

  /** A signed-up user with a session; returns the cookie header to send. */
  async function signedIn(company: Company, label: string, role: "admin" | "member") {
    const fixtures = dbConnectors(container.db);
    const user = await fixtures.users.createUser(company, label, { role });
    const { token } = await fixtures.sessions.createUserSession(user);
    return { user, headers: { cookie: `${USER_SESSION_COOKIE}=${token}`, origin } };
  }

  const company = (label: string) => dbConnectors(container.db).companies.createCompany(label);

  it("lets only company admins use the team routes", async () => {
    const acme = await company("acme");
    const admin = await signedIn(acme, "admin", "admin");
    const member = await signedIn(acme, "member", "member");

    const asMember = await app.inject({
      method: "GET",
      url: "/api/team",
      headers: member.headers,
    });
    expect(asMember.statusCode).toBe(403);
    const asAdmin = await app.inject({
      method: "GET",
      url: "/api/team",
      headers: admin.headers,
    });
    expect(asAdmin.statusCode).toBe(200);
    expect(
      asAdmin
        .json()
        .map((u: { email: string }) => u.email)
        .sort(),
    ).toEqual([admin.user.email, member.user.email].sort());
  });

  it("gives each role its permissions", async () => {
    const acme = await company("rbac");
    const admin = await signedIn(acme, "rbac-admin", "admin");
    const member = await signedIn(acme, "rbac-member", "member");

    const me = async (headers: Record<string, string>) =>
      (await app.inject({ method: "GET", url: "/api/settings/me", headers })).json().permissions;
    expect(await me(admin.headers)).toEqual([UserAction.TeamManagement, UserAction.CompanyManagement]);
    expect(await me(member.headers)).toEqual([]);
  });

  it("lets a company admin change others but not themselves, and logs it", async () => {
    const acme = await company("self");
    const admin = await signedIn(acme, "boss", "admin");
    const member = await signedIn(acme, "worker", "member");

    const self = await app.inject({
      method: "PATCH",
      url: `/api/team/users/${admin.user.id}`,
      headers: admin.headers,
      payload: { role: "member" },
    });
    expect(self.statusCode).toBe(400);

    const promote = await app.inject({
      method: "PATCH",
      url: `/api/team/users/${member.user.id}`,
      headers: admin.headers,
      payload: { role: "admin", firstName: "Promoted" },
    });
    expect(promote.statusCode).toBe(200);
    expect(promote.json()).toMatchObject({ role: "admin", firstName: "Promoted" });

    const activity = await app.inject({
      method: "GET",
      url: "/api/team/activity",
      headers: admin.headers,
    });
    expect(
      activity
        .json()
        .map((e: { action: string }) => e.action)
        .sort(),
    ).toEqual(["user.role_changed", "user.updated"]);
    expect(activity.json()[0]).toMatchObject({
      actorType: "user",
      actorLabel: admin.user.email,
      targetLabel: member.user.email,
    });
  });

  it("keeps a company admin inside their own company", async () => {
    const mine = await company("mine");
    const theirs = await company("theirs");
    const admin = await signedIn(mine, "mine-admin", "admin");
    const outsider = await signedIn(theirs, "outsider", "member");

    const res = await app.inject({
      method: "PATCH",
      url: `/api/team/users/${outsider.user.id}`,
      headers: admin.headers,
      payload: { isActive: false },
    });
    expect(res.statusCode).toBe(404);
    expect(
      (await container.db.user.findUniqueOrThrow({ where: { id: outsider.user.id } })).isActive,
    ).toBe(true);
  });

  it("renames the company for its admins, keeping the slug", async () => {
    const acme = await company("rename");
    const admin = await signedIn(acme, "renamer", "admin");
    const res = await app.inject({
      method: "PATCH",
      url: "/api/company",
      headers: admin.headers,
      payload: { name: "Acme Renamed" },
    });
    expect(res.json()).toEqual({ id: acme.id, name: "Acme Renamed", slug: acme.slug });

    // Members can't change the company's details.
    const member = await signedIn(acme, "not-a-renamer", "member");
    const denied = await app.inject({
      method: "PATCH",
      url: "/api/company",
      headers: member.headers,
      payload: { name: "Member Renamed" },
    });
    expect(denied.statusCode).toBe(403);
  });

  it("lets a user edit their own name", async () => {
    const acme = await company("profile");
    const member = await signedIn(acme, "named", "member");
    const res = await app.inject({
      method: "PATCH",
      url: "/api/settings/profile",
      headers: member.headers,
      payload: { firstName: "New", lastName: "Name" },
    });
    expect(res.json().user).toMatchObject({ firstName: "New", lastName: "Name", role: "member" });
  });

});
