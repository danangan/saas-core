import {
  MailpitTestContainer,
  PostgresTestContainer,
  type TestContainer,
} from "../../../../shared/src/test-container";

export class Stack implements TestContainer {
  readonly postgres = new PostgresTestContainer();
  readonly mailpit = new MailpitTestContainer();
  static instance: Stack;

  private get containers(): TestContainer[] {
    return [this.postgres, this.mailpit];
  }

  /** Starts them all at once. If one fails, stops the others and throws. */
  async start(): Promise<void> {
    // allSettled, not all: on a failure, wait for the others too, so stop() gets every one.
    const results = await Promise.allSettled(this.containers.map((c) => c.start()));
    const failed = results.find((r) => r.status === "rejected");
    if (failed) {
      await this.stop();
      throw failed.reason;
    }
  }

  /** With Podman, Testcontainers doesn't clean up by itself, so this must run (the global setup's teardown calls it). */
  async stop(): Promise<void> {
    await Promise.allSettled(this.containers.map((c) => c.stop()));
  }

  static getInstance(): Stack {
    return (Stack.instance ??= new Stack());
  }
}
