import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import type { StartedTestContainer } from "testcontainers";

// This allows multiple calls to this function to only invoke the actual setup once
let wait: Promise<void> | undefined;

/** Points Testcontainers at Podman's socket when there's no Docker. */
function setupContainerRuntime(): Promise<void> {
  wait ??= (async function () {
    if (process.env.DOCKER_HOST || existsSync("/var/run/docker.sock")) return;
    let socket: string;
    try {
      const { stdout } = await promisify(execFile)("podman", [
        "machine",
        "inspect",
        "--format",
        "{{.ConnectionInfo.PodmanSocket.Path}}",
      ]);
      socket = stdout.trim();
    } catch {
      throw Error("Failed to setup container runtime, make sure your container runtime is running");
    }
    if (!socket) return;
    process.env.DOCKER_HOST = `unix://${socket}`;
    // Ryuk doesn't work with Podman: stop() must be called to remove the container.
    process.env.TESTCONTAINERS_RYUK_DISABLED ??= "true";
  })();
  return wait;
}

// This interface defines our own wrapper on top of TestContainer
export interface TestContainer {
  start(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * What every container shares: the config (defaults merged with overrides), a
 * `start()` that's safe to call more than once, and `stop()`.
 */
export abstract class BaseTestContainer<Config, Started extends StartedTestContainer> implements TestContainer {
  readonly config: Config;
  private starting?: Promise<Started>;
  private started?: Started;

  constructor(defaults: Config, config?: Partial<Config>) {
    this.config = { ...defaults, ...config };
  }

  /** Builds and starts the Testcontainers container from `this.config`. */
  protected abstract create(): Promise<Started>;

  async start(): Promise<void> {
    this.starting ??= setupContainerRuntime().then(() => this.create());
    try {
      this.started = await this.starting;
    } catch (error) {
      this.starting = undefined;
      throw error;
    }
  }

  async stop(): Promise<void> {
    const started = this.started;
    this.started = undefined;
    this.starting = undefined;
    await started?.stop();
  }

  protected get container(): Started {
    if (!this.started) {
      throw Error("Testcontainer is not ready, please wait for start() to resolve");
    }
    return this.started;
  }

  getHost(): string {
    return this.container.getHost();
  }
}
