import cookie from "@fastify/cookie";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { USER_ACTIONS, USER_SESSION_COOKIE, UserAction } from "@saas-core/shared";
import type { SessionService } from "../services/session/session";
import { errorHandler } from "./errors";
import { RouteGuard, allowedActions, isAllowed } from "./route-guard";

/** Sessions that know one user token ("member-token" or "admin-token", by role) and no admins. */
const sessions = {
  validateUserSession: async (token?: string) => {
    const role = token?.replace(/-token$/, "");
    if (role !== "admin" && role !== "member") return null;
    return {
      session: { id: `s-${role}` },
      user: { id: `u-${role}`, companyId: "c1", firstName: "A", lastName: "B", email: "a@x.test", role },
      company: { id: "c1", name: "C", slug: "c" },
    };
  },
  validateAdminSession: async () => null,
} as unknown as SessionService;

/** An app with an open route, a signed-in route, a permission-guarded route and an admin route. */
async function buildTestApp() {
  const guard = new RouteGuard(sessions);
  const app = Fastify();
  await app.register(cookie);
  app.setErrorHandler(errorHandler);
  app.get("/open", async () => "open");
  await app.register(
    guard.withAuthenticatedUser(async (user) => {
      user.get("/me", async (request) => request.context);
      await user.register(
        guard.withPermission(UserAction.TeamManagement, (managed) => {
          managed.get("/managed", async () => "managed");
        }),
      );
    }),
  );
  await app.register(
    guard.withAuthenticatedAdmin((admin) => {
      admin.get("/admin", async () => "admin");
    }),
  );
  return app;
}

describe("route guard", () => {
  it("lets admins manage the team and the company, and members not", () => {
    expect(allowedActions("admin")).toEqual([...USER_ACTIONS]);
    expect(allowedActions("member")).toEqual([]);
    expect(isAllowed("admin", UserAction.TeamManagement)).toBe(true);
    expect(isAllowed("member", UserAction.TeamManagement)).toBe(false);
  });

  it("denies an action the policy doesn't list or explicitly denies", () => {
    const policy = { admin: { [UserAction.TeamManagement]: "DENY" as const }, member: {} };
    expect(isAllowed("admin", UserAction.TeamManagement, policy)).toBe(false);
    expect(isAllowed("admin", UserAction.CompanyManagement, policy)).toBe(false);
    expect(allowedActions("member", policy)).toEqual([]);
  });

  it("guards only the routes inside each group", async () => {
    const app = await buildTestApp();
    const status = async (url: string, token?: string) =>
      (await app.inject({ url, cookies: token ? { [USER_SESSION_COOKIE]: token } : {} })).statusCode;

    expect(await status("/open")).toBe(200);
    // withAuthenticatedUser: 401 without a session, request.context with one.
    expect(await status("/me")).toBe(401);
    const me = await app.inject({ url: "/me", cookies: { [USER_SESSION_COOKIE]: "member-token" } });
    expect(me.json()).toMatchObject({ userId: "u-member", companyId: "c1", role: "member" });
    // withPermission inside it: 401 first, then 403 for a role without the action.
    expect(await status("/managed")).toBe(401);
    expect(await status("/managed", "member-token")).toBe(403);
    expect(await status("/managed", "admin-token")).toBe(200);
    // withAuthenticatedAdmin: a user session isn't an admin session.
    expect(await status("/admin", "admin-token")).toBe(401);
    await app.close();
  });
});
