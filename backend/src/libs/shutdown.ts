/**
 * Graceful shutdown for an entry point. The first SIGINT (Ctrl+C), SIGTERM, or SIGHUP
 * runs `stop` and exits; if that takes longer than `timeoutMs`, or a second signal
 * arrives, the process exits at once. Work left unfinished is safe: jobs are taken back
 * by another worker when their lease ends.
 *
 * A repeat within a second is the same Ctrl+C arriving twice (from the terminal and
 * forwarded by the dev runner), so it doesn't count as the second signal.
 */
export function exitOnSignal(name: string, stop: () => Promise<void>, timeoutMs: number): void {
  let stoppingSince = 0;
  const handler = (signal: NodeJS.Signals) => {
    if (stoppingSince) {
      if (Date.now() - stoppingSince < 1000) return;
      console.warn(`[${name}] ${signal} again: exiting now`);
      process.exit(1);
    }
    stoppingSince = Date.now();
    console.info(`[${name}] ${signal}: shutting down (press Ctrl+C again to force)`);
    setTimeout(() => {
      console.warn(`[${name}] still shutting down after ${timeoutMs / 1000}s: exiting now`);
      process.exit(1);
    }, timeoutMs).unref();
    stop().then(
      () => process.exit(0),
      (error) => {
        console.error(`[${name}] shutdown failed`, error);
        process.exit(1);
      },
    );
  };
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(signal, handler);
}
