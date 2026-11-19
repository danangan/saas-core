import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { BaseTestContainer } from "./base";

export type MailpitTestContainerConfig = {
  image: string;
  smtpPort: number;
  httpPort: number;
};

const MAILPIT_DEFAULT_CONFIG: MailpitTestContainerConfig = {
  // Same image as local-dev/docker-compose.yml.
  image: "docker.io/axllent/mailpit:v1.27",
  smtpPort: 1025,
  httpPort: 8025,
};

/** Mailpit: catches email over SMTP and serves it over its API. */
export class MailpitTestContainer extends BaseTestContainer<MailpitTestContainerConfig, StartedTestContainer> {
  constructor(config?: Partial<MailpitTestContainerConfig>) {
    super(MAILPIT_DEFAULT_CONFIG, config);
  }

  protected create(): Promise<StartedTestContainer> {
    return new GenericContainer(this.config.image)
      .withExposedPorts(this.config.smtpPort, this.config.httpPort)
      .withWaitStrategy(Wait.forListeningPorts())
      .start();
  }

  getSMTP(): { host: string; port: number } {
    return { host: this.getHost(), port: this.container.getMappedPort(this.config.smtpPort) };
  }

  /** Mailpit's API (and web UI). */
  getURL(): string {
    return `http://${this.getHost()}:${this.container.getMappedPort(this.config.httpPort)}`;
  }
}
