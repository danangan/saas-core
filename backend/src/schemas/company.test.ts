import { describe, expect, it } from "vitest";
import { companyNameSchema, updateCompanyBody } from "./company";

describe("companyNameSchema", () => {
  it("accepts and trims a normal name", () => {
    expect(companyNameSchema.parse("  Will & Co ")).toBe("Will & Co");
  });
  it("rejects empty and symbol-only names", () => {
    expect(companyNameSchema.safeParse("   ").success).toBe(false);
    expect(companyNameSchema.safeParse("&&&").success).toBe(false);
  });
});

describe("updateCompanyBody", () => {
  it("needs at least one change", () => {
    expect(updateCompanyBody.safeParse({}).success).toBe(false);
    expect(updateCompanyBody.parse({ name: " Acme " })).toEqual({ name: "Acme" });
  });
});
