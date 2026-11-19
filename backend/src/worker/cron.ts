import { Cron } from "croner";
import type { Services } from "../services/container";

/** Work the worker does on a schedule: usually queuing jobs, so that any worker can run them. */
export type CronTask = {
  name: string;
  /** A cron pattern: 5 fields, or 6 with seconds first ("*\/15 * * * * *" is every 15 s). */
  schedule: string;
  run(): Promise<unknown>;
};

/**
 * Runs tasks on cron schedules in the worker process. Every worker runs every task, so a
 * task must be safe to run on several workers at once: queuing deduplicated jobs is. A
 * task still running when its next time comes skips that run.
 */
export class CronScheduler {
  private readonly crons: Cron[] = [];
  private readonly log: Pick<Console, "info" | "warn" | "error">;

  constructor(
    private readonly tasks: CronTask[],
    log?: Pick<Console, "info" | "warn" | "error">,
  ) {
    this.log = log ?? console;
  }

  start(): void {
    if (this.crons.length > 0) return;
    for (const task of this.tasks) {
      this.crons.push(
        new Cron(task.schedule, { name: task.name, protect: true }, async () => {
          try {
            await task.run();
          } catch (error) {
            this.log.error(`[cron] ${task.name} failed:`, error);
          }
        }),
      );
    }
  }

  stop(): void {
    for (const cron of this.crons) cron.stop();
    this.crons.length = 0;
  }
}

/** The backend worker's scheduled tasks. Add a task here and its schedule to libs/config.ts. */
export function createCronTasks(_services: Services): CronTask[] {
  return [];
}
