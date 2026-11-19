import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { ADMIN_SESSION_COOKIE, USER_SESSION_COOKIE } from "@saas-core/shared";
import type { Company } from "@saas-core/shared/db";
import { dbConnectors, startTestDatabase, type TestDatabase } from "@saas-core/shared/db/test-helpers";
import { buildApp } from "../api/app";
import { loadConfig } from "../libs/config";
import { createContainer, type Container } from "../services/container";

// Plans and limits over HTTP, against a real database: platform admins change them, users
// see them, and invites past the user limit are refused.
describe("plans and limits (integration)", () => {
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
    app = await buildApp({ services: container.services, appOrigin: origin, cookieSecure: false, logger: false });
  });

  afterAll(async () => {
    await app?.close();
    await container?.close();
    await pg?.stop();
  });

  const fixtures = () => dbConnectors(container.db);

  async function asAdmin() {
    const admin = await fixtures().admins.createAdmin();
    const { token } = await fixtures().sessions.createAdminSession(admin);
    return { cookie: `${ADMIN_SESSION_COOKIE}=${token}`, origin };
  }

  async function asUser(company: Company, role: "admin" | "member" = "member") {
    const user = await fixtures().users.createUser(company, role, { role });
    const { token } = await fixtures().sessions.createUserSession(user);
    return { cookie: `${USER_SESSION_COOKIE}=${token}`, origin };
  }

  it("lets a platform admin change the plan and override its limits, and logs it", async () => {
    const headers = await asAdmin();
    const company = await fixtures().companies.createCompany("Plan change");

    const detail = await app.inject({ method: "GET", url: `/api/admin/companies/${company.id}`, headers });
    expect(detail.json()).toMatchObject({
      plan: "free",
      limits: { plan: "free", maxUsers: 5, usage: { users: 0 } },
    });

    const patch = await app.inject({
      method: "PATCH",
      url: `/api/admin/companies/${company.id}`,
      headers,
      payload: { plan: "premium", maxUsers: 8 },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().limits).toMatchObject({
      plan: "premium",
      maxUsers: 8,
      overrides: { maxUsers: 8 },
    });

    // null goes back to the plan's limit.
    const cleared = await app.inject({
      method: "PATCH",
      url: `/api/admin/companies/${company.id}`,
      headers,
      payload: { maxUsers: null },
    });
    expect(cleared.json().limits).toMatchObject({ maxUsers: 20, overrides: { maxUsers: null } });

    const activity = await app.inject({ method: "GET", url: `/api/admin/companies/${company.id}/activity`, headers });
    expect(activity.json().map((e: { action: string }) => e.action)).toEqual([
      "company.limits_changed",
      "company.limits_changed",
      "company.plan_changed",
    ]);
  });

  it("refuses a limit that makes no sense", async () => {
    const headers = await asAdmin();
    const company = await fixtures().companies.createCompany("Bad limits");
    const response = await app.inject({
      method: "PATCH",
      url: `/api/admin/companies/${company.id}`,
      headers,
      payload: { maxUsers: 0, plan: "gold" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().fieldErrors).toMatchObject({
      maxUsers: ["Allow at least 1 user."],
      plan: [expect.any(String)],
    });
  });

  it("shows any user their company's limits and usage", async () => {
    const company = await fixtures().companies.createCompany("Usage");
    const headers = await asUser(company);

    const response = await app.inject({ method: "GET", url: "/api/settings/limits", headers });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ plan: "free", maxUsers: 5, usage: { users: 1 } });
  });

  it("refuses a company admin's invite when the company is full", async () => {
    const company = await fixtures().companies.createCompany("Full");
    const headers = await asUser(company, "admin");
    await container.services.plans.updateLimits(company.id, { maxUsers: 1 });

    const response = await app.inject({
      method: "POST",
      url: "/api/team/users",
      headers,
      payload: { firstName: "New", lastName: "Person", email: "new@x.test" },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toContain("reached its limit of 1 user");
  });

  it("doesn't let a company admin change their plan", async () => {
    const company = await fixtures().companies.createCompany("No upgrade");
    const headers = await asUser(company, "admin");
    const response = await app.inject({
      method: "PATCH",
      url: "/api/company",
      headers,
      payload: { name: "Renamed", plan: "premium", maxUsers: 1000 },
    });
    expect(response.statusCode).toBe(200);
    expect(await container.services.plans.getLimits(company.id)).toMatchObject({ plan: "free", maxUsers: 5 });
  });
});
