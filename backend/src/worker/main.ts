// The backend's job worker: runs the app.* jobs (docs/jobs.md), and queues the scheduled
// ones (worker/cron.ts).
// Run as many as you like next to the API servers; they share the work through the jobs table.
import { loadConfig } from "../libs/config";
import { exitOnSignal } from "../libs/shutdown";
import { createContainer } from "../services/container";
import { CronScheduler, createCronTasks } from "./cron";
import { createJobHandlers } from "./handlers";
import { JobScheduler } from "./job-scheduler";

const config = loadConfig();
const container = createContainer(config);
const handlers = createJobHandlers(container.services);
const scheduler = new JobScheduler(container.services.jobs, handlers, config.worker);
scheduler.start();
const cron = new CronScheduler(createCronTasks(container.services));
cron.start();
console.info(
  `[jobs] backend worker ${scheduler.workerId} started: ${scheduler.jobTypes.join(", ")} (concurrency ${config.worker.concurrency})`,
);

// Claims nothing new and waits for running jobs, up to 20 s. Jobs still running then are
// taken back by another worker when their lease ends.
exitOnSignal(
  "worker",
  async () => {
    cron.stop();
    await scheduler.stop(15_000);
    await container.close();
  },
  20_000,
);
