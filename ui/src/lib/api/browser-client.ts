import type { UserChanges } from "./admin-browser-client";
import { call, createApiClient, type ApiClient } from "./http";
import type {
  AcceptInvitationBody,
  BulkInviteBody,
  ChangePasswordBody,
  NewUserBody,
  PasswordResetConfirmBody,
  PasswordResetRequestBody,
  UpdateProfileBody,
  UserLoginBody,
} from "./types";

/**
 * The user pages' calls from the browser. Paths, bodies and results are typed by the
 * OpenAPI types.
 */
class APIClient {
  constructor(private readonly api: ApiClient) {}

  findCompany(slug: string) {
    return call(this.api.GET("/api/auth/companies/{slug}", { params: { path: { slug } } }));
  }

  login(body: UserLoginBody) {
    return call(this.api.POST("/api/auth/login", { body }));
  }

  logout() {
    return call(this.api.POST("/api/auth/logout"));
  }

  acceptInvitation(body: AcceptInvitationBody) {
    return call(this.api.POST("/api/auth/invitations/accept", { body }));
  }

  requestPasswordReset(body: PasswordResetRequestBody) {
    return call(this.api.POST("/api/auth/password-reset/request", { body }));
  }

  confirmPasswordReset(body: PasswordResetConfirmBody) {
    return call(this.api.POST("/api/auth/password-reset/confirm", { body }));
  }

  changePassword(body: ChangePasswordBody) {
    return call(this.api.POST("/api/settings/password", { body }));
  }

  signOutEverywhere() {
    return call(this.api.POST("/api/settings/sign-out-everywhere"));
  }

  updateProfile(body: UpdateProfileBody) {
    return call(this.api.PATCH("/api/settings/profile", { body }));
  }

  // --- Company (company admins) ------------------------------------------------

  renameCompany({ name }: { name: string }) {
    return call(this.api.PATCH("/api/company", { body: { name } }));
  }

  // --- Team (company admins) ---------------------------------------------------

  createTeamUser(body: NewUserBody) {
    return call(this.api.POST("/api/team/users", { body }));
  }

  bulkInviteTeam(body: BulkInviteBody) {
    return call(this.api.POST("/api/team/users/bulk", { body }));
  }

  resendTeamInvitation(userId: string) {
    return call(
      this.api.POST("/api/team/users/{userId}/resend-invitation", {
        params: { path: { userId } },
      }),
    );
  }

  updateTeamUser(userId: string, changes: UserChanges) {
    return call(
      this.api.PATCH("/api/team/users/{userId}", {
        params: { path: { userId } },
        body: changes,
      }),
    );
  }

  deleteTeamUser(userId: string) {
    return call(
      this.api.DELETE("/api/team/users/{userId}", { params: { path: { userId } } }),
    );
  }
}

/** Same origin: requests go through this app's /api/* rewrite. */
export const browserApiClient = new APIClient(createApiClient(""));
