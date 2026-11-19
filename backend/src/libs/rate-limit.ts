/**
 * Fixed-window, in-memory failure counter. Per process only: good enough to slow
 * down password guessing on a single instance; move to Postgres or Redis when
 * running more than one instance.
 */
export class FailureLimiter {
  private readonly failures = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly options: { maxFailures: number; windowMs: number }) {}

  isBlocked(key: string, now = Date.now()): boolean {
    return (this.current(key, now)?.count ?? 0) >= this.options.maxFailures;
  }

  recordFailure(key: string, now = Date.now()): void {
    const entry = this.current(key, now);
    if (entry) entry.count += 1;
    else this.failures.set(key, { count: 1, resetAt: now + this.options.windowMs });
  }

  reset(key: string): void {
    this.failures.delete(key);
  }

  private current(key: string, now: number) {
    const entry = this.failures.get(key);
    if (!entry || entry.resetAt <= now) {
      this.failures.delete(key);
      return undefined;
    }
    return entry;
  }
}
