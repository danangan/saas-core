import { CompanyDBConnector } from "@saas-core/shared/db/test-helpers";
import { getPrismaClient } from "../db/client.ts";
import { testName } from "./names.ts";

export type { Company } from "@saas-core/shared/db";

/**
 * The backend's connector, with every company named after the run
 * (`e2e-<id>-<label>-<suffix>`), so the teardown finds and deletes it.
 */
class E2ECompanyDBConnector extends CompanyDBConnector {
  override createCompany(label = "company") {
    return super.createCompany(testName(label));
  }
}

export const companyDBConnector = new E2ECompanyDBConnector(getPrismaClient);
