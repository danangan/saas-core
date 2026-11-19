import type { Prisma } from "@saas-core/shared/db";
import { jobPayloadSchemas, type ClaimedJob, type JobPayloads, type JobType } from "../services/job/job";

type Db = Prisma.TransactionClient;

/** What the scheduler runs for each job type (docs/jobs.md). */
export interface JobHandler {
  /** The job type this handler runs (contracts/jobs.json). */
  readonly jobType: string;
  /** Does the work. Must be safe to run more than once for the same job. */
  run(job: ClaimedJob): Promise<void>;
  /** Runs in the transaction that marks the job failed for good. */
  onGiveUp?(job: ClaimedJob, message: string, tx: Db): Promise<void>;
}

/** Thrown by a handler for a failure retrying won't fix. */
export class PermanentJobError extends Error {}

/** Thrown by a handler that must wait (e.g. for another job to finish); doesn't count as an attempt. */
export class DeferJobError extends Error {
  constructor(
    message: string,
    readonly delayMs: number,
  ) {
    super(message);
  }
}

/** How long a job waits before checking again whether what blocks it has finished. */
export const WAIT_MS = 15_000;

/**
 * Base for handlers of a company's job: checks the job has a company and a valid payload
 * (a malformed job fails for good: retrying won't fix it), then calls `handle` with both.
 */
export abstract class CompanyJobHandler<T extends JobType> implements JobHandler {
  abstract readonly jobType: T;

  protected abstract handle(companyId: string, payload: JobPayloads[T], job: ClaimedJob): Promise<void>;

  async run(job: ClaimedJob): Promise<void> {
    const result = jobPayloadSchemas[this.jobType].safeParse(job.payload);
    if (!result.success) throw new PermanentJobError(`Malformed job: ${result.error.message}`);
    if (!job.companyId) throw new PermanentJobError("Malformed job: no company");
    await this.handle(job.companyId, result.data as JobPayloads[T], job);
  }
}
