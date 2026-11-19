import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const ui = new URL("../../../", import.meta.url).pathname;

describe("generated API types", () => {
  it("are up to date with openapi.json (run `pnpm api:generate`)", async () => {
    // The same command as `pnpm api:types`, printing instead of writing.
    const { stdout } = await promisify(execFile)(
      "pnpm",
      ["exec", "openapi-typescript", "../openapi.json"],
      { cwd: ui },
    );
    const committed = await readFile(new URL("./generated/schema.ts", import.meta.url), "utf8");
    expect(committed.trim()).toBe(stdout.trim());
  }, 60_000);
});
