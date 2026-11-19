import "server-only";
import { notFound } from "next/navigation";
import type { UserAction } from "@saas-core/shared";
import type { User } from "@/lib/api/types";
import { authGuard } from "./guard";

/**
 * Role-based access control for pages. The backend decides what each role may do (its
 * ROLE_PERMISSIONS) and sends the allowed actions with /me as `permissions`; this reads
 * them. The API's RBACGuard refuses the same actions either way.
 *
 * Call `requirePermission` at the top of an RBAC-protected page, as pages call authGuard.
 */
class RBACGuard {
  /** Whether `user`'s role allows `action` (also for hiding links and buttons). */
  can(user: { permissions: readonly string[] }, action: UserAction): boolean {
    return user.permissions.includes(action);
  }

  /**
   * The signed-in user, if their role allows `action`. Otherwise the page is a 404, so it
   * doesn't show users it isn't for that it exists; without a session, /login.
   */
  async requirePermission(action: UserAction): Promise<User> {
    const user = await authGuard.requireAuthenticatedUser();
    if (!this.can(user, action)) notFound();
    return user;
  }
}

export const rbacGuard = new RBACGuard();
