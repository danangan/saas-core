import type { CookieSerializeOptions } from "@fastify/cookie";

/** Attributes for session cookies (docs/architecture.md#sessions). */
export function sessionCookieOptions(options: { secure: boolean; maxAgeMs: number }): CookieSerializeOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: options.secure,
    path: "/",
    maxAge: Math.floor(options.maxAgeMs / 1000),
  };
}
