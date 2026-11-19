import { config } from "../config/config.ts";
import { getPrismaClient } from "./client.ts";

/**
 * Deletes everything the run created, found by its test execution id (every name starts
 * with it, see names.ts):
 * - its companies: like the admin API's delete, each is marked deleted, its sessions
 *   removed, and an app.delete-company job queued; the worker deletes the rows (users,
 *   invitations cascade);
 * - its admins, with their sessions (cascade).
 */
export async function cleanup(): Promise<void> {
  const db = getPrismaClient();
  const prefix = config.testExecutionId;
  const companies = await db.company.findMany({
    where: { slug: { startsWith: `${prefix}-` }, deletedAt: null },
    select: { id: true },
  });
  const ids = companies.map((c) => c.id);
  if (ids.length > 0) {
    await db.$transaction([
      db.company.updateMany({
        where: { id: { in: ids } },
        data: { isActive: false, deletedAt: new Date() },
      }),
      db.session.deleteMany({ where: { companyId: { in: ids } } }),
      db.job.updateMany({
        where: { companyId: { in: ids }, status: "queued" },
        data: {
          status: "cancelled",
          lastError: "The company was deleted.",
          finishedAt: new Date(),
        },
      }),
      // Same types and dedupe keys as the backend's (backend/src/services/job/job.ts).
      db.job.createMany({
        data: ids.map((id) => ({
          type: "app.delete-company",
          companyId: id,
          dedupeKey: `app.delete-company:${id}`,
        })),
      }),
    ]);
  }
  const admins = await db.admin.deleteMany({ where: { username: { startsWith: `${prefix}-` } } });
  console.info(`[e2e] deleted ${ids.length} companies and ${admins.count} admins named ${prefix}*`);
}

/** cleanup() for teardowns: a failure only warns, so it doesn't hide the tests' result. */
export async function cleanupOrWarn(): Promise<void> {
  try {
    await cleanup();
  } catch (error) {
    console.warn(
      `[e2e] cleanup failed, delete ${config.testExecutionId}* by hand: ${String(error)}`,
    );
  }
}
