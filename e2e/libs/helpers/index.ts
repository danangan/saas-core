/**
 * What the tests share. Everything a test is about goes through the UI, the way a person
 * would use it. What it starts from (admins, companies, users) it makes itself, straight
 * in the database (the *DBConnector exports here, the backend's connectors on libs/db/client.ts), named after
 * the run so the teardown deletes it. Never the API.
 */
export { expect, test } from "@playwright/test";
export { adminDBConnector } from "./admin.ts";
export { type Company, companyDBConnector } from "./company.ts";
export { runName, testName, unique } from "./names.ts";
export { userDBConnector } from "./user.ts";
// The rows the connectors return, as Prisma generates them.
export type { Admin, User } from "@saas-core/shared/db";
export type { SignedUpUser } from "@saas-core/shared/db/test-helpers";
export { openCompany, submitAddCompany, submitAddUser } from "./admin-page.ts";
export { linkIn, waitForEmail } from "./mailpit.ts";
export { navLink } from "./nav.ts";
export { signInAsAdmin, signInAsMember } from "./sign-in.ts";
