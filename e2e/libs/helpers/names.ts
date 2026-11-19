import { config } from "../config/config.ts";

/**
 * `<test execution id>-<label>-<suffix>`: what everything the tests create is named, so
 * the teardown (../db/cleanup.ts) finds it by the prefix and deletes it.
 */
export function testName(label: string): string {
  return `${config.testExecutionId}-${label}-${unique()}`;
}

/** A display name for something a test creates through the UI: `e2e-<id> <label> <suffix>`. */
export function runName(label: string): string {
  return `${config.testExecutionId} ${label} ${unique()}`;
}

/** A short random suffix, so names a test creates are its own. */
export function unique(): string {
  return Math.random().toString(36).slice(2, 8);
}