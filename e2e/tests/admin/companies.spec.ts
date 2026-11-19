import {
  type Admin,
  adminDBConnector,
  companyDBConnector,
  expect,
  openCompany,
  runName,
  signInAsAdmin,
  submitAddCompany,
  test,
} from "../../libs/helpers/index.ts";

test.describe("admin: companies", () => {
  let admin: Admin;

  test.beforeAll(async () => {
    admin = await adminDBConnector.createAdmin();
  });

  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page, admin);
  });

  test("adds a company, with a slug made from its name", async ({ page }) => {
    const name = runName("Acme & Co");
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await page.goto("/admin");
    await page.getByRole("button", { name: "Add company" }).click();
    const dialog = page.getByRole("dialog", { name: "Add company" });
    await dialog.getByLabel("Name").fill(name);
    await expect(dialog.getByText(slug)).toBeVisible(); // the slug preview
    await dialog.getByRole("button", { name: "Create company" }).click();

    await expect(page.getByText(`Created ${name} (${slug}).`)).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: name });
    await expect(row).toContainText(slug);
    await expect(row).toContainText("Active");
  });

  test("refuses a company whose slug is taken", async ({ page }) => {
    const existing = await companyDBConnector.createCompany("taken");
    const dialog = await submitAddCompany(page, existing.name);
    await expect(
      dialog.getByText(`A company with the slug "${existing.slug}" already exists.`),
    ).toBeVisible();
  });

  test("deactivates and reactivates a company", async ({ page }) => {
    const company = await companyDBConnector.createCompany("toggle");
    await openCompany(page, company);
    await page.getByRole("button", { name: "Deactivate" }).click();
    await expect(page.getByText("Inactive", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Activate" }).click();
    await expect(page.getByText("Active", { exact: true }).first()).toBeVisible();
  });

  test("renames a company, keeping its slug, and logs it", async ({ page }) => {
    const company = await companyDBConnector.createCompany("rename");
    const newName = runName("Renamed Co");
    await openCompany(page, company);
    await page.getByRole("button", { name: "Rename" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(newName);
    await dialog.getByRole("button", { name: "Save name" }).click();

    await expect(page.getByText(`Renamed to ${newName}.`)).toBeVisible();
    await expect(page.getByRole("heading", { name: newName })).toBeVisible();
    await expect(page.getByText(`Slug ${company.slug}`)).toBeVisible();
    await expect(page.getByRole("list", { name: "Activity" })).toContainText(
      `${admin.username} (platform admin) renamed the company from "${company.name}"`,
    );
  });

  test("deletes a company only after its slug is typed", async ({ page }) => {
    const company = await companyDBConnector.createCompany("remove");
    await page.goto("/admin");
    const row = () => page.getByRole("row").filter({ hasText: company.name });
    await page.getByRole("button", { name: `Actions for ${company.name}` }).click();
    await page.getByRole("menuitem", { name: "Delete permanently" }).click();

    const dialog = page.getByRole("alertdialog", { name: `Delete ${company.name}?` });
    const confirm = dialog.getByRole("button", { name: "Delete permanently" });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/to confirm/).fill("not-the-slug");
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/to confirm/).fill(company.slug);
    await confirm.click();

    await expect(page.getByText(`${company.name} is being deleted.`)).toBeVisible();
    await expect(row()).toHaveCount(0);
    // Still gone after a reload: deleted on the server, not just removed from the page.
    await page.reload();
    await expect(page.getByRole("button", { name: "Add company" })).toBeVisible();
    await expect(row()).toHaveCount(0);
  });
});
