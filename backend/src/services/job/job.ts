import { z } from "zod";
import { Prisma, type PrismaClient } from "@saas-core/shared/db";

/**
 * Job types and their payloads, named `<domain>.<job>` (docs/jobs.md):
 *   app.delete-company   the backend worker (src/worker/main.ts): the company's rows
 */
export const jobPayloadSchemas = {
  "app.delete-company": z.object({}),
} as const;

export type JobType = keyof typeof jobPayloadSchemas;
export type JobPayloads = { [T in JobType]: z.infer<(typeof jobPayloadSchemas)[T]> };

/** At most one queued or running job per key: queuing a duplicate is a no-op. */
export const jobKey = {
  deleteCompany: (companyId: string) => `app.delete-company:${companyId}`,
};

export type NewJob<T extends JobType> = {
  companyId: string | null;
  payload: JobPayloads[T];
  dedupeKey?: string;
};

/** A job a worker has claimed. `attempts` includes this one. */
export type ClaimedJob = {
  id: string;
  type: string;
  companyId: string | null;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
};

export type JobPolicy = {
  maxAttempts: number;
  /** How long a claim lasts without a heartbeat. */
  leaseMs: number;
  /** Delay before retry number `attempt` (1-based). */
  backoffMs: (attempt: number) => number;
};

/** 30 s, 2 min, 8 min, 32 min, then hourly; 5 attempts. */
export const DEFAULT_JOB_POLICY: JobPolicy = {
  maxAttempts: 5,
  leaseMs: 5 * 60 * 1000,
  backoffMs: (attempt) => Math.min(30_000 * 4 ** (attempt - 1), 60 * 60 * 1000),
};

/** The client or an interactive transaction. */
type Db = Prisma.TransactionClient;

export type FailOutcome = "retrying" | "failed" | "lost";

/**
 * The jobs table (docs/jobs.md): queuing, and the claim / heartbeat /
 * finish protocol every worker follows.
 *
 * Delivery is at least once: a job whose worker stops renewing its lease is taken back
 * and run again, so every handler must be safe to run twice. Every write about a
 * claimed job checks `locked_by`, so a worker that lost its lease can't overwrite the
 * job's newer state.
 */
export class JobService {
  constructor(
    private readonly db: PrismaClient,
    readonly policy: JobPolicy = DEFAULT_JOB_POLICY,
  ) {}

  /**
   * Queues jobs. Pass the caller's transaction so the jobs exist only if its change
   * commits. Jobs whose dedupe key is already queued or running are skipped.
   * Returns how many were queued.
   */
  async enqueue<T extends JobType>(type: T, jobs: NewJob<T>[], db: Db = this.db): Promise<number> {
    if (jobs.length === 0) return 0;
    const rows = JSON.stringify(jobs.map((j) => ({ companyId: j.companyId, payload: j.payload, dedupeKey: j.dedupeKey ?? null })));
    return db.$executeRaw`
      INSERT INTO jobs (id, type, company_id, payload, dedupe_key, max_attempts)
      SELECT gen_random_uuid()::text, ${type}, j->>'companyId', j->'payload', j->>'dedupeKey', ${this.policy.maxAttempts}
      FROM jsonb_array_elements(${rows}::jsonb) AS j
      ON CONFLICT (dedupe_key) WHERE status IN ('queued', 'running') DO NOTHING`;
  }

  /** Cancels queued (not running) jobs, e.g. a company's once it's being deleted. */
  async cancelQueued(where: { companyId?: string; dedupeKeys?: string[] }, reason: string, db: Db = this.db): Promise<number> {
    const { count } = await db.job.updateMany({
      where: {
        status: "queued",
        ...(where.companyId ? { companyId: where.companyId } : {}),
        ...(where.dedupeKeys ? { dedupeKey: { in: where.dedupeKeys } } : {}),
      },
      data: { status: "cancelled", lastError: reason, finishedAt: new Date() },
    });
    return count;
  }

  /** Whether a job is being worked on right now. */
  async isRunning(where: { companyId?: string; dedupeKey?: string; excludeId?: string }): Promise<boolean> {
    const count = await this.db.job.count({
      where: {
        status: "running",
        ...(where.companyId ? { companyId: where.companyId } : {}),
        ...(where.dedupeKey ? { dedupeKey: where.dedupeKey } : {}),
        ...(where.excludeId ? { id: { not: where.excludeId } } : {}),
      },
    });
    return count > 0;
  }

  // --- Worker protocol ---------------------------------------------------------

