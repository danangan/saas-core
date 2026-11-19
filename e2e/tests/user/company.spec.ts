import type { Page } from "@playwright/test";
import {
  type Company,
  companyDBConnector,
  expect,
  signInAsMember,
  test,
  testName,
  type SignedUpUser,
  userDBConnector,
  navLink,
} from "../../libs/helpers/index.ts";

/** Signs in as the company admin and opens the Company page from the nav. */
async function openCompany(page: Page, admin: SignedUpUser) {
  await signInAsMember(page, admin);
  await navLink(page, "Company").click();
  await expect(page.getByRole("heading", { name: "Company details" })).toBeVisible();
}

// A company admin changing their own company's details, on the Company page.
test.describe("user: company details", () => {
  let company: Company;
  let admin: SignedUpUser;

  test.beforeEach(async () => {
    company = await companyDBConnector.createCompany("company");
    admin = await userDBConnector.createUser(company, "boss", { role: "admin" });
  });

  test("is only for company admins", async ({ page }) => {
    const member = await userDBConnector.createUser(company, "member");
    await signInAsMember(page, member);
    await expect(navLink(page, "Settings")).toBeVisible();
    await expect(navLink(page, "Company")).toHaveCount(0);
    await page.goto("/company");
    await expect(page.getByText(/could not be found|404/i).first()).toBeVisible();
  });

  test("renames the company, keeping its workspace", async ({ page }) => {
    await openCompany(page, admin);
    const newName = testName("renamed");
    // The workspace (in the sign-in address) is shown but can't be edited.
    await expect(page.getByLabel("Workspace")).toHaveValue(company.slug);
    await expect(page.getByLabel("Workspace")).toBeDisabled();
    await page.getByLabel("Name").fill(newName);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(`Renamed to ${newName}.`)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Name")).toHaveValue(newName);
    await expect(page.getByLabel("Workspace")).toHaveValue(company.slug);
  });
});
