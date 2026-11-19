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
    for (let i = 1; i <= 4; i++) await userDBConnector.createUser(company, `Member ${i}`);
  });

  async function changePlan(page: Page, plan: string) {
    await signInAsAdmin(page, admin);
    await openCompany(page, company);
    await page.getByRole("button", { name: "Change plan" }).click();
    const dialog = page.getByRole("dialog", { name: "Plan" });
    await dialog.getByLabel("Plan").selectOption({ label: plan });
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Plan saved.")).toBeVisible();
  }

  test.describe.configure({ mode: "serial" });

  test("shows the company's plan and usage to the platform admin", async ({ page }) => {
    await signInAsAdmin(page, admin);
    await page.goto("/admin");
    await expect(page.getByRole("row").filter({ hasText: company.name })).toContainText("Free");
    await openCompany(page, company);
    await expect(page.getByText("Free plan")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Users: 5 of 5" })).toBeVisible();
  });

  test("at the user limit: the Team page says so and adding users is off", async ({ page }) => {
    await signInAsMember(page, companyAdmin);
    await page.goto("/team");
    await expect(page.getByRole("progressbar", { name: "Users: 5 of 5" })).toBeVisible();
    await expect(page.getByText("User limit reached")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add user" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Invite several" })).toBeDisabled();
  });

  test("upgrading the plan raises the limit, and is logged", async ({ page }) => {
    await changePlan(page, "Premium (20 users)");
    await expect(page.getByText("Premium plan")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Users: 5 of 20" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Activity" })).toContainText("changed the plan of");

    await page.context().clearCookies();
    await signInAsMember(page, companyAdmin);
    await page.goto("/team");
    await expect(page.getByRole("button", { name: "Add user" })).toBeEnabled();
    await expect(page.getByText("User limit reached")).toHaveCount(0);
  });
});
