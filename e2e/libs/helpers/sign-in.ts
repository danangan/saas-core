import { expect, type Page } from "@playwright/test";
import type { Admin } from "@saas-core/shared/db";
import type { SignedUpUser } from "@saas-core/shared/db/test-helpers";

/** Signs in on the admin login page. */
export async function signInAsAdmin(page: Page, admin: Admin): Promise<void> {
  await page.goto("/admin/login");
  await page.getByLabel("Username").fill(admin.username);
  await page.getByLabel("Password").fill(admin.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Signs in on the user's company's login page, with the password it was created with. */
export async function signInAsMember(page: Page, user: SignedUpUser): Promise<void> {
  await page.goto(`/login/${user.company.slug}`);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/home$/);
}
