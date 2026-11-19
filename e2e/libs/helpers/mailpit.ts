/**
 * Reads the emails the backend sends, from the local stack's Mailpit. Local mode only:
 * tests that use it are skipped on staging (`test.skip(!config.isLocalMode, …)`). Every test uses its
 * own addresses, so it only ever sees its own emails.
 */
import { expect } from "@playwright/test";

type Summary = { ID: string; Subject: string; To: { Address: string }[] };
export type Email = { ID: string; Subject: string; Text: string; HTML: string };

/** The local stack's Mailpit API, set by config/local-mode/setup.ts. Unset on staging. */
function mailpit(): string {
  const url = process.env.E2E_MAILPIT_URL;
  if (!url)
    throw new Error(
      "Reading emails needs the local stack's Mailpit: skip this test unless config.isLocalMode.",
    );
  return url;
}

/** The newest email to `to` whose subject matches, waiting for it to arrive. */
export async function waitForEmail(to: string, subject: RegExp): Promise<Email> {
  let found: Summary | undefined;
  await expect
    .poll(
      async () => {
        const res = await fetch(
          `${mailpit()}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
        );
        const { messages } = (await res.json()) as { messages: Summary[] };
        found = messages.find((m) => subject.test(m.Subject));
        return Boolean(found);
      },
      { message: `an email to ${to} matching ${subject}`, timeout: 15_000 },
    )
    .toBe(true);
  return (await (await fetch(`${mailpit()}/api/v1/message/${found!.ID}`)).json()) as Email;
}

/** The first link in an email (sign-up and reset emails have exactly one). */
export function linkIn(email: Email): URL {
  const match = /https?:\/\/\S+/.exec(email.Text);
  if (!match) throw new Error(`No link in "${email.Subject}"`);
  return new URL(match[0]);
}
