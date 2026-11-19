/**
 * Company slug from its name: lowercased, words joined by single hyphens,
 * anything other than a-z and 0-9 removed. Accented letters are reduced to
 * their base letter. E.g. "Will & Co" -> "will-co".
 * Returns "" when the name has no usable characters.
 */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
