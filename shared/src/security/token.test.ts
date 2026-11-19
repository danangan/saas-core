import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "./token";

describe("tokens", () => {
  it("generates distinct 256-bit base64url tokens", () => {
    const a = generateToken();
    expect(a).not.toBe(generateToken());
    expect(Buffer.from(a, "base64url")).toHaveLength(32);
  });

  it("hashes deterministically to hex sha-256", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
  });
});
