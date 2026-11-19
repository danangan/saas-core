import type { Company, Prisma, PrismaClient, User, UserRole } from "..";
import { hashPassword } from "../../security/password";
import { hashToken } from "../../security/token";
import { randomSecret } from "./utils";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const withCompany = { company: true } as const satisfies Prisma.UserInclude;

export type UserWithCompany = Prisma.UserGetPayload<{ include: typeof withCompany }>;

export type SignedUpUser = UserWithCompany & { password: string };

export class UserDBConnector {
  constructor(
    private readonly dbClient: () => PrismaClient,
    private readonly nameModifier: (label: string) => string = (label) => label,
  ) {}

  async createUser(
    company: Company,
    name = "member",
    {
      password = randomSecret(),
      role = "member",
      isActive = true,
    }: { password?: string; role?: UserRole; isActive?: boolean } = {},
  ): Promise<SignedUpUser> {
    const user = await this.insert(company, name, await hashPassword(password), role, isActive);
    return { ...user, password };
  }

  async createInvitedUser(
    company: Company,
    name = "invited",
    { expired = false }: { expired?: boolean } = {},
  ): Promise<{user: User, token: string}> {
    const user = await this.insert(company, name, null, "member");
    const token = randomSecret();
    const sentAt = new Date(Date.now() - (expired ? INVITATION_TTL_MS + 60_000 : 0));
    await this.dbClient().invitation.create({
      data: {
        companyId: company.id,
        userId: user.id,
        tokenHash: hashToken(token),
        createdAt: sentAt,
        expiresAt: new Date(sentAt.getTime() + INVITATION_TTL_MS),
      },
    });
    return { user, token };
  }

  private insert(
    company: Company,
    name: string,
    passwordHash: string | null,
    role: UserRole,
    isActive = true,
  ): Promise<UserWithCompany> {
    return this.dbClient().user.create({
      data: {
        companyId: company.id,
        firstName: name,
        lastName: "Tester",
        // In lower case, as the app stores every email.
        email: `${this.nameModifier(name)}@example.test`.toLowerCase(),
        password: passwordHash,
        role,
        isActive,
      },
      include: withCompany,
    });
  }
}
