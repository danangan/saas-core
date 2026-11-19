/** Steps on the admin pages (/admin), and the Team page's shared dialogs. */
import { expect, type Page } from "@playwright/test";
import type { Company } from "./company.ts";

/** Opens a company's page from the admin's company list. */
export async function openCompany(page: Page, company: Company): Promise<void> {
  await page.goto("/admin");
  await page.getByRole("link", { name: company.name, exact: true }).click();
  await expect(page.getByRole("heading", { name: company.name, exact: true })).toBeVisible();
}

/** Fills in and submits the Add company dialog, on the company list. Returns the dialog. */
export async function submitAddCompany(page: Page, name: string) {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Add company" }).click();
  const dialog = page.getByRole("dialog", { name: "Add company" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByRole("button", { name: "Create company" }).click();
  return dialog;
}

/**
 * Fills in and submits the Add user dialog, on a company's page or the Team page.
 * Returns the dialog. `role`: chosen in the dialog, unless left as it starts.
 */
export async function submitAddUser(
  page: Page,
  firstName: string,
  lastName: string,
  email: string,
  role?: "admin" | "member",
) {
  await page.getByRole("button", { name: "Add user" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("First name").fill(firstName);
  await dialog.getByLabel("Last name").fill(lastName);
  await dialog.getByLabel("Email").fill(email);
  if (role) await dialog.getByLabel("Role").selectOption(role);
  await dialog.getByRole("button", { name: "Add and invite" }).click();
  return dialog;
}
