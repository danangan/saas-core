import { config } from "../../libs/config/config.ts";
import {
  type Company,
  companyDBConnector,
  expect,
  linkIn,
  test,
  userDBConnector,
  waitForEmail,
} from "../../libs/helpers/index.ts";

test.describe("user sign-in", () => {
  let company: Company;

  test.beforeEach(async () => {
    company = await companyDBConnector.createCompany("workspace");
  });

  test("finds the workspace, rejects a wrong password, signs in and out", async ({ page }) => {
    const member = await userDBConnector.createUser(company);
    await page.goto("/login");
    await page.getByLabel("Workspace").fill("no-such-workspace-e2e");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByText("We couldn't find that workspace. Check the name with your admin."),
    ).toBeVisible();

    await page.getByLabel("Workspace").fill(company.slug);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(new RegExp(`/login/${company.slug}$`));
    await expect(page.getByLabel("Email")).toBeVisible();

    // One wrong attempt; the successful sign-in after it clears the failure count.
    await page.getByLabel("Email").fill(member.email);
    await page.getByLabel("Password").fill("wrong-password-here");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();

    await page.getByLabel("Password").fill(member.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/home$/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login$/);
  });

  // An invited user made in the database, with its token: the link is the one its email
  // would carry (the email itself is tested in admin/users.spec.ts). So this runs on
  // staging too.
  test("signs up from an invitation link, then signs in", async ({ page }) => {
    const signup = await userDBConnector.createInvitedUser(company, "signup");
    const link = `/signup?token=${encodeURIComponent(signup.token)}`;

    await page.goto(link);
    await expect(page.getByLabel("Email")).toHaveValue(signup.user.email);
    await page.getByLabel("Password", { exact: true }).fill("sam-long-password");
    await page.getByLabel("Confirm password").fill("sam-long-password");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(new RegExp(`/login/${company.slug}\\?signedUp=1$`));
    await expect(page.getByText("Your account is ready. Sign in to continue.")).toBeVisible();
    await page.getByLabel("Email").fill(signup.user.email);
    await page.getByLabel("Password").fill("sam-long-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole("heading", { name: /^Welcome, / })).toBeVisible();

    // The link worked once.
    await page.context().clearCookies();
    await page.goto(link);
    await expect(page.getByText("This invitation can't be used")).toBeVisible();
  });

  // Through email: local mode only. On staging, password reset is tested by hand.
  test("resets a forgotten password from the emailed link", async ({ page }) => {
    test.skip(!config.isLocalMode, "reads email: local mode only");
    const member = await userDBConnector.createUser(company, "reset");

    await page.goto(`/login/${company.slug}`);
    await page.getByRole("link", { name: "Forgot your password?" }).click();
    await expect(page).toHaveURL(/\/forgot-password\?company=/);
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email").fill(member.email);
    await expect(page.getByLabel("Email")).toHaveValue(member.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/we've sent it a link to reset the password/)).toBeVisible();

    const link = linkIn(await waitForEmail(member.email, /reset/i));
    await page.goto(link.pathname + link.search);
    await page.getByLabel("New password").fill("a-brand-new-password");
    await page.getByLabel("Confirm password").fill("a-brand-new-password");
    await page.getByRole("button", { name: "Save new password" }).click();

    await expect(page).toHaveURL(new RegExp(`/login/${company.slug}\\?reset=1$`));
    await expect(
      page.getByText("Your password was changed. Sign in with your new password."),
    ).toBeVisible();
    await page.getByLabel("Email").fill(member.email);
    await page.getByLabel("Password").fill(member.password); // the old one
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
    await page.getByLabel("Password").fill("a-brand-new-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/home$/);
  });
});
