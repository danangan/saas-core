import { describe, expect, it } from "vitest";
import { parseInviteList } from "./invite-list";

describe("parseInviteList", () => {
  it("reads names and emails in each format, skipping blanks and duplicates", () => {
    const { entries, errors } = parseInviteList(
      "Jane Doe, Jane@X.test\n\nBob <bob@x.test>\nmary.ann@x.test\njane@x.test\n",
    );
    expect(errors).toEqual([]);
    expect(entries).toEqual([
      { firstName: "Jane", lastName: "Doe", email: "jane@x.test" },
      { firstName: "Bob", lastName: "", email: "bob@x.test" },
      { firstName: "Mary", lastName: "", email: "mary.ann@x.test" },
    ]);
  });
  it("reports lines without a valid email by number", () => {
    const { entries, errors } = parseInviteList("ok@x.test\nJust a name\n");
    expect(entries).toHaveLength(1);
    expect(errors).toEqual(['Line 2: no valid email address in "Just a name".']);
  });
});
