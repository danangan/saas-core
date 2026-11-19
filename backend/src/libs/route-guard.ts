import type {
  FastifyBaseLogger,
  FastifyInstance,
  FastifyPluginAsync,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ADMIN_SESSION_COOKIE, USER_ACTIONS, USER_SESSION_COOKIE, type UserAction } from "@saas-core/shared";
import type { UserRole } from "@saas-core/shared/db";
import { ROLE_PERMISSIONS, type AccessEffect } from "../constants";
import type {
  AdminContext,
  AdminSession,
  SessionService,
  TeamContext,
  UserSession,
} from "../services/session/session";
import { HttpError } from "./errors";

/** A Fastify instance whose routes are typed by their zod schemas, as every route file uses. */
export type ZodFastifyInstance = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>;

/** A role → permissions policy, as ROLE_PERMISSIONS in constants.ts. */
export type RolePolicy = Record<UserRole, Partial<Record<UserAction, AccessEffect>>>;

/**
 * Whether `role` may do `action` under `policy` (by default the hard-coded ROLE_PERMISSIONS).
 * Deny by default: allowed only when the role's entry says "ALLOW".
 */
export function isAllowed(role: UserRole, action: UserAction, policy: RolePolicy = ROLE_PERMISSIONS): boolean {
  return policy[role]?.[action] === "ALLOW";
}

/** Every action `role` may do, in USER_ACTIONS order: what /me sends the UI. */
export function allowedActions(role: UserRole, policy: RolePolicy = ROLE_PERMISSIONS): UserAction[] {
  return USER_ACTIONS.filter((action) => isAllowed(role, action, policy));
}

/** The routes of a guarded group, declared on the group's (zod-typed) Fastify instance. */
type GuardedRoutes = (app: ZodFastifyInstance) => void | Promise<void>;

/**
 * The guards for the routes in src/api/routes: who must be signed in, and what their role
 * must allow. Each one is a group of routes, registered as a plugin:
 *
 *   await app.register(guard.withAuthenticatedUser((app) => { app.get(…); … }));
 *
 * Every route declared (or registered) in the group is guarded, and only those: Fastify
 * keeps a plugin's hooks to its own routes. Groups nest, and an outer group's guard runs
 * first (a permission group inside a user group).
 *
 * - `withAuthenticatedUser(routes)` / `withAuthenticatedAdmin(routes)`: a session is
 *   required, checked on request so one without is refused (401) before its body is read.
 * - `withPermission(action, routes)`: the signed-in user's role must allow `action` (403),
 *   checked before the body is read, so a refused upload isn't received.
 */
export class RouteGuard {
  constructor(
    private readonly sessions: SessionService,
    private readonly policy: RolePolicy = ROLE_PERMISSIONS,
  ) {}

  /** Signed-in users (the session cookie): sets request.context and request.userSession. */
  withAuthenticatedUser(routes: GuardedRoutes): FastifyPluginAsync {
    return async (fastify) => {
      const app = fastify.withTypeProvider<ZodTypeProvider>();
      app.decorateRequest("context", null as unknown as TeamContext);
      app.decorateRequest("userSession", null as unknown as UserSession);
      app.addHook("onRequest", async (request) => {
        const session = await this.sessions.validateUserSession(request.cookies[USER_SESSION_COOKIE]);
        if (!session) throw new HttpError(401, "Sign in required.");
        request.userSession = session;
        request.context = {
          userId: session.user.id,
          companyId: session.company.id,
          sessionId: session.session.id,
          role: session.user.role,
        };
      });
      await routes(app);
    };
  }

  /** Signed-in platform admins (the admin session cookie): sets request.adminContext and request.adminSession. */
  withAuthenticatedAdmin(routes: GuardedRoutes): FastifyPluginAsync {
    return async (fastify) => {
      const app = fastify.withTypeProvider<ZodTypeProvider>();
      app.decorateRequest("adminContext", null as unknown as AdminContext);
      app.decorateRequest("adminSession", null as unknown as AdminSession);
      app.addHook("onRequest", async (request) => {
        const session = await this.sessions.validateAdminSession(request.cookies[ADMIN_SESSION_COOKIE]);
        if (!session) throw new HttpError(401, "Sign in required.");
        request.adminSession = session;
        request.adminContext = { adminId: session.admin.id };
      });
      await routes(app);
    };
  }

  /**
   * RBAC: routes whose user's role must allow `action` (ROLE_PERMISSIONS). Goes inside a
   * withAuthenticatedUser group; register it without a prefix to keep the parent's paths.
   */
  withPermission(
    action: UserAction,
    routes: GuardedRoutes,
    message = "Only your company's admins can do this.",
  ): FastifyPluginAsync {
    return async (fastify) => {
      const app = fastify.withTypeProvider<ZodTypeProvider>();
      app.addHook("preHandler", async (request) => {
        if (!isAllowed(request.context.role, action, this.policy)) throw new HttpError(403, message);
      });
      await routes(app);
    };
  }
}
