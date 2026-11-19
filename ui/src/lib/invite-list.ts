import { z } from "zod";
import type { InviteEntry } from "@/lib/api/types";

/** An email address, as the backend reads it (trimmed, in lower case). */
const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

/**
 * Parses a pasted invite list: one person per line, as `First Last, email`,
 * `First Last <email>` or just `email` (then the first name is taken from the address).
 * Blank lines are skipped; a line without a valid email is reported by its number.
 */
export function parseInviteList(text: string): { entries: InviteEntry[]; errors: string[] } {
  const entries: InviteEntry[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const match = /^(.*?)[\s,;]*<?([^\s<>,;]+@[^\s<>,;]+)>?$/.exec(line);
    const email = match && emailSchema.safeParse(match[2]);
    if (!match || !email?.success) {
      errors.push(`Line ${i + 1}: no valid email address in "${line}".`);
      return;
    }
    if (seen.has(email.data)) return;
    seen.add(email.data);
    const name = match[1].replace(/[,;]+$/, "").trim();
    const [first, ...rest] = name ? name.split(/\s+/) : [nameFromEmail(email.data)];
    entries.push({
      firstName: first.slice(0, 100),
      lastName: rest.join(" ").slice(0, 100),
      email: email.data,
    });
  });
  return { entries, errors };
}

/** "jane.doe@x.com" -> "Jane". */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0].split(/[._+-]/)[0] || email.split("@")[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}
