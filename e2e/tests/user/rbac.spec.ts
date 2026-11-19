import type { Browser, Page } from "@playwright/test";
import {
  companyDBConnector,
  expect,
  navLink,
  signInAsMember,
  test,
  userDBConnector,
  type Company,
  type SignedUpUser,
} from "../../libs/helpers/index.ts";

/**
 * Role-based access: what each role may do is the backend's policy (ROLE_PERMISSIONS),
 * sent with the user as their permissions. Company admins manage the Team and the Company;
 * members don't see those pages, and get a 404 if they go to one. (The API refusing them is covered by the backend's integration tests.)
 */

/** The pages only roles with the matching permission may open, with what shows when they can. */
const PROTECTED_PAGES = [
  { path: "/team", shows: (page: Page) => page.getByRole("button", { name: "Add user" }) },
  {
    path: "/company",
    shows: (page: Page) => page.getByRole("heading", { name: "Company details" }),
  },
] as const;

/** The menu as a member sees it: Home and Settings, no Team or Company. */
async function expectMemberMenu(page: Page) {
  await expect(navLink(page, "Home")).toBeVisible();
  await expect(navLink(page, "Settings")).toBeVisible();
  await expect(navLink(page, "Team")).toHaveCount(0);
  await expect(navLink(page, "Company")).toHaveCount(0);
}

/** The menu as an admin sees it: Team and Company too. */
async function expectAdminMenu(page: Page) {
  await expect(navLink(page, "Team")).toBeVisible();
  await expect(navLink(page, "Company")).toBeVisible();
}

/**
 * Next.js answers a page's notFound() with its 404 page, not a 404 status: the app's
 * loading screen has already started the (200) response.
 */
async function expectNotFound(page: Page, path: string) {
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: "This page could not be found." }),
    path,
  ).toBeVisible();
}

/** Signs `user` in on a browser context of its own, next to the test's page. */
async function signInElsewhere(browser: Browser, user: SignedUpUser): Promise<Page> {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const page = await context.newPage();
  await signInAsMember(page, user);
  return page;
}

test.describe("user: role-based access", () => {
  let company: Company;
  let admin: SignedUpUser;
  let member: SignedUpUser;

  test.beforeEach(async () => {
    company = await companyDBConnector.createCompany("rbac");
    admin = await userDBConnector.createUser(company, "admin", { role: "admin" });
    member = await userDBConnector.createUser(company, "member");
  });

  test("hides the Team and Company from members, and doesn't open them", async ({ page }) => {
    await signInAsMember(page, member);
    await expectMemberMenu(page);
    for (const { path } of PROTECTED_PAGES) await expectNotFound(page, path);
    // What members may use still works.
    await page.goto("/settings");
    await expect(page.getByText(member.email).first()).toBeVisible();
  });

  test("shows and opens the Team and Company for admins", async ({ page }) => {
    await signInAsMember(page, admin);
    await expectAdminMenu(page);
    for (const { path, shows } of PROTECTED_PAGES) {
      await page.goto(path);
      await expect(shows(page), path).toBeVisible();
    }
  });

  test("gives a member made admin the admin's pages, and takes them back", async ({
    page,
    browser,
  }) => {
    await signInAsMember(page, admin);
    const memberPage = await signInElsewhere(browser, member);
    await expectMemberMenu(memberPage);

    const changeRole = async (item: "Make admin" | "Make member", done: string) => {
      await page.goto("/team");
      await page.getByRole("button", { name: `Actions for ${member.email}` }).click();
      await page.getByRole("menuitem", { name: item }).click();
      await expect(page.getByText(done)).toBeVisible();
    };

    // Permissions follow the role on the next page load; no new sign-in needed.
    await changeRole("Make admin", `${member.email} is now an admin.`);
    await memberPage.goto("/company");
    await expect(PROTECTED_PAGES[1].shows(memberPage)).toBeVisible();
    await expectAdminMenu(memberPage);

    await changeRole("Make member", `${member.email} is now a member.`);
    await expectNotFound(memberPage, "/company");
    await expectMemberMenu(memberPage);
    await memberPage.context().close();
  });
});
