import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import type { ClaimedJob, JobService } from "../services/job/job";
import { DeferJobError, PermanentJobError, type JobHandler } from "./job-handler";

export type Options = {
  /** Jobs run at the same time by this worker. */
  concurrency: number;
  /** How often to look for new jobs when idle. */
  pollMs: number;
  /** How often to take back jobs whose lease ran out. */
  sweepMs: number;
  workerId?: string;
  /** Only these companies' jobs (tests, in a shared database). */
  companyIds?: string[];
  log?: Pick<Console, "info" | "warn" | "error">;
};

/**
 * Claims jobs of the types it has handlers for and runs each with its handler
 * (docs/jobs.md): heartbeat while it runs, then done, deferred, retried, or failed.
 * Any number of workers can run side by side. On stop it claims nothing new and waits for running
 * jobs; any it can't wait for are taken back by another worker when their lease ends.
 */
export class JobScheduler {
  readonly workerId: string;
  private readonly running = new Set<Promise<void>>();
  private stopping = false;
  private loopDone: Promise<void> | null = null;
  private wake: (() => void) | null = null;
  private readonly log: Pick<Console, "info" | "warn" | "error">;
  private readonly handlers = new Map<string, JobHandler>();

  constructor(
    private readonly jobs: JobService,
    /** Initialised handlers, one per job type. */
    handlers: JobHandler[],
    private readonly options: Options,
  ) {
    for (const handler of handlers) {
      if (this.handlers.has(handler.jobType)) throw new Error(`Two handlers for ${handler.jobType} jobs.`);
      this.handlers.set(handler.jobType, handler);
    }
    this.workerId = options.workerId ?? `backend:${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
    this.log = options.log ?? console;
  }

  /** The job types this scheduler claims. */
  get jobTypes(): string[] {
    return [...this.handlers.keys()];
  }

  start(): void {
    this.loopDone ??= this.loop();
  }

  /** Stops claiming and waits up to `timeoutMs` for running jobs. */
  async stop(timeoutMs = 30_000): Promise<void> {
    this.stopping = true;
    this.wake?.();
    await this.loopDone;
    await Promise.race([Promise.allSettled([...this.running]), new Promise((r) => setTimeout(r, timeoutMs))]);
  }

  /** Claims and runs whatever is due now, then returns when those jobs finish. For tests and scripts. */
  async runOnce(): Promise<number> {
    const claimed = await this.claimAndStart();
    await Promise.allSettled([...this.running]);
    return claimed;
  }

  private async loop(): Promise<void> {
    let lastSweep = 0;
    while (!this.stopping) {
      try {
        if (Date.now() - lastSweep >= this.options.sweepMs) {
          lastSweep = Date.now();
          const taken = await this.jobs.requeueExpired();
          if (taken > 0) this.log.warn(`[jobs] took back ${taken} job(s) whose worker stopped`);
        }
        const claimed = await this.claimAndStart();
        if (claimed > 0 && this.running.size < this.options.concurrency) continue;
      } catch (error) {
        this.log.error("[jobs] polling failed", error);
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, this.options.pollMs);
        this.wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      this.wake = null;
    }
  }

  private async claimAndStart(): Promise<number> {
    const free = this.options.concurrency - this.running.size;
    if (free <= 0) return 0;
    const claimed = await this.jobs.claim(this.jobTypes, this.workerId, free, this.options.companyIds);
    for (const job of claimed) {
      const run = this.run(job).finally(() => {
        this.running.delete(run);
        this.wake?.(); // a slot is free
      });
      this.running.add(run);
    }
    return claimed.length;
  }

  private async run(job: ClaimedJob): Promise<void> {
    const handler = this.handlers.get(job.type)!;
    const label = `${job.type} ${job.id} (attempt ${job.attempts}/${job.maxAttempts})`;
    const heartbeat = setInterval(() => {
      this.jobs.heartbeat(job, this.workerId).then(
        (owned) => owned || this.log.warn(`[jobs] lost the lease on ${label}`),
        (error) => this.log.error(`[jobs] heartbeat failed for ${label}`, error),
      );
    }, this.jobs.policy.leaseMs / 3);

    try {
      // Taken back after crashing its workers more often than it may be attempted.
      if (job.attempts > job.maxAttempts) {
        throw new PermanentJobError("Stopped repeatedly while running this job.");
      }
      await handler.run(job);
      if (!(await this.jobs.complete(job, this.workerId))) this.log.warn(`[jobs] ${label} finished after its lease was lost`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof DeferJobError) {
        await this.jobs.defer(job, this.workerId, error.delayMs, message);
        return;
      }
      const outcome = await this.jobs.fail(job, this.workerId, message, {
        retry: !(error instanceof PermanentJobError),
        onGiveUp: handler.onGiveUp ? (tx) => handler.onGiveUp!(job, message, tx) : undefined,
      });
      if (outcome === "failed") this.log.error(`[jobs] ${label} failed for good: ${message}`);
      else if (outcome === "retrying") this.log.warn(`[jobs] ${label} failed, will retry: ${message}`);
    } finally {
      clearInterval(heartbeat);
    }
  }
}
