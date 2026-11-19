import type { User } from "../../types";
import type { PrismaClient } from "@saas-core/shared/db";
import {
  hashPassword,
  PASSWORD_MIN_LENGTH,
  verifyDummyPassword,
  verifyPassword,
} from "@saas-core/shared/security";
import { allowedActions } from "../../libs/route-guard";
import type { FailureLimiter } from "../../libs/rate-limit";
import { generateToken, hashToken } from "@saas-core/shared/security";
import type { EmailService } from "../email/email";
import {
  AuthenticationError,
  InvalidInputError,
  NotFoundError,
  TooManyAttemptsError,
} from "../../libs/errors";
import type { AdminContext, SessionMeta, SessionService, UserContext } from "../session/session";

export type MeDTO = User;

export type AdminDTO = { id: string; username: string };

export type PasswordResetPolicy = { ttlMinutes: number; cooldownMs: number };
export const DEFAULT_PASSWORD_RESET_POLICY: PasswordResetPolicy = {
  ttlMinutes: 60,
  cooldownMs: 60_000,
};

const INVALID_RESET_LINK = "This reset link is invalid or has expired. Request a new one.";

/**
 * Authentication for both kinds of account:
 * - Users: sign-in (company slug, then email + password), forgot password (emailed
 *   one-time reset links), and account security.
 * - Super-admins for the admin pages: sign-in, and creating an admin or resetting their
 *   password (create-admin script; there is no admin sign-up).
 */
export class AuthService {
  constructor(
    private readonly db: PrismaClient,
    private readonly sessions: SessionService,
    private readonly email: EmailService,
    /** Failed user sign-ins, keyed by company slug + email. */
    private readonly userLoginLimiter: FailureLimiter,
    /**
     * Failed admin sign-ins, keyed by username rather than IP: the client IP comes from
     * X-Forwarded-For and can be spoofed unless a trusted load balancer sets it.
     */
    private readonly adminLoginLimiter: FailureLimiter,
    /** Public URL of the UI; reset links point to `${appUrl}/reset-password`. */
    private readonly appUrl: string,
    readonly resetPolicy: PasswordResetPolicy = DEFAULT_PASSWORD_RESET_POLICY,
  ) {}

  /** The signed-in user and their company, for the UI. */
  async getMe({
    companyId,
    userId,
  }: Pick<UserContext, "companyId" | "userId"> & Partial<UserContext>): Promise<MeDTO> {
    const user = await this.db.user.findUnique({
      where: { id: userId, companyId },
      include: { company: { select: { id: true, name: true, slug: true } } },
    });
    if (!user) throw new NotFoundError("Your account no longer exists.");
    const { company } = user;
    return {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
      company: { id: company.id, name: company.name, slug: company.slug },
      permissions: allowedActions(user.role),
    };
  }

  /** A user changing their own name (Settings). */
  async updateProfile(
    { companyId, userId }: Pick<UserContext, "companyId" | "userId"> & Partial<UserContext>,
    names: { firstName: string; lastName: string },
  ): Promise<MeDTO> {
    await this.db.user.update({ where: { id: userId, companyId }, data: names });
    return this.getMe({ companyId, userId });
  }

  // --- Users ----------------------------------------------------------------

