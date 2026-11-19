/**
 * The app's services in local mode, run on the host against the containers (stack.ts):
 * the backend (API and job worker) and the UI. Started by setup.ts once the database is
 * migrated, one at a time and each once the one before answers.
 *
 * Not Playwright's `webServer`: those start before globalSetup, and need their env
 * when the config loads, before the containers (and their ports) exist.
 */
import { fileURLToPath } from "node:url";
import type { PostgresTestContainer } from "@saas-core/shared/test-containers";
import { config } from "../config.ts";
import { ServiceLauncher } from "./service-launcher.ts";
import type { Stack } from "./stack.ts";

const ROOT = fileURLToPath(new URL("../../../..", import.meta.url));

// Apart from `pnpm dev`'s ports, so both can run at once. The UI's is in the config's baseURL.
const PORTS = { api: 4100 } as const;
const API_URL = `http://127.0.0.1:${PORTS.api}`;

const bin = "./node_modules/.bin";

/** The backend's DB_* variables for the container: it connects as the restricted app role. */
function containerDatabaseEnv(pg: PostgresTestContainer): Record<string, string> {
  const app = pg.getUser("saas_app");
  return {
    DB_HOST: pg.getHost(),
    DB_PORT: String(pg.getPort()),
    DB_NAME: pg.getDatabase(),
    DB_USERNAME: app.username,
    DB_PASSWORD: app.password,
  };
}
/** E2E_LOGS=1 echoes every service's output. */
const showLogs = Boolean(process.env.E2E_LOGS);

export class Services {
  readonly backend: ServiceLauncher;
  readonly ui: ServiceLauncher;
  /** If the runner exits without the teardown (e.g. it crashed), don't leave servers on the ports. */
  private readonly killAll = () => this.inStartOrder().forEach((service) => service.kill());

  constructor(stack: Stack) {
    const smtp = stack.mailpit.getSMTP();

    this.backend = new ServiceLauncher({
      name: "backend",
      // The API and the backend's job worker. The global setup has already migrated the database.
      command: `${bin}/tsx src/worker/main.ts & ${bin}/tsx src/api/main.ts`,
      cwd: `${ROOT}/backend`,
      env: {
        NODE_ENV: "development",
        HOST: "127.0.0.1",
        PORT: String(PORTS.api),
        APP_URL: config.baseURL,
        ...containerDatabaseEnv(stack.postgres),
        SMTP_HOST: smtp.host,
        SMTP_PORT: String(smtp.port),
        SMTP_USER: "",
        SMTP_PASSWORD: "",
      },
      url: `${API_URL}/health`,
      timeoutMs: 120_000,
      showLogs,
    });

    this.ui = new ServiceLauncher({
      name: "ui",
      command: `${bin}/next dev -p ${new URL(config.baseURL).port}`,
      cwd: `${ROOT}/ui`,
      env: { BACKEND_URL: API_URL, NEXT_DIST_DIR: ".next-e2e" },
      url: `${config.baseURL}/login`,
      timeoutMs: 120_000,
      showLogs,
    });
  }

  private inStartOrder(): ServiceLauncher[] {
    return [this.backend, this.ui];
  }

  /** Starts each service once the one before answers. If one fails, stops them all and throws. */
  async start(): Promise<void> {
    process.once("exit", this.killAll);
    try {
      for (const service of this.inStartOrder()) await service.start();
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async stop(): Promise<void> {
    process.off("exit", this.killAll);
    await Promise.all(
      this.inStartOrder()
        .reverse()
        .map((service) => service.stop()),
    );
  }
}
