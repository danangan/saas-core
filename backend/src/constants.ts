// Constants only the backend uses. Ones the UI or e2e also need are in @saas-core/shared.

import { UserAction } from "@saas-core/shared";
import type { UserRole } from "@saas-core/shared/db";

// --- Access control (RBAC) ---------------------------------------------------------

export type AccessEffect = "ALLOW" | "DENY";

/**
 * What each role may do, hard-coded for now (libs/route-guard.ts enforces it). An action a role
 * doesn't list is denied.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Partial<Record<UserAction, AccessEffect>>> = {
  admin: {
    [UserAction.TeamManagement]: "ALLOW",
    [UserAction.CompanyManagement]: "ALLOW",
  },
  member: {
    [UserAction.TeamManagement]: "DENY",
    [UserAction.CompanyManagement]: "DENY",
  },
};
