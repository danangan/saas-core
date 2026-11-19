import type { Admin, PrismaClient } from "..";
import { hashPassword } from "../../security/password";
import { randomSecret } from "./utils";

export class AdminDBConnector {
  constructor(
    private readonly dbClient: () => PrismaClient,
    private readonly nameModifier: (arg: string) => string = (str) => str,
  ) {}

  /** An admin named from `label`, with a random password unless one is given. */
  async createAdmin(username: string = "admin", password: string = randomSecret()): Promise<Admin> {
    const admin = await this.dbClient().admin.create({
      data: { username: this.nameModifier(username), password: await hashPassword(password) },
    });

    return {
        ...admin,
        password
    }
  }
}
