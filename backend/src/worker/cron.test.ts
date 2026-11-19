import { describe, expect, it, vi } from "vitest";
import { CronScheduler } from "./cron";

describe("CronScheduler", () => {
  it("runs each task on its schedule, and keeps going after one fails", async () => {
    const error = vi.fn();
    let runs = 0;
    const cron = new CronScheduler(
      [
        { name: "count", schedule: "* * * * * *", run: async () => runs++ },
        { name: "broken", schedule: "* * * * * *", run: () => Promise.reject(new Error("boom")) },
      ],
      { info() {}, warn() {}, error },
    );
    cron.start();
    await vi.waitFor(() => expect(runs).toBeGreaterThanOrEqual(2), { timeout: 3500, interval: 50 });
    cron.stop();
    expect(error).toHaveBeenCalledWith("[cron] broken failed:", expect.any(Error));

    const stoppedAt = runs;
    await new Promise((r) => setTimeout(r, 1200));
    expect(runs).toBe(stoppedAt);
  });

});
