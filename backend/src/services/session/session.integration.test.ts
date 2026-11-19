import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, type PrismaClient } from "@saas-core/shared/db";
import { dbConnectors } from "@saas-core/shared/db/test-helpers";
import { startTestDatabase, type TestDatabase } from "@saas-core/shared/db/test-helpers";
import { DEFAULT_SESSION_POLICY, SessionService } from "./session";

describe("SessionService (integration)", () => {
  let pg: TestDatabase;
  let db: PrismaClient;
  let sessions: SessionService;
  /** The time SessionService sees; tests move it to check expiry. */
  let now = new Date();

  beforeAll(async () => {
    pg = await startTestDatabase();
    db = createPrismaClient(pg.url);
    sessions = new SessionService(db, DEFAULT_SESSION_POLICY, () => now);
  });

  afterAll(async () => {
    await db?.$disconnect();
    await pg?.stop();
  });

  it("validates, slides, and expires admin sessions", async () => {
    const admin = await dbConnectors(db).admins.createAdmin();
    now = new Date();
    const { token, session } = await sessions.createSession({ kind: "admin", adminId: admin.id });

    expect((await sessions.validateAdminSession(token))?.admin.username).toBe(admin.username);
    expect(await sessions.validateUserSession(token)).toBeNull();

    // Used after 2 hours: idle expiry slides forward.
    now = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const slid = await sessions.validateAdminSession(token);
    expect(slid!.session.expiresAt.getTime()).toBeGreaterThan(session.expiresAt.getTime());

    // Unused for longer than the idle timeout: expired and removed.
    now = new Date(now.getTime() + DEFAULT_SESSION_POLICY.idleTimeoutMs + 1000);
    expect(await sessions.validateAdminSession(token)).toBeNull();
    expect(await db.session.count({ where: { id: session.id } })).toBe(0);
    now = new Date();
  });
});
