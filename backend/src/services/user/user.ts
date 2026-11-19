import type { UserRole } from "@saas-core/shared/db";
import type { BulkInviteResult, InviteEntry, UserStatus } from "../../types";
import {
  isPrismaError,
  PrismaErrorCode,
  type Invitation,
  type PrismaClient,
  type User,
} from "@saas-core/shared/db";
import { hashPassword } from "@saas-core/shared/security";
import { generateToken, hashToken } from "@saas-core/shared/security";
import type { EmailService } from "../email/email";
import {
  ConflictError,
  DeliveryFailedError,
  InvalidInputError,
  LimitReachedError,
  NotFoundError,
} from "../../libs/errors";
import type { PlanService } from "../plan/plan";
import type { SessionService } from "../session/session";

/** A user as exposed outside the service layer (never includes the password hash). */
export type UserDTO = {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastSignInAt: Date | null;
  /** The pending invitation of an invited user; null otherwise. */
  invitation: { sentAt: Date; expiresAt: Date } | null;
  createdAt: Date;
};

export type NewUser = {
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: UserRole;
};

/** What a PATCH may change. */
export type UserChanges = {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
};

/**
 * Who is acting, when it's a company admin managing their own team (not a platform
 * admin): they can't change, deactivate or delete their own account here, so a company
 * always keeps the admin doing the managing. `name` goes in invitation emails.
 */
export type TeamActor = { userId: string; name: string };

/** A user as loaded with their pending invitation, for toDTO. */
export type UserWithInvitation = User & {
  invitations?: Pick<Invitation, "createdAt" | "expiresAt">[];
};

/** Include for a user's pending invitation (the newest unaccepted one). */
export const PENDING_INVITATION = {
  where: { acceptedAt: null },
  orderBy: { createdAt: "desc" as const },
  take: 1,
  select: { createdAt: true, expiresAt: true },
};

const SELF_CHANGE = "You can't change your own account here. Ask another admin of your company.";

const DAY = 24 * 60 * 60 * 1000;
const INVALID_INVITATION =
  "This invitation link is invalid or has expired. Ask your admin to send a new one.";

/**
 * Company users: managed by admins (add, activate or deactivate, delete), invited by
 * email with one-time sign-up links, and signing up from those links.
 */
export class UserService {
  constructor(
    private readonly db: PrismaClient,
    private readonly sessions: SessionService,
    private readonly email: EmailService,
    /** The company's user limit, checked when a user is added or reactivated. */
    private readonly plans: PlanService,
    /** Public URL of the UI; sign-up links point to `${appUrl}/signup`. */
    private readonly appUrl: string,
    readonly invitationTtlDays = 7,
  ) {}

  static statusOf(user: Pick<User, "isActive" | "password">): UserStatus {
    if (!user.isActive) return "deactivated";
    return user.password ? "active" : "invited";
  }

  static toDTO(user: UserWithInvitation): UserDTO {
    const status = UserService.statusOf(user);
    const pending = status === "invited" ? user.invitations?.[0] : undefined;
    return {
      id: user.id,
      companyId: user.companyId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      status,
      lastSignInAt: user.lastSignInAt,
      invitation: pending ? { sentAt: pending.createdAt, expiresAt: pending.expiresAt } : null,
      createdAt: user.createdAt,
    };
  }

