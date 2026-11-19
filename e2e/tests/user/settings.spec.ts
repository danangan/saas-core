import {
  companyDBConnector,
  expect,
  signInAsMember,
  test,
  userDBConnector,
  navLink,
} from "../../libs/helpers/index.ts";

test.describe("user: settings", () => {
  test("changes their own name", async ({ page }) => {
    const company = await companyDBConnector.createCompany("settings");
    const member = await userDBConnector.createUser(company, "renamer");
    await signInAsMember(page, member);
    await navLink(page, "Settings").click();

    await page.getByLabel("First name").fill("Rhea");
    await page.getByLabel("Last name").fill("Newname");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByText("Name saved.")).toBeVisible();
    // The sidebar shows it too, and it stays after a reload.
    await page.reload();
    await expect(page.getByRole("complementary").getByText("Rhea Newname")).toBeVisible();
    await expect(page.getByText("Member", { exact: true })).toBeVisible();
  });
});
