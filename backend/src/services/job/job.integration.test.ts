import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, type PrismaClient } from "@saas-core/shared/db";
import { DEFAULT_JOB_POLICY, JobService } from "./job";
import { DeferJobError, PermanentJobError, type JobHandler } from "../../worker/job-handler";
import { JobScheduler } from "../../worker/job-scheduler";
import { startTestDatabase, type TestDatabase } from "@saas-core/shared/db/test-helpers";

const quiet = { info() {}, warn() {}, error() {} };

describe("JobService and JobScheduler (integration)", () => {
  // Jobs have no foreign key to companies, so made-up company ids keep each test's jobs apart.
  const run = randomUUID().slice(0, 8);
  const company = (label: string) => `jobtest-${run}-${label}`;
  let pg: TestDatabase;
  let db: PrismaClient;
  let jobs: JobService;

  beforeAll(async () => {
    pg = await startTestDatabase();
    db = createPrismaClient(pg.url);
    jobs = new JobService(db, { ...DEFAULT_JOB_POLICY, backoffMs: () => 0 });
  });

  afterAll(async () => {
    await db?.$disconnect();
    await pg?.stop();
  });

  async function queue(label: string, count: number, keyPrefix?: string) {
    const companyId = company(label);
    await jobs.enqueue(
      "app.delete-company",
      Array.from({ length: count }, (_, i) => ({
        companyId,
        // Real payloads are empty; a tag tells the test's jobs apart.
        payload: { tag: `j${i}` } as never,
        dedupeKey: keyPrefix ? `${keyPrefix}-${run}-${i}` : undefined,
      })),
    );
    return companyId;
  }

  it("never claims more jobs than asked for", async () => {
    // Regression: claiming with `WHERE id IN (SELECT … LIMIT n FOR UPDATE SKIP LOCKED)`
    // could claim more than n, depending on the query plan.
    const companyId = await queue("limit", 20);
    for (const limit of [1, 3, 5]) {
      expect(await jobs.claim(["app.delete-company"], `w${limit}`, limit, [companyId])).toHaveLength(limit);
    }
    expect(await db.job.count({ where: { companyId, status: "running" } })).toBe(9);
  });

  it("gives concurrent workers different jobs", async () => {
    const companyId = await queue("concurrent", 12);
    const claims = await Promise.all(
      Array.from({ length: 6 }, (_, i) => jobs.claim(["app.delete-company"], `worker-${i}`, 3, [companyId])),
    );
    const ids = claims.flat().map((j) => j.id);
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
    expect(await jobs.claim(["app.delete-company"], "late", 3, [companyId])).toEqual([]);
  });

  it("never queues the same key twice while one is active", async () => {
    const companyId = await queue("dedupe", 1, "dupe");
    await queue("dedupe", 1, "dupe");
    expect(await db.job.count({ where: { companyId } })).toBe(1);
    const [job] = await jobs.claim(["app.delete-company"], "w", 1, [companyId]);
    await queue("dedupe", 1, "dupe"); // still running: skipped
    expect(await db.job.count({ where: { companyId } })).toBe(1);
    await jobs.complete(job!, "w");
    await queue("dedupe", 1, "dupe"); // finished: a new one is fine
    expect(await db.job.count({ where: { companyId } })).toBe(2);
  });

  it("takes a job back when its lease runs out, and ignores the old worker after that", async () => {
    const companyId = await queue("lease", 1);
    const shortLease = new JobService(db, { ...DEFAULT_JOB_POLICY, leaseMs: 1 });
    const [first] = await shortLease.claim(["app.delete-company"], "crashed", 1, [companyId]);
    await new Promise((r) => setTimeout(r, 20));
    expect(await jobs.requeueExpired()).toBeGreaterThanOrEqual(1);

    const [second] = await jobs.claim(["app.delete-company"], "healthy", 1, [companyId]);
    expect(second).toMatchObject({ id: first!.id, attempts: 2 });
    // The first worker comes back: none of its writes land.
    expect(await jobs.heartbeat(first!, "crashed")).toBe(false);
    expect(await jobs.complete(first!, "crashed")).toBe(false);
    expect(await jobs.fail(first!, "crashed", "late", { retry: true })).toBe("lost");
    expect(await jobs.complete(second!, "healthy")).toBe(true);
    expect(await db.job.findUniqueOrThrow({ where: { id: first!.id } })).toMatchObject({ status: "done", lockedBy: null });
  });

  it("retries with backoff, then gives up and runs onGiveUp in the same transaction", async () => {
    const companyId = await queue("retry", 1);
    const policy = { ...DEFAULT_JOB_POLICY, maxAttempts: 2, backoffMs: () => 60_000 };
    const twice = new JobService(db, policy);
    await db.job.updateMany({ where: { companyId }, data: { maxAttempts: 2 } });

    const [a1] = await twice.claim(["app.delete-company"], "w", 1, [companyId]);
    expect(await twice.fail(a1!, "w", "SMTP down", { retry: true })).toBe("retrying");
    const queued = await db.job.findUniqueOrThrow({ where: { id: a1!.id } });
    expect(queued).toMatchObject({ status: "queued", lastError: "SMTP down" });
    expect(queued.runAt.getTime()).toBeGreaterThan(Date.now() + 50_000);

    await db.job.update({ where: { id: a1!.id }, data: { runAt: new Date(Date.now() - 60_000) } });
    const [a2] = await twice.claim(["app.delete-company"], "w", 1, [companyId]);
    let gaveUpInside = false;
    const outcome = await twice.fail(a2!, "w", "SMTP still down", {
      retry: true,
      onGiveUp: async (tx) => {
        gaveUpInside = (await tx.job.findUniqueOrThrow({ where: { id: a2!.id } })).status === "failed";
      },
    });
    expect(outcome).toBe("failed");
    expect(gaveUpInside).toBe(true);
    expect(await db.job.findUniqueOrThrow({ where: { id: a2!.id } })).toMatchObject({ status: "failed", attempts: 2 });
  });

  it("runs handlers: success, permanent failure, deferral, and jobs that crashed too often", async () => {
    const companyId = await queue("worker", 4);
    const all = await db.job.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } });
    const tagOf = (id: string) => (all.find((j) => j.id === id)!.payload as { tag: string }).tag;
    // j3 has already been taken back from crashed workers more often than allowed.
    await db.job.updateMany({ where: { id: all[3]!.id }, data: { attempts: 5 } });

    const gaveUp: string[] = [];
    const handler: JobHandler = {
      jobType: "app.delete-company",
      async run(job) {
        const tag = tagOf(job.id);
        if (tag === "j1") throw new PermanentJobError("No such company.");
        if (tag === "j2") throw new DeferJobError("Waiting.", 60_000);
      },
      async onGiveUp(job, message) {
        gaveUp.push(`${tagOf(job.id)}: ${message}`);
      },
    };
    const worker = new JobScheduler(jobs, [handler], { concurrency: 4, pollMs: 10, sweepMs: 60_000, companyIds: [companyId], log: quiet });
    expect(await worker.runOnce()).toBe(4);

    const after = await db.job.findMany({ where: { companyId } });
    const byTag = Object.fromEntries(after.map((j) => [tagOf(j.id), j]));
    expect(byTag.j0).toMatchObject({ status: "done", attempts: 1 });
    expect(byTag.j1).toMatchObject({ status: "failed", attempts: 1, lastError: "No such company." });
    expect(byTag.j2).toMatchObject({ status: "queued", attempts: 0, lastError: "Waiting." });
    expect(byTag.j3).toMatchObject({ status: "failed", attempts: 6 });
    expect(gaveUp.sort()).toEqual(["j1: No such company.", "j3: Stopped repeatedly while running this job."]);
  });

  it("cancels queued jobs but leaves running ones alone", async () => {
    const companyId = await queue("cancel", 3);
    expect(await jobs.claim(["app.delete-company"], "w", 1, [companyId])).toHaveLength(1);
    expect(await jobs.cancelQueued({ companyId }, "Company deleted.")).toBe(2);
    expect(await jobs.isRunning({ companyId })).toBe(true);
    expect(await db.job.count({ where: { companyId, status: "cancelled", lastError: "Company deleted." } })).toBe(2);
  });
});
