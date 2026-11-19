# Jobs

Background work runs as rows in the Postgres `jobs` table, queued in the same transaction as the change that needs it. Backend workers (`backend/src/worker/main.ts`) claim and run them.

## The jobs

A job type is `<domain>.<job>`: the store it changes.

| Job | Queued when | What it does |
| --- | --- | --- |
| `app.delete-company` | A platform admin deletes a company | Deletes the company's row (its users, invitations, sessions and audit logs cascade) |

Payload schemas and dedupe keys (`<type>:<id>`) are in `jobPayloadSchemas` and `jobKey` (`backend/src/services/job/job.ts`).

## Scheduled tasks

The worker also runs cron tasks (`backend/src/worker/cron.ts`, [croner](https://github.com/Hexagon/croner) patterns). There are none yet: `createCronTasks` returns them. Every worker runs every task, so a task should only queue deduplicated jobs.

## How they run

- **Claiming:** `FOR UPDATE SKIP LOCKED`, so any number of workers can run without taking the same job.
- **Leases:** 5 minutes, renewed while a job runs; a dead worker's jobs return to the queue.
- **At least once:** a job may run twice, so every handler is idempotent.
- **Retries:** after 30 s, 2 min, 8 min, 32 min, then hourly, up to 5 attempts. `PermanentJobError` fails at once.
- **Waiting:** a handler that throws `DeferJobError` is checked again later without using an attempt.
- **No duplicates:** a dedupe key is unique among queued and running jobs.
- **Cancelling:** deleting a company cancels its queued jobs.

## Code

| | |
| --- | --- |
| Protocol | `backend/src/services/job/job.ts` |
| Scheduler | `backend/src/worker/job-scheduler.ts` |
| Handlers | `backend/src/worker/handlers/` |
| Cron | `backend/src/worker/cron.ts` |
| Worker | `pnpm dev` (local), `node dist/worker.js` (image) |

Settings: `WORKER_CONCURRENCY` (default 4), `WORKER_POLL_MS` (default 1000).

## Checking on them

```sql
SELECT type, status, count(*) FROM jobs GROUP BY 1, 2;
SELECT type, attempts, last_error, finished_at FROM jobs WHERE status = 'failed' ORDER BY finished_at DESC LIMIT 20;
```
