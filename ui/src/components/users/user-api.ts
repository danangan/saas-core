import type {
  BulkInviteBody,
  BulkInviteResult,
  CompanyUser,
  NewUserBody,
  UserRole,
} from "@/lib/api/types";
import { browserAdminApiClient, type UserChanges } from "@/lib/api/admin-browser-client";
import { browserApiClient } from "@/lib/api/browser-client";
import type { ApiResult } from "@/lib/api/http";

/**
 * Whose users a page manages: a platform admin managing any company (the admin pages),
 * or a company admin managing their own team (the Team page). Plain data, so a server
 * page can pass it to the client components below.
 */
export type UserScope = { kind: "admin"; companyId: string } | { kind: "team" };

/** The same user operations, through the admin API or the team API. */
export type UserApi = {
  createUser(user: NewUserBody): Promise<ApiResult<CompanyUser>>;
  bulkInvite(input: BulkInviteBody): Promise<ApiResult<BulkInviteResult>>;
  resendInvitation(userId: string): Promise<ApiResult<unknown>>;
  updateUser(userId: string, changes: UserChanges): Promise<ApiResult<CompanyUser>>;
  deleteUser(userId: string): Promise<ApiResult<unknown>>;
  renameCompany(name: string): Promise<ApiResult<unknown>>;
  /** Where to go when the session has expired. */
  loginPath: string;
};

export function userApi(scope: UserScope): UserApi {
  if (scope.kind === "admin") {
    const { companyId } = scope;
    const api = browserAdminApiClient;
    return {
      createUser: (user) => api.createUser(companyId, user),
      bulkInvite: (input) => api.bulkInvite(companyId, input),
      resendInvitation: (userId) => api.resendInvitation(companyId, userId),
      updateUser: (userId, changes) => api.updateUser(companyId, userId, changes),
      deleteUser: (userId) => api.deleteUser(companyId, userId),
      renameCompany: (name) => api.renameCompany(companyId, { name }),
      loginPath: "/admin/login",
    };
  }
  const api = browserApiClient;
  return {
    createUser: (user) => api.createTeamUser(user),
    bulkInvite: (input) => api.bulkInviteTeam(input),
    resendInvitation: (userId) => api.resendTeamInvitation(userId),
    updateUser: (userId, changes) => api.updateTeamUser(userId, changes),
    deleteUser: (userId) => api.deleteTeamUser(userId),
    renameCompany: (name) => api.renameCompany({ name }),
    loginPath: "/login",
  };
}

export const ROLE_LABELS: Record<UserRole, string> = { admin: "Admin", member: "Member" };