  /**
   * Claims up to `limit` due jobs of the given types. Concurrent workers get different
   * jobs. `companyIds` limits it to those companies' jobs (tests use it to stay within
   * their own data in a shared database).
   *
   * The jobs are picked in a MATERIALIZED CTE, which Postgres runs exactly once. With
   * `WHERE id IN (SELECT … LIMIT n FOR UPDATE SKIP LOCKED)` it may run the subquery more
   * than once, each time skipping the rows it just locked, and claim more than `limit`.
   */
  claim(types: string[], workerId: string, limit: number, companyIds?: string[]): Promise<ClaimedJob[]> {
    const inCompanies = companyIds ? Prisma.sql`AND company_id = ANY(${companyIds})` : Prisma.empty;
    return this.db.$queryRaw<ClaimedJob[]>`
      WITH picked AS MATERIALIZED (
        SELECT id FROM jobs
        WHERE status = 'queued' AND type = ANY(${types}) AND run_at <= now() ${inCompanies}
        ORDER BY run_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE jobs SET
        status = 'running', locked_by = ${workerId},
        locked_until = now() + ${this.policy.leaseMs}::double precision * interval '1 millisecond',
        attempts = attempts + 1, updated_at = now()
      FROM picked
      WHERE jobs.id = picked.id
      RETURNING jobs.id, jobs.type, jobs.company_id AS "companyId", jobs.payload, jobs.attempts,
        jobs.max_attempts AS "maxAttempts"`;
  }

  /** Extends the lease. False if this worker no longer owns the job: stop working on it. */
  async heartbeat(job: ClaimedJob, workerId: string): Promise<boolean> {
    const count = await this.db.$executeRaw`
      UPDATE jobs SET locked_until = now() + ${this.policy.leaseMs}::double precision * interval '1 millisecond', updated_at = now()
      WHERE id = ${job.id} AND status = 'running' AND locked_by = ${workerId}`;
    return count === 1;
  }

  /** Marks the job done. False if the lease was lost (another worker owns it now). */
  async complete(job: ClaimedJob, workerId: string): Promise<boolean> {
    const count = await this.db.$executeRaw`
      UPDATE jobs SET status = 'done', locked_by = NULL, locked_until = NULL, last_error = NULL,
        finished_at = now(), updated_at = now()
      WHERE id = ${job.id} AND status = 'running' AND locked_by = ${workerId}`;
    return count === 1;
  }

  /**
   * Records a failure. Retried later with backoff while attempts remain and `retry` is
   * true; otherwise failed for good, and `onGiveUp` runs in the same transaction (e.g. to
   * record why).
   */
  async fail(
    job: ClaimedJob,
    workerId: string,
    error: string,
    options: { retry: boolean; onGiveUp?: (tx: Db) => Promise<void> },
  ): Promise<FailOutcome> {
    const giveUp = !options.retry || job.attempts >= job.maxAttempts;
    return this.db.$transaction(async (tx) => {
      const count = giveUp
        ? await tx.$executeRaw`
            UPDATE jobs SET status = 'failed', locked_by = NULL, locked_until = NULL, last_error = ${error},
              finished_at = now(), updated_at = now()
            WHERE id = ${job.id} AND status = 'running' AND locked_by = ${workerId}`
        : await tx.$executeRaw`
            UPDATE jobs SET status = 'queued', locked_by = NULL, locked_until = NULL, last_error = ${error},
              run_at = now() + ${this.policy.backoffMs(job.attempts)}::double precision * interval '1 millisecond', updated_at = now()
            WHERE id = ${job.id} AND status = 'running' AND locked_by = ${workerId}`;
      if (count === 0) return "lost";
      if (giveUp) await options.onGiveUp?.(tx);
      return giveUp ? "failed" : "retrying";
    });
  }

  /** Puts the job back to run later without counting this attempt (it waited, it didn't fail). */
  async defer(job: ClaimedJob, workerId: string, delayMs: number, reason: string): Promise<boolean> {
    const count = await this.db.$executeRaw`
      UPDATE jobs SET status = 'queued', locked_by = NULL, locked_until = NULL, last_error = ${reason},
        attempts = attempts - 1, run_at = now() + ${delayMs}::double precision * interval '1 millisecond', updated_at = now()
      WHERE id = ${job.id} AND status = 'running' AND locked_by = ${workerId}`;
    return count === 1;
  }

  /**
   * Takes back running jobs whose lease ran out (their worker crashed or hung), so any
   * worker can claim them again. Returns how many.
   */
  requeueExpired(): Promise<number> {
    return this.db.$executeRaw`
      UPDATE jobs SET status = 'queued', locked_by = NULL, locked_until = NULL,
        last_error = 'The worker stopped while running this job.', updated_at = now()
      WHERE status = 'running' AND locked_until < now()`;
  }
}
