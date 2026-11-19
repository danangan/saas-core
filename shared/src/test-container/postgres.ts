import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { BaseTestContainer } from "./base";

export type DBUser = {
  username: string;
  password: string;
};

export type PostgresTestContainerConfig = {
  image: string;
  dbName: string;
  /** The superuser that owns the database; runs the migrations. */
  adminUsername: string;
  adminPassword: string;
  /** Login roles created at startup. Their grants come from the Prisma migrations. */
  users: DBUser[];
};

const POSTGRES_DEFAULT_CONFIG: PostgresTestContainerConfig = {
  // Same image as local-dev/docker-compose.yml.
  image: "docker.io/library/postgres:17-alpine",
  dbName: "saas",
  adminUsername: "admin",
  adminPassword: "admin",
  // Names fixed by the migrations' GRANTs.
  users: [{ username: "saas_app", password: "saas_app" }],
};

const quoteIdentifier = (name: string) => `"${name.replaceAll('"', '""')}"`;
const quoteLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`;

export class PostgresTestContainer extends BaseTestContainer<
  PostgresTestContainerConfig,
  StartedPostgreSqlContainer
> {
  constructor(config?: Partial<PostgresTestContainerConfig>) {
    super(POSTGRES_DEFAULT_CONFIG, config);
  }

  private createInitScript(): string {
    return this.config.users
      .map(({ username, password }) => `CREATE ROLE ${quoteIdentifier(username)} LOGIN PASSWORD ${quoteLiteral(password)};\n`)
      .join("");
  }

  protected create(): Promise<StartedPostgreSqlContainer> {
    return new PostgreSqlContainer(this.config.image)
      .withDatabase(this.config.dbName)
      .withUsername(this.config.adminUsername)
      .withPassword(this.config.adminPassword)
      .withCopyContentToContainer([
        { content: this.createInitScript(), target: "/docker-entrypoint-initdb.d/01-roles.sql" },
      ])
      .start();
  }

  getPort(): number {
    return this.container.getPort();
  }

  getDatabase(): string {
    return this.container.getDatabase();
  }

  /** One of `config.users`, or the admin. */
  getUser(username?: string): DBUser {
    if (!username || username === this.config.adminUsername) {
      return { username: this.config.adminUsername, password: this.config.adminPassword };
    }
    const user = this.config.users.find((u) => u.username === username);
    if (!user) throw Error(`No Postgres user "${username}" in this container's config`);
    return user;
  }

  /** Connection URL as `username` (one of `config.users`), or as the admin by default. */
  getURL(username?: string): string {
    const user = this.getUser(username);
    const credentials = `${encodeURIComponent(user.username)}:${encodeURIComponent(user.password)}`;
    return `postgresql://${credentials}@${this.getHost()}:${this.getPort()}/${this.getDatabase()}`;
  }
}
