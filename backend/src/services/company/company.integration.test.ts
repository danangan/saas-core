import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, type PrismaClient } from "@saas-core/shared/db";
import { dbConnectors, type DBConnectors } from "@saas-core/shared/db/test-helpers";
import { startTestDatabase, type TestDatabase } from "@saas-core/shared/db/test-helpers";
import { createJobHandlers } from "../../worker/handlers";
import { JobScheduler } from "../../worker/job-scheduler";
import { ConflictError, NotFoundError } from "../../libs/errors";
import { DEFAULT_JOB_POLICY, JobService } from "../job/job";
import { SessionService } from "../session/session";
import { CompanyService } from "./company";

describe("CompanyService (integration)", () => {
  /** A name for a company the service creates: slugs must be unique. */
  const uniqueName = (label: string) => `Test ${label} ${randomUUID().slice(0, 6)}`;
  let pg: TestDatabase;
  let db: PrismaClient;
  let sessions: SessionService;
  let jobService: JobService;
  let companies: CompanyService;
  let fixtures: DBConnectors;

  beforeAll(async () => {
    pg = await startTestDatabase();
    db = createPrismaClient(pg.url);
    sessions = new SessionService(db);
    jobService = new JobService(db, { ...DEFAULT_JOB_POLICY, backoffMs: () => 0 });
    fixtures = dbConnectors(db);
    companies = new CompanyService(db, sessions, jobService);
  });

  afterAll(async () => {
    await db?.$disconnect();
    await pg?.stop();
  });

  /** Runs the backend's due jobs for these companies until none are left, as the worker would. */
  async function drainJobs(...companyIds: string[]) {
    const handlers = createJobHandlers({ companies });
    const quiet = { info() {}, warn() {}, error() {} };
    const worker = new JobScheduler(jobService, handlers, {
      concurrency: 4,
      pollMs: 10,
      sweepMs: 60_000,
      companyIds,
      log: quiet,
    });
    while ((await worker.runOnce()) > 0);
  }

  it("creates a company with a slug and rejects a duplicate slug", async () => {
    const name = uniqueName("Will & Co");
    const company = await companies.createCompany(name);
    expect(company.slug).toBe(name.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
    expect(company.userCount).toBe(0);
    // Different punctuation, same slug.
    await expect(companies.createCompany(name.replace("&", "+"))).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("renames a company, keeping its slug", async () => {
    const company = await fixtures.companies.createCompany("Before");
    const { before, after } = await companies.updateCompany(company.id, { name: "After Rename" });
    expect(before.name).toBe(company.name);
    expect(after).toMatchObject({ name: "After Rename", slug: company.slug, isActive: true });
  });

  it("throws NotFoundError for an unknown company", async () => {
    await expect(companies.getCompany("missing")).rejects.toBeInstanceOf(NotFoundError);
    await expect(companies.setActive("missing", false)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("deactivating signs out the company's users", async () => {
    const company = await fixtures.companies.createCompany("Deactivate");
    const user = await fixtures.users.createUser(company);
    const { token } = await fixtures.sessions.createUserSession(user);

    expect(await sessions.validateUserSession(token)).not.toBeNull();
    await companies.setActive(company.id, false);
    expect(await sessions.validateUserSession(token)).toBeNull();
    expect(await db.session.count({ where: { companyId: company.id } })).toBe(0);
  });

  it("deletes a company: hidden at once, then its rows by a job", async () => {
    const company = await fixtures.companies.createCompany("Delete");
    const user = await fixtures.users.createUser(company);
    await fixtures.sessions.createUserSession(user);
    await fixtures.jobs.createJob("app.example", company.id, {});

    await companies.deleteCompany(company.id);
    expect((await companies.listCompanies()).some((c) => c.id === company.id)).toBe(false);
    await expect(companies.getCompany(company.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(companies.deleteCompany(company.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await db.session.count({ where: { companyId: company.id } })).toBe(0);
    const jobs = await db.job.findMany({ where: { companyId: company.id }, orderBy: { type: "asc" } });
    // Its other queued jobs are cancelled.
    expect(jobs.map((j) => [j.type, j.status])).toEqual([
      ["app.delete-company", "queued"],
      ["app.example", "cancelled"],
    ]);

    await drainJobs(company.id);
    expect(await db.company.findUnique({ where: { id: company.id } })).toBeNull();
    // The job outlives the company's row (jobs have no foreign key to it).
    expect(
      await db.job.findFirstOrThrow({ where: { companyId: company.id, type: "app.delete-company" } }),
    ).toMatchObject({ status: "done" });
  });
});
