import type { Page } from "@playwright/test";
import {
  type Company,
  companyDBConnector,
  expect,
  signInAsMember,
  submitAddUser,
  test,
  testName,
  type SignedUpUser,
  userDBConnector,
  navLink,
} from "../../libs/helpers/index.ts";

/** Signs in as the company admin and opens the Team page from the nav. */
async function openTeam(page: Page, admin: SignedUpUser) {
  await signInAsMember(page, admin);
  await navLink(page, "Team").click();
  await expect(page.getByRole("heading", { name: "Team", exact: true })).toBeVisible();
}

const row = (page: Page, email: string) => page.getByRole("row").filter({ hasText: email });

// A company admin managing their own company's users, on the Team page.
test.describe("user: team management", () => {
  let company: Company;
  let admin: SignedUpUser;

  test.beforeEach(async () => {
    company = await companyDBConnector.createCompany("team");
    admin = await userDBConnector.createUser(company, "boss", { role: "admin" });
  });

  test("is only for company admins", async ({ page }) => {
    const member = await userDBConnector.createUser(company, "member");
    await signInAsMember(page, member);
    await expect(navLink(page, "Settings")).toBeVisible();
    await expect(navLink(page, "Team")).toHaveCount(0);
    await page.goto("/team");
    await expect(page.getByText(/could not be found|404/i).first()).toBeVisible();
  });

  test("invites a user as an admin, who shows as invited", async ({ page }) => {
    await openTeam(page, admin);
    const email = `${testName("ivy")}@example.test`;
    await submitAddUser(page, "Ivy", "Nguyen", email, "admin");
    await expect(page.getByText(`Invitation sent to ${email}.`)).toBeVisible();
    await expect(row(page, email)).toContainText("Ivy Nguyen");
    await expect(row(page, email)).toContainText("Admin");
    await expect(row(page, email)).toContainText("Invited");
    await expect(row(page, email)).toContainText(/Sent .* · Expires /);
    await expect(row(page, email)).toContainText("Never");
  });

  test("invites several people at once from a pasted list", async ({ page }) => {
    await openTeam(page, admin);
    const jane = `${testName("jane")}@example.test`;
    const bob = `${testName("bob")}@example.test`;
    await page.getByRole("button", { name: "Invite several" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("People").fill(`Jane Doe, ${jane}\n${bob}\n${admin.email}`);
    await expect(dialog.getByText("3 people to invite.")).toBeVisible();
    await dialog.getByRole("button", { name: "Invite 3" }).click();

    await expect(page.getByText(`Invited 2 people. 1 already in ${company.name}.`)).toBeVisible();
    await expect(row(page, jane)).toContainText("Jane Doe");
    await expect(row(page, bob)).toContainText("Invited");
  });

  test("edits a user, changes their role, deactivates and deletes them, but not themselves", async ({
    page,
  }) => {
    const member = await userDBConnector.createUser(company, "worker");
    await openTeam(page, admin);

    // Their own row has no actions.
    await expect(row(page, admin.email)).toContainText("(you)");
    await expect(page.getByRole("button", { name: `Actions for ${admin.email}` })).toHaveCount(0);

    const actions = page.getByRole("button", { name: `Actions for ${member.email}` });
    await actions.click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("First name").fill("Wendy");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(`Saved ${member.email}.`)).toBeVisible();
    await expect(row(page, member.email)).toContainText("Wendy Tester");

    await actions.click();
    await page.getByRole("menuitem", { name: "Make admin" }).click();
    await expect(page.getByText(`${member.email} is now an admin.`)).toBeVisible();
    await expect(row(page, member.email)).toContainText("Admin");

    await actions.click();
    await page.getByRole("menuitem", { name: "Deactivate" }).click();
    await expect(page.getByText(`${member.email} deactivated and signed out.`)).toBeVisible();
    await expect(row(page, member.email)).toContainText("Deactivated");

    await actions.click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete user" }).click();
    await expect(page.getByText(`${member.email} was deleted.`)).toBeVisible();
    await expect(row(page, member.email)).toHaveCount(0);
  });

  test("shows an expired invitation, and resending it renews it", async ({ page }) => {
    const invited = await userDBConnector.createInvitedUser(company, "late", { expired: true });
    await openTeam(page, admin);
    await expect(row(page, invited.user.email)).toContainText("Invitation expired");

    await page.getByRole("button", { name: `Actions for ${invited.user.email}` }).click();
    await page.getByRole("menuitem", { name: "Resend invitation" }).click();
    await expect(page.getByText(`Invitation resent to ${invited.user.email}.`)).toBeVisible();
    await expect(row(page, invited.user.email)).not.toContainText("Invitation expired");
    await expect(row(page, invited.user.email)).toContainText("Invited");
  });

  test("lists what the company's admins did", async ({ page }) => {
    const member = await userDBConnector.createUser(company, "promoted");
    await openTeam(page, admin);
    await page.getByRole("button", { name: `Actions for ${member.email}` }).click();
    await page.getByRole("menuitem", { name: "Make admin" }).click();
    await expect(page.getByText(`${member.email} is now an admin.`)).toBeVisible();

    const activity = page.getByRole("list", { name: "Activity" });
    await expect(activity).toContainText(
      `${admin.email} changed the role of ${member.email} to admin`,
    );
  });
});
