import { type Admin, adminDBConnector, expect, test } from "../../libs/helpers/index.ts";

test.describe("admin sign-in", () => {
  let admin: Admin;

  test.beforeAll(async () => {
    admin = await adminDBConnector.createAdmin();
  });

  test("the admin pages need an admin session", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("rejects a wrong password", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Username").fill(admin.username);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Incorrect username or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("signs in and out", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Username").fill(admin.username);
    await page.getByLabel("Password").fill(admin.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Companies" })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    // The session is gone, not just the page.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});
