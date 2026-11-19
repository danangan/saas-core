import { describe, expect, it } from "vitest";
import { createJobHandlers } from "../../worker/handlers";
import { PermanentJobError } from "../../worker/job-handler";
import { JobScheduler } from "../../worker/job-scheduler";
import { jobPayloadSchemas } from "./job";

describe("job handlers", () => {
  const handlers = createJobHandlers({ companies: {} as never });

  it("has exactly one handler per job type", () => {
    expect(handlers.map((h) => h.jobType).sort()).toEqual(Object.keys(jobPayloadSchemas).sort());
    expect(
      new JobScheduler({} as never, handlers, {
        concurrency: 1,
        pollMs: 10,
        sweepMs: 10,
      }).jobTypes.sort(),
    ).toEqual(Object.keys(jobPayloadSchemas).sort());
    expect(
      () =>
        new JobScheduler({} as never, [...handlers, handlers[0]!], {
          concurrency: 1,
          pollMs: 10,
          sweepMs: 10,
        }),
    ).toThrow(/Two handlers/);
  });

  it("fails a company job without a company for good", async () => {
    const deleteCompany = handlers.find((h) => h.jobType === "app.delete-company")!;
    const job = {
      id: "j",
      type: "app.delete-company",
      companyId: null,
      payload: {},
      attempts: 1,
      maxAttempts: 5,
    };
    await expect(deleteCompany.run(job)).rejects.toBeInstanceOf(PermanentJobError);
  });
});
