import { describe, expect, it } from "vitest";
import { z } from "zod";
import { apiErrors, formErrorMessage, schemaErrors, withoutField } from "./errors";

describe("form errors", () => {
  it("puts each schema issue on its field", () => {
    const schema = z.object({ email: z.email("Enter an email."), name: z.string().min(1, "Enter a name.") });
    const result = schema.safeParse({ email: "nope", name: "" });
    expect(result.success).toBe(false);
    const errors = schemaErrors(result.error!);
    expect(errors.fields).toEqual({ email: ["Enter an email."], name: ["Enter a name."] });
  });

  it("drops empty API field errors", () => {
    expect(apiErrors("Bad", { email: ["Taken."], name: [] }).fields).toEqual({ email: ["Taken."] });
  });

  it("shows the general message only when it isn't shown on a field", () => {
    const shown = (name: string) => name === "email";
    expect(formErrorMessage(null, shown)).toBeNull();
    expect(formErrorMessage(apiErrors("Could not reach the server."), shown)).toBe("Could not reach the server.");
    expect(formErrorMessage(apiErrors("Taken.", { email: ["Taken."] }), shown)).toBeNull();
    // An error for a field the form doesn't render isn't lost.
    expect(formErrorMessage(apiErrors("Bad", { email: ["Taken."], role: ["Pick one."] }), shown)).toBe("Pick one.");
  });

  it("clears one field's errors", () => {
    const errors = apiErrors("Bad", { email: ["Taken."], name: ["Short."] });
    expect(withoutField(errors, "email")?.fields).toEqual({ name: ["Short."] });
    expect(withoutField(apiErrors("Bad", { email: ["Taken."] }), "email")).toBeNull();
  });
});
