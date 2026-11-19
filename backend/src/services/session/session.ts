import type { UserRole } from "@saas-core/shared/db";
import type { PrismaClient, Session } from "@saas-core/shared/db";
import { generateToken, hashToken } from "@saas-core/shared/security";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type SessionPolicy = {
  /** Session expires after this long without use. */
  idleTimeoutMs: number;
  /** Session expires this long after creation, however often it is used. */
  maxAgeMs: number;
  /** expires_at / last_seen_at are written at most this often, to limit writes. */
  refreshIntervalMs: number;
};

export const DEFAULT_SESSION_POLICY: SessionPolicy = {
  idleTimeoutMs: 7 * DAY,
  maxAgeMs: 30 * DAY,
  refreshIntervalMs: HOUR,
};

export type SessionMeta = { userAgent?: string | null };

export type NewSession =
  { kind: "admin"; adminId: string } | { kind: "user"; userId: string; companyId: string };

export type AdminSession = { session: Session; admin: { id: string; username: string } };

export type UserSession = {
  session: Session;
  user: {
    id: string;
    companyId: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
  };
  company: { id: string; name: string; slug: string };
};

/**
 * Who is making a signed-in request, as routes see it (`request.context`): just the ids.
 * `sessionId` is the current session, e.g. to keep it when signing out the others.
 */
export type UserContext = { userId: string; companyId: string; sessionId: string };

/** A signed-in user's context with their role: what the team routes check. */
export type TeamContext = UserContext & { role: UserRole };

/** Which admin is making a request to the admin routes (`request.adminContext`). */
export type AdminContext = { adminId: string };

/**
 * Server-side login sessions (docs/architecture.md#sessions). The raw token only
 * ever lives in the cookie; the database stores its SHA-256 hash.
 */
export class SessionService {
  constructor(
    private readonly db: PrismaClient,
    readonly policy: SessionPolicy = DEFAULT_SESSION_POLICY,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Creates a session and returns the raw token to put in the cookie. */
  async createSession(
    input: NewSession,
    meta: SessionMeta = {},
  ): Promise<{ token: string; session: Session }> {
    const token = generateToken();
    const now = this.now();
    const session = await this.db.session.create({
      data: {
        tokenHash: hashToken(token),
        ...(input.kind === "admin"
          ? { adminId: input.adminId }
          : { userId: input.userId, companyId: input.companyId }),
        expiresAt: this.idleExpiry(now, now),
        lastSeenAt: now,
        userAgent: meta.userAgent ?? null,
      },
    });
    return { token, session };
  }

  /** The admin session for a cookie token, or null if missing, expired, or not an admin session. */
  async validateAdminSession(token: string | undefined): Promise<AdminSession | null> {
    if (!token) return null;
    const now = this.now();
    const session = await this.db.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { admin: { select: { id: true, username: true } } },
    });
    if (!session || !session.adminId || !session.admin) return null;
    if (this.isExpired(session, now)) {
      await this.deleteSessionRow(session);
      return null;
    }
    const { admin, ...rest } = session;
    return { session: await this.touch(rest, now), admin };
  }

  /**
   * The user session for a cookie token, or null if missing, expired, not a user
   * session, or the user or their company is inactive.
   */
  async validateUserSession(token: string | undefined): Promise<UserSession | null> {
    if (!token) return null;
    const now = this.now();
    const session = await this.db.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        user: {
          select: {
            id: true,
            companyId: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
        company: { select: { id: true, name: true, slug: true, isActive: true } },
      },
    });
    if (!session || !session.userId || !session.user || !session.company) return null;
    if (session.user.companyId !== session.company.id) return null;
    if (this.isExpired(session, now) || !session.user.isActive || !session.company.isActive) {
      await this.deleteSessionRow(session);
      return null;
    }
    const { user, company, ...rest } = session;
    const { isActive: _userActive, ...userView } = user;
    const { isActive: _companyActive, ...companyView } = company;
    return { session: await this.touch(rest, now), user: userView, company: companyView };
  }

  /** Deletes the session for a cookie token (sign out). No-op if it doesn't exist. */
  async deleteSession(token: string): Promise<void> {
    await this.db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  /** Signs a user out everywhere, optionally keeping one session (e.g. the current one). */
  async deleteUserSessions(
    companyId: string,
    userId: string,
    options: { exceptSessionId?: string } = {},
  ): Promise<void> {
    await this.db.session.deleteMany({
      where: {
        companyId,
        userId,
        ...(options.exceptSessionId ? { id: { not: options.exceptSessionId } } : {}),
      },
    });
  }

  /** Signs an admin out everywhere. */
  async deleteAdminSessions(adminId: string): Promise<void> {
    await this.db.session.deleteMany({ where: { adminId } });
  }

  /** Signs every user of a company out. */
  async deleteCompanySessions(companyId: string): Promise<void> {
    await this.db.session.deleteMany({ where: { companyId } });
  }

  /** Removes expired sessions; run periodically. Returns how many were deleted. */
  async deleteExpiredSessions(): Promise<number> {
    const now = this.now();
    const { count } = await this.db.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: now } },
          { createdAt: { lte: new Date(now.getTime() - this.policy.maxAgeMs) } },
        ],
      },
    });
    return count;
  }

  /** By id and the session's own company (null for admin sessions). */
  private async deleteSessionRow(session: Pick<Session, "id" | "companyId">): Promise<void> {
    await this.db.session.deleteMany({ where: { id: session.id, companyId: session.companyId } });
  }

  /** Slides the idle expiry forward if the session has not been touched recently. */
  private async touch(session: Session, now: Date): Promise<Session> {
    if (now.getTime() - session.lastSeenAt.getTime() < this.policy.refreshIntervalMs) {
      return session;
    }
    return this.db.session.update({
      where: { id: session.id, companyId: session.companyId },
      data: { lastSeenAt: now, expiresAt: this.idleExpiry(session.createdAt, now) },
    });
  }

  private isExpired(session: Session, now: Date): boolean {
    return (
      session.expiresAt.getTime() <= now.getTime() ||
      session.createdAt.getTime() + this.policy.maxAgeMs <= now.getTime()
    );
  }

  private idleExpiry(createdAt: Date, now: Date): Date {
    return new Date(
      Math.min(
        now.getTime() + this.policy.idleTimeoutMs,
        createdAt.getTime() + this.policy.maxAgeMs,
      ),
    );
  }
}
