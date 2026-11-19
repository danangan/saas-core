import { spawn, type ChildProcess } from "node:child_process";

export type ServiceConfig = {
  name: string;
  command: string;
  cwd: string;
  env?: Record<string, string | undefined>;
  /** Answers (any status below 500) once the service is ready. */
  url: string;
  timeoutMs: number;
  /** Echo its output, prefixed with its name. Otherwise only shown if it fails to start. */
  showLogs?: boolean;
};

export class ServiceLauncher {
  readonly config: ServiceConfig;
  private child?: ChildProcess;
  /** The last of its output, shown if it fails to start. */
  private tail = "";

  constructor(config: ServiceConfig) {
    this.config = config;
  }

  /** Starts the service and waits until it answers. If it doesn't, stops it and throws. */
  async start(): Promise<void> {
    if (this.child) return;
    this.launch();
    try {
      await this.waitUntilReady();
    } catch (error) {
      await this.stop();
      throw error;
    }
    console.info(`[e2e] ${this.config.name} ready`);
  }

  /** SIGTERM to the whole group, then SIGKILL if it's still running after 10s. */
  async stop(): Promise<void> {
    const child = this.child;
    this.child = undefined;
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exited = new Promise((resolve) => child.once("exit", resolve));
    this.signal(child, "SIGTERM");
    const timer = setTimeout(() => this.signal(child, "SIGKILL"), 10_000);
    await exited;
    clearTimeout(timer);
  }

  /** SIGKILL, synchronously: for process "exit" handlers, where nothing async runs. */
  kill(): void {
    if (this.child) this.signal(this.child, "SIGKILL");
  }

  private launch(): void {
    const { name, command, cwd, env, showLogs } = this.config;
    this.tail = "";
    const child = spawn("sh", ["-c", command], {
      cwd,
      // process.env carries PATH.
      env: { ...process.env, ...env },
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const collect = (chunk: Buffer) => {
      this.tail = (this.tail + chunk.toString()).slice(-4000);
      if (showLogs) process.stdout.write(chunk.toString().replace(/^/gm, `[${name}] `));
    };
    child.stdout!.on("data", collect);
    child.stderr!.on("data", collect);
    this.child = child;
  }

  private async waitUntilReady(): Promise<void> {
    const { name, url, timeoutMs } = this.config;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const exitCode = this.child?.exitCode;
      if (exitCode != null) {
        throw new Error(`${name} exited (code ${exitCode}) before it was ready:\n${this.tail}`);
      }
      try {
        if ((await fetch(url)).status < 500) return;
      } catch {
        // not listening yet
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`${name} wasn't ready at ${url} within ${timeoutMs / 1000}s:\n${this.tail}`);
  }

  /** Signals the whole process group: sh and what it started. */
  private signal(child: ChildProcess, signal: NodeJS.Signals): void {
    try {
      process.kill(-child.pid!, signal);
    } catch {
      // already gone
    }
  }
}
