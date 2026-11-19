import type { Job, JobStatus, Prisma, PrismaClient } from "..";

/**
 * Creates job rows straight in the database, for tests: work another worker has queued
 * (or is running). Use the backend's JobService to test queueing and claiming themselves.
 *
 * Job types and payloads are the backend's (src/services/job/job.ts);
 * shared can't import them, so they're plain values here.
 */
export class JobDBConnector {
  constructor(private readonly dbClient: () => PrismaClient) {}

  createJob(
    type: string,
    companyId: string,
    payload: Prisma.InputJsonObject,
    { dedupeKey = null, status = "queued" }: { dedupeKey?: string | null; status?: JobStatus } = {},
  ): Promise<Job> {
    // Due a little in the past: Prisma sets run_at from this machine's clock, and a database
    // whose clock runs a few milliseconds behind wouldn't count a job due "now" as due yet.
    const runAt = new Date(Date.now() - 60_000);
    return this.dbClient().job.create({ data: { type, companyId, payload, dedupeKey, status, runAt } });
  }
}
