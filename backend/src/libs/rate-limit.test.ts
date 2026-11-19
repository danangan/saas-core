import { describe, expect, it } from "vitest";
import { FailureLimiter } from "./rate-limit";

describe("FailureLimiter", () => {
  it("blocks after max failures and unblocks after the window", () => {
    const limiter = new FailureLimiter({ maxFailures: 3, windowMs: 1000 });
    for (let i = 0; i < 3; i++) {
      expect(limiter.isBlocked("k", 0)).toBe(false);
      limiter.recordFailure("k", 0);
    }
    expect(limiter.isBlocked("k", 500)).toBe(true);
    expect(limiter.isBlocked("k", 1000)).toBe(false);
  });

  it("reset clears failures", () => {
    const limiter = new FailureLimiter({ maxFailures: 1, windowMs: 1000 });
    limiter.recordFailure("k", 0);
    limiter.reset("k");
    expect(limiter.isBlocked("k", 0)).toBe(false);
  });
});
