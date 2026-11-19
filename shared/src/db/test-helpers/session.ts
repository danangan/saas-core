import type { Admin, PrismaClient, Session, User } from "..";
import { generateToken, hashToken } from "../../security/token";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** A session row and the cookie token for it (the row holds only its hash). */
export type SessionWithToken = { session: Session; token: string };

/** Creates sign-in sessions straight in the database, for tests. */
export class SessionDBConnector {
  constructor(private readonly dbClient: () => PrismaClient) {}

  /** A session for a company's user, valid for a week unless `expiresAt` says otherwise. */
  createUserSession(user: Pick<User, "id" | "companyId">, { expiresAt }: { expiresAt?: Date } = {}) {
    return this.create({ userId: user.id, companyId: user.companyId }, expiresAt);
  }

  /** A session for a platform admin. */
  createAdminSession(admin: Pick<Admin, "id">, { expiresAt }: { expiresAt?: Date } = {}) {
    return this.create({ adminId: admin.id }, expiresAt);
  }

  private async create(
    owner: { userId: string; companyId: string } | { adminId: string },
    expiresAt = new Date(Date.now() + WEEK_MS),
  ): Promise<SessionWithToken> {
    const token = generateToken();
    const session = await this.dbClient().session.create({
      data: { tokenHash: hashToken(token), expiresAt, ...owner },
    });
    return { session, token };
  }
}
