import type { ClaimedJob, JobPayloads } from "../../services/job/job";
import type { CompanyService } from "../../services/company/company";
import { CompanyJobHandler } from "../job-handler";

/** app.delete-company: deletes a company's rows (docs/jobs.md). If it gives up, the company stays hidden. */
export class DeleteCompanyHandler extends CompanyJobHandler<"app.delete-company"> {
  readonly jobType = "app.delete-company";

  constructor(private readonly companies: CompanyService) {
    super();
  }

  protected async handle(companyId: string, _payload: JobPayloads["app.delete-company"], _job: ClaimedJob): Promise<void> {
    await this.companies.purgeCompany(companyId);
  }
}
