import { call, createApiClient, type ApiClient } from "./http";
import type {
  AdminLoginBody,
  BulkInviteBody,
  CreateCompanyBody,
  NewUserBody,
  UpdateCompanyBody,
  UpdateUserBody,
} from "./types";

/** Any of a user's name, email, role, and whether they're active. */
export type UserChanges = UpdateUserBody;

/** The admin pages' calls from the browser. Paths, bodies and results are typed by the OpenAPI types. */
class AdminAPIClient {
  constructor(private readonly api: ApiClient) {}

  login(body: AdminLoginBody) {
    return call(this.api.POST("/api/admin/auth/login", { body }));
  }

  logout() {
    return call(this.api.POST("/api/admin/auth/logout"));
  }

  createCompany(body: CreateCompanyBody) {
    return call(this.api.POST("/api/admin/companies", { body }));
  }

  setCompanyActive(companyId: string, { isActive }: { isActive: boolean }) {
    return call(
      this.api.PATCH("/api/admin/companies/{id}", {
        params: { path: { id: companyId } },
        body: { isActive },
      }),
    );
  }

  renameCompany(companyId: string, { name }: { name: string }) {
    return call(
      this.api.PATCH("/api/admin/companies/{id}", {
        params: { path: { id: companyId } },
        body: { name },
      }),
    );
  }

  /** Changes the plan and/or overrides its limits (null = back to the plan's). */
  updateCompanyLimits(
    companyId: string,
    limits: Pick<UpdateCompanyBody, "plan" | "maxUsers">,
  ) {
    return call(
      this.api.PATCH("/api/admin/companies/{id}", {
        params: { path: { id: companyId } },
        body: limits,
      }),
    );
  }

  deleteCompany(companyId: string) {
    return call(
      this.api.DELETE("/api/admin/companies/{id}", { params: { path: { id: companyId } } }),
    );
  }

  createUser(companyId: string, body: NewUserBody) {
    return call(
      this.api.POST("/api/admin/companies/{id}/users", {
        params: { path: { id: companyId } },
        body,
      }),
    );
  }

  bulkInvite(companyId: string, body: BulkInviteBody) {
    return call(
      this.api.POST("/api/admin/companies/{id}/users/bulk", {
        params: { path: { id: companyId } },
        body,
      }),
    );
  }

  updateUser(companyId: string, userId: string, changes: UserChanges) {
    return call(
      this.api.PATCH("/api/admin/companies/{id}/users/{userId}", {
        params: { path: { id: companyId, userId } },
        body: changes,
      }),
    );
  }

  resendInvitation(companyId: string, userId: string) {
    return call(
      this.api.POST("/api/admin/companies/{id}/users/{userId}/resend-invitation", {
        params: { path: { id: companyId, userId } },
      }),
    );
  }

  setUserActive(companyId: string, userId: string, { isActive }: { isActive: boolean }) {
    return this.updateUser(companyId, userId, { isActive });
  }

  deleteUser(companyId: string, userId: string) {
    return call(
      this.api.DELETE("/api/admin/companies/{id}/users/{userId}", {
        params: { path: { id: companyId, userId } },
      }),
    );
  }
}

/** Same origin: requests go through this app's /api/* rewrite. */
export const browserAdminApiClient = new AdminAPIClient(createApiClient(""));