  /** User login step 2: checks the password and starts a signed-in session. */
  async loginUser(
    input: { slug: string; email: string; password: string },
    meta: SessionMeta = {},
  ): Promise<{ token: string; me: MeDTO }> {
    const key = `${input.slug}|${input.email}`;
    if (this.userLoginLimiter.isBlocked(key)) {
      throw new TooManyAttemptsError(
        "Too many failed attempts. Try again in 15 minutes, or reset your password.",
      );
    }
    // The workspace first, then the user within it by company_id.
    const workspace = await this.db.company.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    const user = workspace
      ? await this.db.user.findFirst({
          where: { companyId: workspace.id, email: input.email },
          include: { company: { select: { id: true, name: true, slug: true, isActive: true } } },
        })
      : null;
    const canSignIn = Boolean(user?.password && user.isActive && user.company.isActive);
    const valid = canSignIn
      ? await verifyPassword(user!.password!, input.password)
      : await verifyDummyPassword(input.password);
    if (!user || !canSignIn || !valid) {
      this.userLoginLimiter.recordFailure(key);
      throw new AuthenticationError("Incorrect email or password.");
    }
    this.userLoginLimiter.reset(key);

    const { token } = await this.sessions.createSession(
      { kind: "user", userId: user.id, companyId: user.companyId },
      meta,
    );
    await this.db.user.update({
      where: { id: user.id, companyId: user.companyId },
      data: { lastSignInAt: new Date() },
    });
    const { company } = user;
    return {
      token,
      me: {
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        },
        company: { id: company.id, name: company.name, slug: company.slug },
        permissions: allowedActions(user.role),
      },
    };
  }

  /**
   * Forgot password: emails a reset link if an active account exists. Gives no sign of
   * whether it does, so it can't be used to discover accounts. At most one email per minute.
   */
  async requestPasswordReset(slug: string, email: string): Promise<void> {
    const company = await this.db.company.findUnique({
      where: { slug },
      select: { id: true, name: true, isActive: true },
    });
    if (!company?.isActive) return;
    const user = await this.db.user.findFirst({
      where: { companyId: company.id, email, isActive: true, password: { not: null } },
    });
    if (!user) return;
    // Reset tokens have no company_id of their own: they're scoped through their user.
    const ofUser = { userId: user.id, user: { companyId: company.id } };

    const latest = await this.db.passwordResetToken.findFirst({
      where: ofUser,
      orderBy: { createdAt: "desc" },
    });
    if (latest && Date.now() - latest.createdAt.getTime() < this.resetPolicy.cooldownMs) return;

    const token = generateToken();
    await this.db.$transaction([
      this.db.passwordResetToken.deleteMany({ where: { ...ofUser, usedAt: null } }),
      this.db.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + this.resetPolicy.ttlMinutes * 60_000),
        },
      }),
    ]);
    const resetUrl = new URL("/reset-password", this.appUrl);
    resetUrl.searchParams.set("token", token);
    await this.email.sendPasswordReset({
      to: user.email,
      firstName: user.firstName,
      companyName: company.name,
      resetUrl: resetUrl.toString(),
      expiresInMinutes: this.resetPolicy.ttlMinutes,
    });
  }

  /**
   * Sets a new password from a reset link and signs the user out everywhere. The token
   * is looked up alone (it's the credential, and it tells us the company); everything
   * after that filters on the company.
   */
  async resetPassword(token: string, password: string): Promise<{ companySlug: string }> {
    const record = await this.db.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { include: { company: { select: { slug: true, isActive: true } } } } },
    });
    const usable =
      record &&
      !record.usedAt &&
      record.expiresAt.getTime() > Date.now() &&
      record.user.isActive &&
      record.user.company.isActive;
    if (!usable) throw new NotFoundError(INVALID_RESET_LINK, "token");

    const companyId = record.user.companyId;
    const ofUser = { userId: record.userId, user: { companyId } };
    await this.db.$transaction([
      this.db.user.update({
        where: { id: record.userId, companyId },
        data: { password: await hashPassword(password) },
      }),
      this.db.passwordResetToken.update({
        where: { id: record.id, ...ofUser },
        data: { usedAt: new Date() },
      }),
      this.db.passwordResetToken.deleteMany({ where: { ...ofUser, usedAt: null } }),
    ]);
    await this.sessions.deleteUserSessions(companyId, record.userId);
    return { companySlug: record.user.company.slug };
  }

  /** Changes the password and signs out every other session of the user. */
  async changePassword(
    { companyId, userId, sessionId }: UserContext,
    input: { currentPassword: string; newPassword: string },
  ): Promise<void> {
    const user = await this.db.user.findUnique({ where: { id: userId, companyId } });
    if (!user?.password) throw new NotFoundError("Your account no longer exists.");
    if (!(await verifyPassword(user.password, input.currentPassword))) {
      throw new InvalidInputError("Your current password is incorrect.", "currentPassword");
    }
    if (input.currentPassword === input.newPassword) {
      throw new InvalidInputError(
        "Choose a password different from your current one.",
        "newPassword",
      );
    }
    await this.db.user.update({
      where: { id: user.id, companyId },
      data: { password: await hashPassword(input.newPassword) },
    });
    await this.sessions.deleteUserSessions(companyId, user.id, { exceptSessionId: sessionId });
  }

  async signOutEverywhere({ companyId, userId }: UserContext): Promise<void> {
    await this.sessions.deleteUserSessions(companyId, userId);
  }

  // --- Admins ---------------------------------------------------------------

  /** The signed-in admin, for the admin pages. */
  async getAdmin({ adminId }: AdminContext): Promise<AdminDTO> {
    const admin = await this.db.admin.findUnique({
      where: { id: adminId },
      select: { id: true, username: true },
    });
    if (!admin) throw new NotFoundError("Your admin account no longer exists.");
    return admin;
  }

  /** Checks admin credentials. Throws AuthenticationError or TooManyAttemptsError. */
  async authenticateAdmin(username: string, password: string): Promise<AdminDTO> {
    const key = username.toLowerCase();
    if (this.adminLoginLimiter.isBlocked(key)) {
      throw new TooManyAttemptsError("Too many failed attempts. Try again in 15 minutes.");
    }
    const admin = await this.db.admin.findUnique({ where: { username } });
    const valid = admin
      ? await verifyPassword(admin.password, password)
      : await verifyDummyPassword(password);
    if (!admin || !valid) {
      this.adminLoginLimiter.recordFailure(key);
      throw new AuthenticationError("Incorrect username or password.");
    }
    this.adminLoginLimiter.reset(key);
    return { id: admin.id, username: admin.username };
  }

  /**
   * Creates an admin, or sets a new password for an existing one (signing them out
   * everywhere). Used by the create-admin script; there is no admin sign-up.
   */
  async createOrResetAdmin(
    username: string,
    password: string,
  ): Promise<{ admin: AdminDTO; created: boolean }> {
    if (password.length < PASSWORD_MIN_LENGTH) {
      throw new InvalidInputError(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
        "password",
      );
    }
    const passwordHash = await hashPassword(password);
    const existing = await this.db.admin.findUnique({ where: { username } });
    if (existing) {
      await this.db.admin.update({ where: { id: existing.id }, data: { password: passwordHash } });
      await this.sessions.deleteAdminSessions(existing.id);
      return { admin: { id: existing.id, username }, created: false };
    }
    const admin = await this.db.admin.create({ data: { username, password: passwordHash } });
    return { admin: { id: admin.id, username: admin.username }, created: true };
  }
}
