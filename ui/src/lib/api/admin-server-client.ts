import "server-only";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE } from "@saas-core/shared";
import { call, createApiClient, type ApiClient, type ApiResult } from "./http";

const NO_SESSION: ApiResult<never> = { ok: false, status: 401, error: "Sign in required." };

const sessionCookie = (token: string) => ({
  headers: { cookie: `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}` },
});

/**
 * The admin pages' calls during server rendering, straight to the backend, with the
 * admin's session cookie. Typed by the OpenAPI types.
 */
class ServerAdminAPIClient {
  constructor(private readonly api: ApiClient) {}

  readonly getCurrentAdmin = this.requireSession((token) =>
    call(this.api.GET("/api/admin/me", sessionCookie(token))),
  );

  readonly listCompanies = this.requireSession((token) =>
    call(this.api.GET("/api/admin/companies", sessionCookie(token))),
  );

  readonly getCompany = this.requireSession((token, companyId: string) =>
    call(
      this.api.GET("/api/admin/companies/{id}", {
        ...sessionCookie(token),
        params: { path: { id: companyId } },
      }),
    ),
  );

  readonly getCompanyActivity = this.requireSession((token, companyId: string) =>
    call(
      this.api.GET("/api/admin/companies/{id}/activity", {
        ...sessionCookie(token),
        params: { path: { id: companyId } },
      }),
    ),
  );

  private requireSession<A extends unknown[], T>(
    fn: (token: string, ...args: A) => Promise<ApiResult<T>>,
  ) {
    return async (...args: A): Promise<ApiResult<T>> => {
      const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
      return token ? fn(token, ...args) : NO_SESSION;
    };
  }
}

export type { ServerAdminAPIClient };

export const serverAdminApiClient = new ServerAdminAPIClient(
  createApiClient(process.env.BACKEND_URL ?? "http://127.0.0.1:4000"),
);
