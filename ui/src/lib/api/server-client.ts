import "server-only";
import { cookies } from "next/headers";
import { USER_SESSION_COOKIE } from "@saas-core/shared";
import { call, createApiClient, type ApiClient, type ApiResult } from "./http";

const NO_SESSION: ApiResult<never> = { ok: false, status: 401, error: "Sign in required." };

const sessionCookie = (token: string) => ({
  headers: { cookie: `${USER_SESSION_COOKIE}=${encodeURIComponent(token)}` },
});

/**
 * The user pages' calls during server rendering, straight to the backend (not through
 * the browser rewrites), with the visitor's session cookie. Typed by the OpenAPI types.
 */
class ServerAPIClient {
  constructor(private readonly api: ApiClient) {}

  readonly getCurrentUser = this.requireSession((token) =>
    call(this.api.GET("/api/settings/me", sessionCookie(token))),
  );

  findCompany(slug: string) {
    return call(this.api.GET("/api/auth/companies/{slug}", { params: { path: { slug } } }));
  }

  lookupInvitation(token: string) {
    return call(this.api.POST("/api/auth/invitations/lookup", { body: { token } }));
  }

  /** The company's plan, limits and usage. */
  readonly getLimits = this.requireSession((token) =>
    call(this.api.GET("/api/settings/limits", sessionCookie(token))),
  );

  readonly getTeam = this.requireSession((token) =>
    call(this.api.GET("/api/team", sessionCookie(token))),
  );

  readonly getTeamActivity = this.requireSession((token) =>
    call(this.api.GET("/api/team/activity", sessionCookie(token))),
  );

  private requireSession<A extends unknown[], T>(
    fn: (token: string, ...args: A) => Promise<ApiResult<T>>,
  ) {
    return async (...args: A): Promise<ApiResult<T>> => {
      const token = (await cookies()).get(USER_SESSION_COOKIE)?.value;
      return token ? fn(token, ...args) : NO_SESSION;
    };
  }
}

export type { ServerAPIClient };

export const serverApiClient = new ServerAPIClient(
  createApiClient(process.env.BACKEND_URL ?? "http://127.0.0.1:4000"),
);
