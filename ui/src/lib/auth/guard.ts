import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Admin, User } from "@/lib/api/types";
import { serverAdminApiClient, type ServerAdminAPIClient } from "@/lib/api/admin-server-client";
import { serverApiClient, type ServerAPIClient } from "@/lib/api/server-client";

class AuthGuard {
  constructor(
    private readonly api: ServerAPIClient,
    private readonly adminApi: ServerAdminAPIClient,
  ) {}

  /** The signed-in user and their company; redirects to /login otherwise. */
  readonly requireAuthenticatedUser = cache(async (): Promise<User> => {
    const response = await this.api.getCurrentUser();
    if (!response.ok) redirect("/login");
    return response.data;
  });

  /** Redirects to /home when a user is signed in. */
  readonly redirectAuthenticatedUser = cache(async (): Promise<void> => {
    const response = await this.api.getCurrentUser();
    if (response.ok) redirect("/home");
  });

  /** The signed-in admin; redirects to /admin/login otherwise. */
  readonly requireAuthenticatedAdmin = cache(async (): Promise<Admin> => {
    const response = await this.adminApi.getCurrentAdmin();
    if (!response.ok) redirect("/admin/login");
    return response.data;
  });
}

export const authGuard = new AuthGuard(serverApiClient, serverAdminApiClient);
