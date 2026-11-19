import { config } from "../../libs/config/config.ts";
import {
  type Admin,
  adminDBConnector,
  type Company,
  companyDBConnector,
  expect,
  linkIn,
  openCompany,
  signInAsAdmin,
  signInAsMember,
  submitAddUser,
  test,
  testName,
  userDBConnector,
  waitForEmail,
} from "../../libs/helpers/index.ts";

// Each invitation sends an email. Locally it lands in the stack's Mailpit; on staging it
// goes to an @example.test address that never receives it, and emails are tested by hand.
test.describe("admin: users", () => {
  let admin: Admin;
  let company: Company;

  test.beforeAll(async () => {
    admin = await adminDBConnector.createAdmin();
  });

  test.beforeEach(async ({ page }) => {
    company = await companyDBConnector.createCompany("users");
    await signInAsAdmin(page, admin);
  });

  test("invites a user", async ({ page }) => {
    const email = `${testName("ivy")}@example.test`;
    await openCompany(page, company);
    await submitAddUser(page, "Ivy", "Nguyen", email);

    await expect(page.getByText(`Invitation sent to ${email}.`)).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: email });
    await expect(row).toContainText("Ivy Nguyen");
    await expect(row).toContainText("Invited");
  });

  test("emails the invited user a sign-up link", async ({ page }) => {
    test.skip(!config.isLocalMode, "reads email: local mode only");
    const email = `${testName("ivy")}@example.test`;
    await openCompany(page, company);
    await submitAddUser(page, "Ivy", "Nguyen", email);
    await expect(page.getByText(`Invitation sent to ${email}.`)).toBeVisible();

    const link = linkIn(await waitForEmail(email, /invit/i));
    expect(link.pathname).toBe("/signup");
    expect(link.searchParams.get("token")).toBeTruthy();
  });

  test("refuses an email already in the company", async ({ page }) => {
    const existing = await userDBConnector.createUser(company, "existing");
    await openCompany(page, company);
    const dialog = await submitAddUser(page, "Dup", "User", existing.email);
    await expect(
      dialog.getByText("A user with this email already exists in this company."),
    ).toBeVisible();
  });

  test("resends an invitation, deactivates and deletes a user", async ({ page }) => {
    const {
      user: { email },
    } = await userDBConnector.createInvitedUser(company, "invited");
    await openCompany(page, company);
    const row = page.getByRole("row").filter({ hasText: email });
    const actions = page.getByRole("button", { name: `Actions for ${email}` });

    await actions.click();
    await page.getByRole("menuitem", { name: "Resend invitation" }).click();
    await expect(page.getByText(`Invitation resent to ${email}.`)).toBeVisible();

    await actions.click();
    await page.getByRole("menuitem", { name: "Deactivate" }).click();
    await expect(page.getByText(`${email} deactivated and signed out.`)).toBeVisible();
    await expect(row).toContainText("Deactivated");

    await actions.click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete user" }).click();
    await expect(page.getByText(`${email} was deleted.`)).toBeVisible();
    await expect(row).toHaveCount(0);
  });

  test("invites a company's first user as its admin by default", async ({ page }) => {
    const email = `${testName("first")}@example.test`;
    await openCompany(page, company);
    await page.getByRole("button", { name: "Add user" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Role")).toHaveValue("admin");
    await dialog.getByLabel("First name").fill("First");
    await dialog.getByLabel("Last name").fill("Admin");
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByRole("button", { name: "Add and invite" }).click();
    await expect(page.getByText(`Invitation sent to ${email}.`)).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: email })).toContainText("Admin");
  });

  test("edits a user's name, email and role", async ({ page }) => {
    await userDBConnector.createUser(company, "someone");
    const user = await userDBConnector.createUser(company, "editable");
    const newEmail = `${testName("edited")}@example.test`;
    await openCompany(page, company);
    await page.getByRole("button", { name: `Actions for ${user.email}` }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Last name").fill("Edited");
    await dialog.getByLabel("Email").fill(newEmail);
    await dialog.getByLabel("Role").selectOption("admin");
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText(`Saved ${newEmail}.`)).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: newEmail });
    await expect(row).toContainText("editable Edited");
    await expect(row).toContainText("Admin");
  });

  test("shows each user's last sign-in", async ({ page, browser }) => {
    const user = await userDBConnector.createUser(company, "active");
    await openCompany(page, company);
    await expect(page.getByRole("row").filter({ hasText: user.email })).toContainText("Never");

    const other = await browser.newPage();
    await signInAsMember(other, user);
    await other.close();
    await page.reload();
    await expect(page.getByRole("row").filter({ hasText: user.email })).not.toContainText("Never");
  });

  test("lists what was done, and by which platform admin", async ({ page }) => {
    const user = await userDBConnector.createUser(company, "logged");
    await openCompany(page, company);
    await page.getByRole("button", { name: `Actions for ${user.email}` }).click();
    await page.getByRole("menuitem", { name: "Deactivate" }).click();
    await expect(page.getByText(`${user.email} deactivated and signed out.`)).toBeVisible();

    await expect(page.getByRole("list", { name: "Activity" })).toContainText(
      `${admin.username} (platform admin) deactivated ${user.email}`,
    );
  });
});