  /** A company's users, newest first, with their pending invitations. */
  async listUsers(companyId: string): Promise<UserDTO[]> {
    const users = await this.db.user.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: { invitations: PENDING_INVITATION },
    });
    return users.map(UserService.toDTO);
  }

  /**
   * Creates an invited user (no password yet) and emails the invitation.
   * If the email fails the user is still created: throws DeliveryFailedError.
   */
  async addUser(input: NewUser, invitedBy?: TeamActor): Promise<UserDTO> {
    let user: User;
    try {
      // Under the company's lock, so two invites at once can't both take the last place.
      user = await this.db.$transaction(async (tx) => {
        await this.plans.lock(tx, input.companyId);
        await this.plans.assertCanAddUsers(input.companyId, 1, tx);
        return tx.user.create({ data: input });
      });
    } catch (error) {
      if (isPrismaError(error, PrismaErrorCode.UniqueViolation)) {
        throw new ConflictError("A user with this email already exists in this company.", "email");
      }
      if (isPrismaError(error, PrismaErrorCode.ForeignKeyViolation)) {
        throw new NotFoundError("Company not found.");
      }
      throw error;
    }
    try {
      await this.issueInvitation(user.companyId, user.id, invitedBy);
    } catch (error) {
      throw new DeliveryFailedError(
        `${user.firstName} was added, but the invitation email could not be sent. Use "Resend invitation" to try again.`,
        undefined,
        { cause: error },
      );
    }
    return this.getUser(user.companyId, user.id);
  }

  /**
   * Invites several people with the same role, one at a time, and says how each went:
   * an email already in the company is skipped, and a failed email still adds the user.
   */
  async bulkInvite(
    companyId: string,
    entries: InviteEntry[],
    role: UserRole,
    invitedBy?: TeamActor,
  ): Promise<{ results: BulkInviteResult; invited: UserDTO[] }> {
    const results: BulkInviteResult = [];
    const invited: UserDTO[] = [];
    for (const entry of entries) {
      try {
        invited.push(await this.addUser({ companyId, ...entry, role }, invitedBy));
        results.push({ email: entry.email, outcome: "invited" });
      } catch (error) {
        if (error instanceof ConflictError) results.push({ email: entry.email, outcome: "exists" });
        else if (error instanceof LimitReachedError)
          results.push({ email: entry.email, outcome: "limit_reached" });
        else if (error instanceof DeliveryFailedError) {
          results.push({ email: entry.email, outcome: "email_failed" });
          invited.push(await this.getUserByEmail(companyId, entry.email));
        } else throw error;
      }
    }
    return { results, invited };
  }

  async getUser(companyId: string, userId: string): Promise<UserDTO> {
    const user = await this.db.user.findUnique({
      where: { id: userId, companyId },
      include: { invitations: PENDING_INVITATION },
    });
    if (!user) throw new NotFoundError("User not found.");
    return UserService.toDTO(user);
  }

  async resendInvitation(companyId: string, userId: string, actor?: TeamActor): Promise<UserDTO> {
    const user = await this.findOrThrow(companyId, userId);
    if (user.password) throw new ConflictError("This user has already accepted their invitation.");
    await this.issueInvitation(companyId, userId, actor);
    return this.getUser(companyId, userId);
  }

  /**
   * Changes any of a user's name, email, role, and whether they're active. Deactivating
   * signs them out everywhere. Returns the user before and after, for the audit log.
   */
  async updateUser(
    companyId: string,
    userId: string,
    changes: UserChanges,
    actor?: TeamActor,
  ): Promise<{ before: UserDTO; after: UserDTO }> {
    if (actor?.userId === userId) throw new InvalidInputError(SELF_CHANGE);
    const before = await this.getUser(companyId, userId);
    try {
      await this.db.$transaction(async (tx) => {
        // Reactivating a user takes a place within the user limit again.
        if (changes.isActive === true && before.status === "deactivated") {
          await this.plans.lock(tx, companyId);
          await this.plans.assertCanAddUsers(companyId, 1, tx);
        }
        await tx.user.update({ where: { id: userId, companyId }, data: changes });
      });
    } catch (error) {
      if (isPrismaError(error, PrismaErrorCode.UniqueViolation)) {
        throw new ConflictError("A user with this email already exists in this company.", "email");
      }
      if (isPrismaError(error, PrismaErrorCode.RecordNotFound))
        throw new NotFoundError("User not found.");
      throw error;
    }
    if (changes.isActive === false) await this.sessions.deleteUserSessions(companyId, userId);
    return { before, after: await this.getUser(companyId, userId) };
  }

  /** Deactivating also signs the user out everywhere. */
  async setActive(
    companyId: string,
    userId: string,
    isActive: boolean,
    actor?: TeamActor,
  ): Promise<UserDTO> {
    return (await this.updateUser(companyId, userId, { isActive }, actor)).after;
  }

  /** Sessions, invitations, and tokens cascade. */
  async deleteUser(companyId: string, userId: string, actor?: TeamActor): Promise<UserDTO> {
    if (actor?.userId === userId) throw new InvalidInputError(SELF_CHANGE);
    try {
      return UserService.toDTO(await this.db.user.delete({ where: { id: userId, companyId } }));
    } catch (error) {
      if (isPrismaError(error, PrismaErrorCode.RecordNotFound))
        throw new NotFoundError("User not found.");
      throw error;
    }
  }

  /** What the sign-up page shows. Throws NotFoundError if the link can't be used. */
  async describeInvitation(
    token: string,
  ): Promise<{ companyName: string; companySlug: string; email: string; firstName: string }> {
    const invitation = await this.findUsableInvitation(token);
    return {
      companyName: invitation.company.name,
      companySlug: invitation.company.slug,
      email: invitation.user.email,
      firstName: invitation.user.firstName,
    };
  }

  /** Sign-up: sets the invited user's password, which activates the account. */
  async acceptInvitation(token: string, password: string): Promise<{ companySlug: string }> {
    const invitation = await this.findUsableInvitation(token);
    await this.db.$transaction([
      this.db.user.update({
        where: { id: invitation.userId, companyId: invitation.companyId },
        data: { password: await hashPassword(password) },
      }),
      this.db.invitation.update({
        where: { id: invitation.id, companyId: invitation.companyId },
        data: { acceptedAt: new Date() },
      }),
    ]);
    return { companySlug: invitation.company.slug };
  }

  /**
   * Replaces any pending invitations for the user with a new one and emails the
   * sign-up link. Throws if the email cannot be sent; the new invitation is kept,
   * so it can simply be issued again.
   */
  private async issueInvitation(
    companyId: string,
    userId: string,
    invitedBy?: TeamActor,
  ): Promise<void> {
    const user = await this.db.user.findUnique({
      where: { id: userId, companyId },
      include: { company: { select: { name: true } } },
    });
    if (!user) throw new NotFoundError("User not found.");

    const token = generateToken();
    await this.db.$transaction([
      this.db.invitation.deleteMany({ where: { companyId, userId, acceptedAt: null } }),
      this.db.invitation.create({
        data: {
          companyId,
          userId,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + this.invitationTtlDays * DAY),
        },
      }),
    ]);

    const signUpUrl = new URL("/signup", this.appUrl);
    signUpUrl.searchParams.set("token", token);
    await this.email.sendInvitation({
      to: user.email,
      firstName: user.firstName,
      companyName: user.company.name,
      signUpUrl: signUpUrl.toString(),
      expiresInDays: this.invitationTtlDays,
      invitedBy: invitedBy?.name,
    });
  }

  private async findOrThrow(companyId: string, userId: string): Promise<User> {
    const user = await this.db.user.findUnique({ where: { id: userId, companyId } });
    if (!user) throw new NotFoundError("User not found.");
    return user;
  }

  async getUserByEmail(companyId: string, email: string): Promise<UserDTO> {
    const user = await this.db.user.findUnique({
      where: { companyId_email: { companyId, email } },
      include: { invitations: PENDING_INVITATION },
    });
    if (!user) throw new NotFoundError("User not found.");
    return UserService.toDTO(user);
  }

  /**
   * Looks the invitation up by its token alone: the token is the credential, and it's
   * what tells us the company. Everything after this filters on that company.
   */
  private async findUsableInvitation(token: string) {
    const invitation = await this.db.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true, company: true },
    });
    const usable =
      invitation &&
      !invitation.acceptedAt &&
      invitation.expiresAt.getTime() > Date.now() &&
      !invitation.user.password &&
      invitation.user.isActive &&
      invitation.company.isActive;
    if (!usable) throw new NotFoundError(INVALID_INVITATION, "token");
    return invitation;
  }
}
