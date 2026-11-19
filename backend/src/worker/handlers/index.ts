import type { Services } from "../../services/container";
import type { JobHandler } from "../job-handler";
import { DeleteCompanyHandler } from "./delete-company";

export { DeleteCompanyHandler };

/** Every handler the backend worker runs, initialised with the services they use. */
export function createJobHandlers({ companies }: Pick<Services, "companies">): JobHandler[] {
  return [new DeleteCompanyHandler(companies)];
}
