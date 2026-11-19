import type { Page } from "@playwright/test";
import {
  type Admin,
  type Company,
  adminDBConnector,
  companyDBConnector,
  expect,
  openCompany,
  type SignedUpUser,
  signInAsAdmin,
  signInAsMember,
  test,
  userDBConnector,
} from "../../libs/helpers/index.ts";

/**
 * Plans and limits: a platform admin changes them on the company's page, and the
 * company's admins see them on the Team page, including being at the limit.
 */
test.describe("plans and limits", () => {
  let admin: Admin;
  let company: Company;
  let companyAdmin: SignedUpUser;

  test.beforeAll(async () => {
    admin = await adminDBConnector.createAdmin();
    company = await companyDBConnector.createCompany("plans");
    companyAdmin = await userDBConnector.createUser(company, "Owner", { role: "admin" });
    await userDBConnector.createUser(company, "Member");
  });

  async function changeLimits(page: Page, limits: { users?: string }) {
    await signInAsAdmin(page, admin);
    await openCompany(page, company);
    await page.getByRole("button", { name: "Change plan or limits" }).click();
    const dialog = page.getByRole("dialog", { name: "Plan and limits" });
    if (limits.users !== undefined) await dialog.getByLabel("User limit").fill(limits.users);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Plan and limits saved.")).toBeVisible();
  }

  test.describe.configure({ mode: "serial" });

  test("shows the company's plan and usage to the platform admin", async ({ page }) => {
    await signInAsAdmin(page, admin);
    await page.goto("/admin");
    await expect(page.getByRole("row").filter({ hasText: company.name })).toContainText("Free");
    await openCompany(page, company);
    await expect(page.getByText("Free plan")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Users: 2 of 5" })).toBeVisible();
  });

  test("at the user limit: the Team page says so and adding users is off", async ({ page }) => {
    await changeLimits(page, { users: "2" });
    await expect(page.getByText("Custom user limit")).toBeVisible();
    // The activity log records it.
    await expect(page.getByRole("list", { name: "Activity" })).toContainText("changed the limits of");
    await page.context().clearCookies();
    await signInAsMember(page, companyAdmin);
    await page.goto("/team");
    await expect(page.getByRole("progressbar", { name: "Users: 2 of 2" })).toBeVisible();
    await expect(page.getByText("User limit reached")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add user" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Invite several" })).toBeDisabled();
  });

  test("clearing the override goes back to the plan's limit", async ({ page }) => {
    await changeLimits(page, { users: "" });
    await expect(page.getByText("Custom user limit")).toHaveCount(0);
    await expect(page.getByRole("progressbar", { name: "Users: 2 of 5" })).toBeVisible();

    await page.context().clearCookies();
    await signInAsMember(page, companyAdmin);
    await page.goto("/team");
    await expect(page.getByRole("button", { name: "Add user" })).toBeEnabled();
    await expect(page.getByText("User limit reached")).toHaveCount(0);
  });
});
