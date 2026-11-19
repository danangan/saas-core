import { describe, expect, it } from "vitest";
import { newUserBody, updateUserBody } from "./user";

describe("newUserBody", () => {
  it("normalises email to lower case", () => {
    const parsed = newUserBody.parse({
      firstName: "Ann",
      lastName: "Lee",
      email: " Ann@Example.COM ",
    });
    expect(parsed.email).toBe("ann@example.com");
  });
  it("rejects an invalid email", () => {
    expect(newUserBody.safeParse({ firstName: "A", lastName: "B", email: "nope" }).success).toBe(
      false,
    );
  });
});

describe("newUserBody role", () => {
  it("defaults to member, and accepts admin", () => {
    expect(newUserBody.parse({ firstName: "A", lastName: "B", email: "a@x.test" }).role).toBe(
      "member",
    );
    expect(
      newUserBody.parse({ firstName: "A", lastName: "B", email: "a@x.test", role: "admin" }).role,
    ).toBe("admin");
    expect(
      newUserBody.safeParse({ firstName: "A", lastName: "B", email: "a@x.test", role: "owner" })
        .success,
    ).toBe(false);
  });
});

describe("updateUserBody", () => {
  it("needs at least one change", () => {
    expect(updateUserBody.safeParse({}).success).toBe(false);
    expect(updateUserBody.parse({ role: "admin" })).toEqual({ role: "admin" });
  });
});
