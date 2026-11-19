import { describe, expect, it } from "vitest";
import { slugify } from "./utils";

describe("slugify", () => {
  it.each([
    ["Will & Co", "will-co"],
    ["Canva", "canva"],
    ["  Acme   Corp  ", "acme-corp"],
    ["Café Résumé", "cafe-resume"],
    ["O'Reilly Media, Inc.", "o-reilly-media-inc"],
    ["123 Studio", "123-studio"],
    ["---", ""],
    ["&&&", ""],
  ])("%j -> %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});