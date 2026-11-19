import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { devices, type PlaywrightTestConfig } from "@playwright/test";

type E2EConfigValues = {
  isLocalMode: boolean;
  baseURL: string;
  testExecutionId: string;
};

const DEFAULT_BROWSER = "Desktop Chrome";

export class E2EConfig {
  readonly isLocalMode: boolean;
  readonly baseURL: string;
  readonly testExecutionId: string;

  constructor(values: E2EConfigValues) {
    this.isLocalMode = values.isLocalMode;
    this.baseURL = values.baseURL;
    this.testExecutionId = values.testExecutionId;
  }

  /** From E2E_MODE. Both modes use the same accounts, made for this run (see accounts()). */
  static create(): E2EConfig {
    const mode = process.env.E2E_MODE || "local";
    if (mode !== "local" && mode !== "staging")
      throw new Error(`E2E_MODE must be "local" or "staging", not "${mode}".`);
    return mode === "local" ? E2EConfig.local() : E2EConfig.fromENV();
  }

  private static local(): E2EConfig {
    return new E2EConfig({
      isLocalMode: true,
      baseURL: "http://localhost:3100",
      testExecutionId: this.testExecutionId(),
    });
  }

  private static fromENV(): E2EConfig {
    return new E2EConfig({
      isLocalMode: false,
      baseURL: this.required("E2E_BASE_URL").replace(/\/$/, ""),
      testExecutionId: this.testExecutionId(),
    });
  }

  private static testExecutionId(): string {
    process.env.E2E_TEST_EXECUTION_ID ||= `e2e-${randomBytes(4).toString("hex")}`;
    const id = process.env.E2E_TEST_EXECUTION_ID;
    if (!/^e2e-[0-9a-f]+$/.test(id)) {
      throw new Error(`E2E_TEST_EXECUTION_ID must be "e2e-<hex>", not "${id}": leave it unset.`);
    }
    return id;
  }

  static required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Env variable ${name} is not set. Set it in CI`);
    return value;
  }

  private path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

  toPlayWrightConfig(): PlaywrightTestConfig {
    return {
      testDir: this.path("../../tests"),
      // One worker: the tests share one stack.
      workers: 1,
      fullyParallel: false,
      forbidOnly: !!process.env.CI,
      // Staging has a real network: allow one retry in CI for a transient failure.
      retries: process.env.CI ? 1 : 0,
      timeout: 120_000,
      expect: { timeout: 15_000 },
      reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
      // Each mode's own: connects the test data's database client (local mode starts and
      // migrates the stack first); the function it returns is the teardown, which deletes
      // everything the run made.
      globalSetup: this.isLocalMode
        ? this.path("./local-mode/setup.ts")
        : this.path("./staging-mode/setup.ts"),
      use: {
        baseURL: this.baseURL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
      },
      projects: this.isLocalMode
        ? [
            { name: "warmup", testMatch: /warmup\.setup\.ts/ },
            {
              name: "chromium",
              use: { ...devices[DEFAULT_BROWSER] },
              dependencies: ["warmup"],
            },
          ]
        : [{ name: "chromium", use: { ...devices[DEFAULT_BROWSER] } }],
    };
  }
}

export const config = E2EConfig.create();
